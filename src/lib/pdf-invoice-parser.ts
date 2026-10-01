import { Invoice } from '../financial-engine/types';
import { parseBankAmount, parseBankDate } from './bank-statement-parser';
import { extractTextFromPdf } from './pdf-text-extractor';

export interface ParsedPdfInvoice extends Invoice {
  rawTextSnippet?: string;
  confidenceScore: number; // 0.0 - 1.0
}

export interface InvoicePdfParseResult {
  fileName: string;
  invoices: ParsedPdfInvoice[];
  error?: string;
}

/**
 * Parser per fatture in formato PDF (copie di cortesia, fatture fornitori, parcelle).
 */
export async function parsePdfInvoice(
  fileOrBuffer: File | ArrayBuffer,
  fileName = 'fattura.pdf'
): Promise<InvoicePdfParseResult> {
  try {
    const extractedDoc = await extractTextFromPdf(fileOrBuffer, fileName);
    const fullText = extractedDoc.fullText;

    if (!fullText.trim()) {
      return {
        fileName,
        invoices: [],
        error: 'Nessun testo rilevabile nel documento PDF della fattura.'
      };
    }

    const lines: string[] = [];
    extractedDoc.pages.forEach(p => lines.push(...p.lines));

    // 1. Riconoscimento Tipo (Attiva vs Passiva)
    // Se "Elacus" compare come Committente / Cessionario / Cliente / Spettabile -> Fattura Passiva (Fornitore)
    // Se "Elacus" compare come Cedente / Prestatore / Emittente / Intestatario in alto -> Fattura Attiva (Emessa)
    let isPassive = true;
    const lowerText = fullText.toLowerCase();

    const clientBlockMatches = lowerText.match(/(?:cessionario|committente|destinatario|spett\.le|cliente|fatturare a)\s*[:\n\r]*([^\n\r]+(?:[\n\r]+[^\n\r]+){1,3})/i);
    if (clientBlockMatches && clientBlockMatches[1].includes('elacus')) {
      isPassive = true;
    } else {
      // Controlla le prime 15 righe: se Elacus è in cima, è emessa da Elacus
      const topLines = lines.slice(0, 15).join(' ').toLowerCase();
      if (topLines.includes('elacus') && !topLines.includes('spett.le elacus') && !topLines.includes('destinatario: elacus')) {
        isPassive = false;
      }
    }

    // 2. Estrazione Numero Documento
    let docNumber = '';
    const numberPatterns = [
      /(?:fattura\s+n(?:umero|\.|°)?|documento\s+n(?:umero|\.|°)?|parcella\s+n(?:umero|\.|°)?|notula\s+n(?:umero|\.|°)?|ft\s*n(?:umero|\.|°)?|fattura\s+ordinaria\s+n(?:umero|\.|°)?)\s*[:\s]*([A-Z0-9\/\-\.]+)/i,
      /(?:n(?:umero|\.|°)\s*(?:fattura|documento|ft))\s*[:\s]*([A-Z0-9\/\-\.]+)/i,
      /(?:numero\s+doc(?:umento)?)\s*[:\s]*([A-Z0-9\/\-\.]+)/i
    ];

    for (const pat of numberPatterns) {
      const match = fullText.match(pat);
      if (match && match[1] && match[1].trim()) {
        docNumber = match[1].trim().replace(/^[\/\-\.]+|[\/\-\.]+$/g, '');
        break;
      }
    }

    if (!docNumber) {
      // Fallback: estrai dal nome del file se contiene numeri (es. FT_103_2026.pdf)
      const fileMatch = fileName.match(/(\d{1,6}(?:[\-\/]\d{2,4})?)/);
      docNumber = fileMatch ? fileMatch[1] : `DOC-${Date.now().toString().slice(-4)}`;
    }

    // 3. Estrazione Data Documento
    let issueDate = new Date().toISOString().split('T')[0];
    const datePatterns = [
      /(?:data\s*(?:fattura|documento|emissione)?|del)\s*[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})\b/
    ];

    for (const pat of datePatterns) {
      const match = fullText.match(pat);
      if (match && match[1]) {
        issueDate = parseBankDate(match[1]);
        break;
      }
    }

    // 4. Estrazione Data Scadenza
    let dueDate = issueDate;
    const dueDateMatch = fullText.match(/(?:scadenza|data\s+scadenza|scadenza\s+il|pagamento\s+entro)\s*[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
    if (dueDateMatch && dueDateMatch[1]) {
      dueDate = parseBankDate(dueDateMatch[1]);
    } else {
      // Default: 30 o 60 giorni dopo
      const d = new Date(issueDate);
      d.setDate(d.getDate() + 30);
      dueDate = d.toISOString().split('T')[0];
    }

    // 5. Estrazione Controparte
    let counterpartName = isPassive ? 'Fornitore' : 'Cliente';
    if (isPassive) {
      // Cerca il cedente/prestatore o la prima riga significativa non-Elacus
      const cedenteMatch = fullText.match(/(?:cedente\s*\/?\s*prestatore|mittente|fornitore)\s*[:\n\r]*([^\n\r]+)/i);
      if (cedenteMatch && cedenteMatch[1].trim() && !cedenteMatch[1].toLowerCase().includes('elacus')) {
        counterpartName = cedenteMatch[1].trim();
      } else {
        // Prendi la prima riga tra le prime 5 che non contenga Elacus o parole generiche
        for (let i = 0; i < Math.min(lines.length, 6); i++) {
          const l = lines[i].trim();
          if (l.length > 3 && !l.toLowerCase().includes('elacus') && !l.toLowerCase().includes('fattura') && !l.toLowerCase().includes('documento') && !l.toLowerCase().includes('pagina')) {
            counterpartName = l;
            break;
          }
        }
      }
    } else {
      // Fattura attiva: cerca il cliente destinatario
      if (clientBlockMatches && clientBlockMatches[1].trim()) {
        const candidate = clientBlockMatches[1].split(/[\n\r]/)[0].trim();
        if (candidate.length > 2 && !candidate.toLowerCase().includes('elacus')) {
          counterpartName = candidate;
        }
      }
    }

    // 6. Estrazione Importi (Totale, Imponibile, IVA, Ritenuta)
    let totalAmount = 0;
    let taxableAmount = 0;
    let vatAmount = 0;
    let withholdingAmount = 0;
    let isWithholding = false;

    // Totale Documento / A pagare
    const totalPatterns = [
      /(?:totale\s*(?:documento|fattura|a\s+pagare|da\s+pagare|complessivo|netto\s+a\s+pagare))\s*[:\s]*€?\s*([0-9\.\,]+)/i,
      /(?:totale\s+dovuto|importo\s+totale|totale\s+generale)\s*[:\s]*€?\s*([0-9\.\,]+)/i,
      /(?:netto\s+a\s+pagare)\s*[:\s]*€?\s*([0-9\.\,]+)/i
    ];

    for (const pat of totalPatterns) {
      const match = fullText.match(pat);
      if (match && match[1]) {
        totalAmount = parseBankAmount(match[1]);
        if (totalAmount > 0) break;
      }
    }

    // Imponibile
    const taxableMatch = fullText.match(/(?:imponibile|totale\s+imponibile|base\s+imponibile)\s*[:\s]*€?\s*([0-9\.\,]+)/i);
    if (taxableMatch && taxableMatch[1]) {
      taxableAmount = parseBankAmount(taxableMatch[1]);
    }

    // IVA
    const vatMatch = fullText.match(/(?:imposta|totale\s+iva|iva\s*(?:22%|10%|4%|al\s*\d+%)?)\s*[:\s]*€?\s*([0-9\.\,]+)/i);
    if (vatMatch && vatMatch[1]) {
      vatAmount = parseBankAmount(vatMatch[1]);
    }

    // Ritenuta d'acconto
    const withholdingMatch = fullText.match(/(?:ritenuta\s*d['’]acconto|ritenuta\s*(?:alla\s+fonte|del\s*\d+%|ra)?)\s*[:\s]*€?\s*([0-9\.\,]+)/i);
    if (withholdingMatch && withholdingMatch[1]) {
      withholdingAmount = parseBankAmount(withholdingMatch[1]);
      if (withholdingAmount > 0) {
        isWithholding = true;
      }
    }

    // Riconciliazione matematica degli importi
    if (totalAmount === 0 && taxableAmount > 0) {
      totalAmount = Number((taxableAmount + vatAmount).toFixed(2));
    } else if (totalAmount > 0 && taxableAmount === 0) {
      // Stima imponibile scorporando al 22% se non esplicitato
      taxableAmount = Number((totalAmount / 1.22).toFixed(2));
      vatAmount = Number((totalAmount - taxableAmount).toFixed(2));
    } else if (totalAmount > 0 && taxableAmount > 0 && vatAmount === 0) {
      vatAmount = Number((totalAmount - taxableAmount).toFixed(2));
    }

    // Se ancora 0, cerca l'importo più grande nel documento
    if (totalAmount === 0) {
      const allNumbers = (fullText.match(/€?\s*[\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})/g) || [])
        .map(n => parseBankAmount(n))
        .filter(n => n > 5);
      if (allNumbers.length > 0) {
        totalAmount = Math.max(...allNumbers);
        taxableAmount = Number((totalAmount / 1.22).toFixed(2));
        vatAmount = Number((totalAmount - taxableAmount).toFixed(2));
      }
    }

    const competenceMonth = issueDate.substring(0, 7);
    const category = isPassive ? 'Materiale Idraulico e Forniture' : 'Impianti Termoidraulici';

    const parsedInvoice: ParsedPdfInvoice = {
      id: `inv-pdf-${docNumber.replace(/[^\w\d]/g, '')}-${issueDate}`,
      number: docNumber,
      type: isPassive ? 'passive' : 'active',
      counterpartId: 'custom-cp',
      counterpartName,
      issueDate,
      economicCompetenceMonth: competenceMonth,
      dueDate,
      taxableAmount,
      vatAmount,
      totalAmount,
      category,
      status: 'issued', // Sempre aperta per consentire allineamento bancario
      isWithholdingApplicable: isWithholding,
      withholdingRate: isWithholding ? (withholdingAmount > 0 && taxableAmount > 0 ? Number((withholdingAmount / taxableAmount).toFixed(2)) : 0.11) : undefined,
      withholdingAmount: isWithholding ? withholdingAmount : 0,
      outstandingAmount: totalAmount,
      isActive: true,
      importedFrom: `PDF: ${fileName}`,
      sourceFileType: 'pdf',
      confidenceScore: (docNumber && totalAmount > 0 && counterpartName !== 'Fornitore' && counterpartName !== 'Cliente') ? 0.95 : 0.75
    };

    return {
      fileName,
      invoices: [parsedInvoice]
    };
  } catch (err: any) {
    return {
      fileName,
      invoices: [],
      error: `Errore durante il parsing del PDF della fattura: ${err.message}`
    };
  }
}
