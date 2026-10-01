import { BankTransaction } from '../financial-engine/types';
import { generateTransactionHash } from '../financial-engine/calculations';
import { parseBankAmount, parseBankDate, StatementParseResult, ParsedStatementTransaction } from './bank-statement-parser';
import { extractTextFromPdf, ExtractedPdfDocument } from './pdf-text-extractor';

/**
 * Estrae una controparte probabile dalla causale bancaria.
 */
function extractCounterpart(description: string): string | undefined {
  const upper = description.toUpperCase();
  if (upper.includes('DISPOSTO DA') || upper.includes('DA ') || upper.includes('ORDINANTE')) {
    const match = description.match(/(?:DISPOSTO DA|DA|ORDINANTE)\s+([A-Z0-9\s\.\-]{3,35})/i);
    if (match && match[1]) return match[1].trim();
  }
  if (upper.includes('A FAVORE DI') || upper.includes('BENEFICIARIO')) {
    const match = description.match(/(?:A FAVORE DI|BENEFICIARIO)\s+([A-Z0-9\s\.\-]{3,35})/i);
    if (match && match[1]) return match[1].trim();
  }
  if (upper.includes('F24')) return 'Agenzia delle Entrate (Erario/INPS)';
  if (upper.includes('STIPENDI') || upper.includes('EMOLUMENTI') || upper.includes('SALARI')) return 'Personale Dipendente Elacus';
  if (upper.includes('TELEPASS')) return 'Telepass SpA';
  if (upper.includes('ENEL') || upper.includes('ENI') || upper.includes('A2A')) return 'Utenze Energia';
  return undefined;
}

/**
 * Parser per estratti conto e liste movimenti bancari in formato PDF.
 */
export async function parsePdfBankStatement(params: {
  file: File | ArrayBuffer;
  fileName?: string;
  bankAccountId: string;
  currentBankBalance: number;
  existingTransactions: BankTransaction[];
}): Promise<StatementParseResult> {
  const { file, fileName = 'estratto_conto.pdf', bankAccountId, currentBankBalance, existingTransactions } = params;
  
  const extractedDoc = await extractTextFromPdf(file, fileName);
  const existingHashes = new Set(existingTransactions.map(t => t.hash));

  const allLines: string[] = [];
  extractedDoc.pages.forEach(p => {
    allLines.push(...p.lines);
  });

  if (allLines.length === 0) {
    return {
      bankAccountId,
      fileName,
      transactions: [],
      newTransactionsCount: 0,
      duplicatesCount: 0,
      totalInflows: 0,
      totalOutflows: 0,
      netMovement: 0,
      error: 'Nessun testo o movimento rilevabile nel documento PDF fornito.'
    };
  }

  let detectedOpening: number | undefined;
  let detectedClosing: number | undefined;

  // Cerca saldi iniziale e finale nelle righe
  for (const line of allLines) {
    const lower = line.toLowerCase();
    if (lower.includes('saldo iniziale') || lower.includes('saldo precedente') || lower.includes('saldo a inizio')) {
      const match = line.match(/[-+]?\s*[\d\.\,]+/);
      if (match) {
        detectedOpening = parseBankAmount(match[0]);
      }
    }
    if (lower.includes('saldo finale') || lower.includes('saldo contabile finale') || lower.includes('saldo attuale') || lower.includes('saldo a fine')) {
      const match = line.match(/[-+]?\s*[\d\.\,]+/);
      if (match) {
        detectedClosing = parseBankAmount(match[0]);
      }
    }
  }

  const parsedTransactions: ParsedStatementTransaction[] = [];
  const dateRegex = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/g;

  // Analisi delle righe dei movimenti
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    const dates = line.match(dateRegex);

    if (dates && dates.length >= 1) {
      // Potenziale riga di movimento
      const rawDate1 = dates[0];
      const rawDate2 = dates.length > 1 ? dates[1] : dates[0];
      const date = parseBankDate(rawDate1);
      const valueDate = parseBankDate(rawDate2);

      // Cerca numeri che sembrano importi monetari (es. 1.250,50 o -450,00 o 350,00-)
      const amountMatches = line.match(/[-+]?\s*[\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})|-?\s*[\d]+,[\d]{2}/g);

      if (amountMatches && amountMatches.length > 0) {
        // L'ultimo numero valido o quello prima del saldo progressivo è l'importo del movimento
        let amountStr = amountMatches[0];
        let balanceAfter: number | undefined = undefined;

        if (amountMatches.length >= 2) {
          amountStr = amountMatches[amountMatches.length - 2];
          balanceAfter = parseBankAmount(amountMatches[amountMatches.length - 1]);
        } else {
          amountStr = amountMatches[0];
        }

        // Determina se è uscita o entrata analizzando parole chiave o segno
        let amount = parseBankAmount(amountStr);
        const lowerLine = line.toLowerCase();
        
        // Se la riga contiene "dare", "addebit", "uscita", o se è un bonifico "a favore", forza negativo se non lo era
        if ((lowerLine.includes('dare') || lowerLine.includes('addebit') || lowerLine.includes('uscita') || lowerLine.includes('f24') || lowerLine.includes('a favore') || lowerLine.includes('prelievo') || lowerLine.includes('commission')) && amount > 0) {
          amount = -amount;
        }

        // Pulisci la causale rimuovendo date e importi
        let description = line
          .replace(dateRegex, '')
          .replace(/[-+]?\s*[\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        // Se la causale è troppo corta, potrebbe continuare sulla riga successiva
        if (description.length < 10 && i + 1 < allLines.length && !allLines[i + 1].match(dateRegex)) {
          description += ' ' + allLines[i + 1].trim();
        }

        if (!description) {
          description = 'Movimento Estratto Conto PDF';
        }

        if (amount !== 0) {
          const hash = generateTransactionHash(bankAccountId, date, amount, description);
          const isDuplicate = existingHashes.has(hash);

          parsedTransactions.push({
            id: `tx-pdf-${Date.now()}-${parsedTransactions.length}-${Math.floor(Math.random() * 1000)}`,
            date,
            valueDate,
            amount,
            description,
            counterpart: extractCounterpart(description),
            balanceAfter,
            hash,
            isDuplicate
          });
        }
      }
    }
  }

  let totalInflows = 0;
  let totalOutflows = 0;
  let newCount = 0;
  let dupCount = 0;

  parsedTransactions.forEach(tx => {
    if (tx.isDuplicate) {
      dupCount++;
    } else {
      newCount++;
      if (tx.amount > 0) {
        totalInflows += tx.amount;
      } else {
        totalOutflows += Math.abs(tx.amount);
      }
    }
  });

  const netMovement = Number((totalInflows - totalOutflows).toFixed(2));
  const calculatedClosing = Number((currentBankBalance + netMovement).toFixed(2));

  return {
    bankAccountId,
    fileName,
    transactions: parsedTransactions,
    newTransactionsCount: newCount,
    duplicatesCount: dupCount,
    totalInflows: Number(totalInflows.toFixed(2)),
    totalOutflows: Number(totalOutflows.toFixed(2)),
    netMovement,
    detectedOpeningBalance: detectedOpening,
    detectedClosingBalance: detectedClosing,
    calculatedClosingBalance: calculatedClosing
  };
}
