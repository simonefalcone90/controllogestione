import { Invoice, EntityCounterpart } from '../financial-engine/types';
import { syncEntitiesFromInvoices } from '../financial-engine/calculations';
import { parsePdfInvoice, ParsedPdfInvoice } from './pdf-invoice-parser';
import JSZip from 'jszip';

export interface InvoiceImportResult {
  fileName: string;
  sourceType: 'zip' | 'xml' | 'pdf' | 'csv';
  importedInvoices: Invoice[];
  duplicatesCount: number;
  newCount: number;
  activeCount: number;
  passiveCount: number;
  totalAmountSum: number;
  error?: string;
}

/**
 * Parsing di una singola stringa XML FatturaPA (SDI).
 */
export function parseSingleInvoiceXml(xmlStr: string, defaultName = 'fattura.xml'): Partial<Invoice> | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr, 'application/xml');

    const numeroDoc = doc.querySelector('DatiGeneraliDocumento > Numero')?.textContent || defaultName.replace(/\.xml/i, '');
    const dataDoc = doc.querySelector('DatiGeneraliDocumento > Data')?.textContent || new Date().toISOString().split('T')[0];
    const importoTotale = parseFloat(doc.querySelector('DatiGeneraliDocumento > ImportoTotaleDocumento')?.textContent || '0');
    
    // Cedente (Fornitore per passive, Elacus per attive)
    const denomCedente = doc.querySelector('CedentePrestatore Denominazione')?.textContent ||
                        doc.querySelector('CedentePrestatore Nome')?.textContent || 'Fornitore';
    
    // Cessionario (Cliente per attive, Elacus per passive)
    const denomCessionario = doc.querySelector('CessionarioCommittente Denominazione')?.textContent ||
                            doc.querySelector('CessionarioCommittente Nome')?.textContent || 'Cliente';

    // Rileva se passiva o attiva in base a chi è Elacus
    const isPassive = denomCessionario.toLowerCase().includes('elacus');
    const counterpart = isPassive ? denomCedente : denomCessionario;

    const total = importoTotale > 0 ? importoTotale : 0;
    const taxable = Number((total / 1.22).toFixed(2));
    const vat = Number((total - taxable).toFixed(2));

    return {
      number: numeroDoc,
      type: isPassive ? 'passive' : 'active',
      counterpartName: counterpart,
      issueDate: dataDoc,
      economicCompetenceMonth: dataDoc.substring(0, 7),
      dueDate: dataDoc,
      taxableAmount: taxable,
      vatAmount: vat,
      totalAmount: total,
      category: isPassive ? 'Materiale Idraulico e Forniture' : 'Impianti Termoidraulici',
      status: 'issued', // Sempre aperta per consentire allineamento bancario!
      outstandingAmount: total,
      amountCreditedByBank: 0,
      amountPaidByClient: 0,
      withholdingAmount: 0,
      isActive: true,
      importedFrom: 'SDI XML / Fattura Elettronica'
    };
  } catch (err) {
    console.error('Errore parsing XML fattura:', err);
    return null;
  }
}

/**
 * Importatore universale di fatture da qualsiasi file (PDF, XML, ZIP, CSV).
 */
export async function importInvoicesFromFile(params: {
  file: File;
  existingInvoices: Invoice[];
  currentEntities: EntityCounterpart[];
}): Promise<InvoiceImportResult> {
  const { file, existingInvoices, currentEntities } = params;
  const fileName = file.name;
  const lowerName = fileName.toLowerCase();

  const existingKeys = new Set(
    existingInvoices.map(i => `${i.type}_${i.number.trim().toLowerCase()}_${i.issueDate}`)
  );

  let rawParsedList: Invoice[] = [];
  let detectedSource: InvoiceImportResult['sourceType'] = 'xml';

  // 1. File ZIP (esportazioni massive Aruba o cassetto fiscale)
  if (lowerName.endsWith('.zip')) {
    detectedSource = 'zip';
    try {
      const zip = new JSZip();
      const loadedZip = await zip.loadAsync(file);

      for (const [relPath, zipEntry] of Object.entries(loadedZip.files)) {
        if (!zipEntry.dir && (relPath.toLowerCase().endsWith('.xml') || relPath.toLowerCase().endsWith('.xml.p7m'))) {
          const content = await zipEntry.async('string');
          const p = parseSingleInvoiceXml(content, relPath);
          if (p && p.number) {
            rawParsedList.push({
              id: `inv-zip-${p.number}-${p.issueDate}`,
              number: p.number,
              type: p.type || 'passive',
              counterpartId: 'sdi-partner',
              counterpartName: p.counterpartName || 'Controparte SDI',
              issueDate: p.issueDate || new Date().toISOString().split('T')[0],
              economicCompetenceMonth: (p.issueDate || '').substring(0, 7) || new Date().toISOString().substring(0, 7),
              dueDate: p.dueDate || p.issueDate || new Date().toISOString().split('T')[0],
              taxableAmount: p.taxableAmount || 0,
              vatAmount: p.vatAmount || 0,
              totalAmount: p.totalAmount || 0,
              category: p.category || 'Generale',
              status: 'issued', // Aperta per allineamento bancario!
              outstandingAmount: p.totalAmount || 0,
              amountPaidByClient: 0,
              amountCreditedByBank: 0,
              withholdingAmount: 0,
              isActive: true,
              importedFrom: `ZIP: ${fileName}`,
              sourceFileType: 'zip'
            });
          }
        }
      }
    } catch (err: any) {
      return {
        fileName,
        sourceType: 'zip',
        importedInvoices: [],
        duplicatesCount: 0,
        newCount: 0,
        activeCount: 0,
        passiveCount: 0,
        totalAmountSum: 0,
        error: `Errore apertura file ZIP: ${err.message}`
      };
    }
  } 
  // 2. File PDF (copie di cortesia, parcelle, fatture fornitori)
  else if (lowerName.endsWith('.pdf')) {
    detectedSource = 'pdf';
    const pdfRes = await parsePdfInvoice(file, fileName);
    if (pdfRes.error) {
      return {
        fileName,
        sourceType: 'pdf',
        importedInvoices: [],
        duplicatesCount: 0,
        newCount: 0,
        activeCount: 0,
        passiveCount: 0,
        totalAmountSum: 0,
        error: pdfRes.error
      };
    }
    rawParsedList = pdfRes.invoices;
  }
  // 3. File XML singolo o P7M
  else if (lowerName.endsWith('.xml') || lowerName.endsWith('.xml.p7m')) {
    detectedSource = 'xml';
    const text = await file.text();
    const p = parseSingleInvoiceXml(text, fileName);
    if (p && p.number) {
      rawParsedList.push({
        id: `inv-xml-${p.number}-${p.issueDate}`,
        number: p.number,
        type: p.type || 'passive',
        counterpartId: 'sdi-partner',
        counterpartName: p.counterpartName || 'Controparte SDI',
        issueDate: p.issueDate || new Date().toISOString().split('T')[0],
        economicCompetenceMonth: (p.issueDate || '').substring(0, 7) || new Date().toISOString().substring(0, 7),
        dueDate: p.dueDate || p.issueDate || new Date().toISOString().split('T')[0],
        taxableAmount: p.taxableAmount || 0,
        vatAmount: p.vatAmount || 0,
        totalAmount: p.totalAmount || 0,
        category: p.category || 'Generale',
        status: 'issued',
        outstandingAmount: p.totalAmount || 0,
        amountPaidByClient: 0,
        amountCreditedByBank: 0,
        withholdingAmount: 0,
        isActive: true,
        importedFrom: `XML: ${fileName}`,
        sourceFileType: 'xml'
      });
    }
  }

  // Deduplicazione rispetto alle fatture già presenti
  const newInvoices: Invoice[] = [];
  let duplicates = 0;
  let activeCount = 0;
  let passiveCount = 0;
  let totalAmountSum = 0;

  rawParsedList.forEach(inv => {
    const key = `${inv.type}_${inv.number.trim().toLowerCase()}_${inv.issueDate}`;
    if (!existingKeys.has(key)) {
      newInvoices.push(inv);
      existingKeys.add(key);
      totalAmountSum += inv.totalAmount;
      if (inv.type === 'active') activeCount++;
      else passiveCount++;
    } else {
      duplicates++;
    }
  });

  return {
    fileName,
    sourceType: detectedSource,
    importedInvoices: newInvoices,
    duplicatesCount: duplicates,
    newCount: newInvoices.length,
    activeCount,
    passiveCount,
    totalAmountSum: Number(totalAmountSum.toFixed(2))
  };
}
