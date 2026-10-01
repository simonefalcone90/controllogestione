import { PayrollRecord, Employee } from '../financial-engine/types';
import { validatePayrollCalculations } from '../financial-engine/calculations';
import { parseBankAmount } from './bank-statement-parser';
import { extractTextFromPdf, ExtractedPdfDocument } from './pdf-text-extractor';

export interface ParsedPdfPayrollRecord extends PayrollRecord {
  pageNumber: number;
  validationDetails?: ReturnType<typeof validatePayrollCalculations>;
}

export interface PayrollPdfParseResult {
  fileName: string;
  month: string;
  records: ParsedPdfPayrollRecord[];
  totalGross: number;
  totalNet: number;
  totalCompanyCost: number;
  allValid: boolean;
  error?: string;
}

const ITALIAN_MONTH_MAP: Record<string, string> = {
  gennaio: '01',
  febbraio: '02',
  marzo: '03',
  aprile: '04',
  maggio: '05',
  giugno: '06',
  luglio: '07',
  agosto: '08',
  settembre: '09',
  ottobre: '10',
  novembre: '11',
  dicembre: '12',
  gen: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  mag: '05',
  giu: '06',
  lug: '07',
  ago: '08',
  set: '09',
  ott: '10',
  nov: '11',
  dic: '12'
};

/**
 * Estrae il mese di competenza in formato YYYY-MM da una stringa o testo.
 */
function extractMonthFromText(text: string): string {
  const lower = text.toLowerCase();
  
  // Formato: Agosto 2026 o Ago 2026
  for (const [name, num] of Object.entries(ITALIAN_MONTH_MAP)) {
    const regex = new RegExp(`(?:mese\\s*(?:di)?|competenza|periodo)?\\s*${name}\\s*(?:20)?(\\d{2,4})`, 'i');
    const match = lower.match(regex);
    if (match) {
      let year = match[1];
      if (year.length === 2) year = `20${year}`;
      return `${year}-${num}`;
    }
  }

  // Formato: MM/YYYY o MM-YYYY
  const numMatch = lower.match(/\b(0[1-9]|1[0-2])[\/\-](20\d{2})\b/);
  if (numMatch) {
    return `${numMatch[2]}-${numMatch[1]}`;
  }

  // Default: mese precedente rispetto a oggi
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().substring(0, 7);
}

/**
 * Parser per file PDF contenenti cedolini e buste paga (singole o cumulative).
 */
export async function parsePdfPayroll(
  fileOrBuffer: File | ArrayBuffer,
  fileName = 'cedolini.pdf',
  knownEmployees: Employee[] = []
): Promise<PayrollPdfParseResult> {
  try {
    const extractedDoc = await extractTextFromPdf(fileOrBuffer, fileName);

    if (extractedDoc.pages.length === 0 || !extractedDoc.fullText.trim()) {
      return {
        fileName,
        month: new Date().toISOString().substring(0, 7),
        records: [],
        totalGross: 0,
        totalNet: 0,
        totalCompanyCost: 0,
        allValid: false,
        error: 'Nessun testo rilevabile nel file PDF dei cedolini.'
      };
    }

    const detectedMonth = extractMonthFromText(extractedDoc.fullText);
    const parsedRecords: ParsedPdfPayrollRecord[] = [];

    // Ogni pagina può rappresentare un cedolino dipendente
    for (const page of extractedDoc.pages) {
      const pageText = page.text;
      const lower = pageText.toLowerCase();

      // Cerca Codice Fiscale (16 caratteri alfanumerici italiani)
      const cfMatch = pageText.match(/\b([A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z])\b/i);
      const taxCode = cfMatch ? cfMatch[1].toUpperCase() : '';

      // Cerca corrispondenza con un dipendente noto tramite Codice Fiscale o Nome
      let matchedEmployee = knownEmployees.find(e => taxCode && e.taxCode.toUpperCase() === taxCode);
      let employeeName = matchedEmployee ? matchedEmployee.fullName : '';

      if (!matchedEmployee) {
        // Cerca per nome tra i dipendenti noti
        for (const emp of knownEmployees) {
          const nameParts = emp.fullName.toLowerCase().split(/\s+/);
          if (nameParts.every(p => lower.includes(p))) {
            matchedEmployee = emp;
            employeeName = emp.fullName;
            break;
          }
        }
      }

      // Se non trovato tra i dipendenti noti, estrai il nome dalla pagina
      if (!employeeName) {
        const nameMatch = pageText.match(/(?:dipendente|collaboratore|nominativo|cognome\s*e\s*nome|lavoratore)\s*[:\s]*([A-Z\s]{3,35})/i);
        if (nameMatch && nameMatch[1]) {
          employeeName = nameMatch[1].trim();
        } else {
          // Prendi la prima riga con lettere maiuscole plausibili
          const candidateLines = page.lines.filter(l => l.length > 5 && !l.toLowerCase().includes('cedolino') && !l.toLowerCase().includes('srl') && !l.toLowerCase().includes('inps'));
          employeeName = candidateLines[0] || `Dipendente Pag. ${page.pageNumber}`;
        }
      }

      const contractType = matchedEmployee?.contractType || (lower.includes('gestione separata') || lower.includes('co.co.co') || lower.includes('collaborazione') ? 'cococo' : 'subordinate');

      // Estrazione Competenze / Lordo
      let grossSalary = 0;
      const grossPatterns = [
        /(?:totale\s*competenze|lordo\s*(?:mese)?|retribuzione\s*lorda|compenso\s*lordo)\s*[:\s]*€?\s*([0-9\.\,]+)/i,
        /(?:competenze)\s*[:\s]*€?\s*([0-9\.\,]+)/i
      ];
      for (const pat of grossPatterns) {
        const match = pageText.match(pat);
        if (match && match[1]) {
          grossSalary = parseBankAmount(match[1]);
          if (grossSalary > 0) break;
        }
      }

      // Estrazione Netto in Busta / Netto del Mese
      let netPaid = 0;
      const netPatterns = [
        /(?:netto\s*(?:in\s*busta|del\s*mese|a\s*pagare|retribuzione\s*netta))\s*[:\s]*€?\s*([0-9\.\,]+)/i,
        /(?:totale\s*netto)\s*[:\s]*€?\s*([0-9\.\,]+)/i
      ];
      for (const pat of netPatterns) {
        const match = pageText.match(pat);
        if (match && match[1]) {
          netPaid = parseBankAmount(match[1]);
          if (netPaid > 0) break;
        }
      }

      // Estrazione Contributi c/Dipendente
      let employeeContributions = 0;
      const contribPatterns = [
        /(?:totale\s*trattenute\s*previdenziali|contributi\s*c\s*\/\s*dipendente|ritenute\s*inps|contributi\s*ivs)\s*[:\s]*€?\s*([0-9\.\,]+)/i,
        /(?:trattenute\s*previdenziali)\s*[:\s]*€?\s*([0-9\.\,]+)/i
      ];
      for (const pat of contribPatterns) {
        const match = pageText.match(pat);
        if (match && match[1]) {
          employeeContributions = parseBankAmount(match[1]);
          if (employeeContributions > 0) break;
        }
      }

      // Estrazione IRPEF e Trattenute Fiscali
      let employeeTaxWithheld = 0;
      const taxPatterns = [
        /(?:irpef\s*netta|trattenute\s*fiscali|ritenute\s*irpef|imposta\s*netta)\s*[:\s]*€?\s*([0-9\.\,]+)/i,
        /(?:totale\s*trattenute\s*fiscali)\s*[:\s]*€?\s*([0-9\.\,]+)/i
      ];
      for (const pat of taxPatterns) {
        const match = pageText.match(pat);
        if (match && match[1]) {
          employeeTaxWithheld = parseBankAmount(match[1]);
          if (employeeTaxWithheld > 0) break;
        }
      }

      // Estrazione Oneri c/Azienda, TFR, Cassa Edile se presenti nella pagina o prospetto
      let employerContributions = 0;
      const employerContribMatch = pageText.match(/(?:contributi\s*c\s*\/\s*azienda|oneri\s*c\s*\/\s*ditta|totale\s*inps\s*azienda)\s*[:\s]*€?\s*([0-9\.\,]+)/i);
      if (employerContribMatch && employerContribMatch[1]) {
        employerContributions = parseBankAmount(employerContribMatch[1]);
      }

      let severancePayAccrual = 0;
      const tfrMatch = pageText.match(/(?:quota\s*tfr|rateo\s*tfr|tfr\s*maturato|accantonamento\s*tfr)\s*[:\s]*€?\s*([0-9\.\,]+)/i);
      if (tfrMatch && tfrMatch[1]) {
        severancePayAccrual = parseBankAmount(tfrMatch[1]);
      }

      let otherCompanyCosts = 0;
      const cassaEdileMatch = pageText.match(/(?:cassa\s*edile|fondi\s*integrativi|altri\s*oneri)\s*[:\s]*€?\s*([0-9\.\,]+)/i);
      if (cassaEdileMatch && cassaEdileMatch[1]) {
        otherCompanyCosts = parseBankAmount(cassaEdileMatch[1]);
      }

      // Se mancano contributi dipendente o IRPEF ma abbiamo lordo e netto, stima o bilancia
      if (grossSalary > 0 && netPaid > 0 && employeeContributions === 0 && employeeTaxWithheld === 0) {
        const totalDeductions = Number((grossSalary - netPaid).toFixed(2));
        if (totalDeductions > 0) {
          // Stima tipica: 9.19% contributi IVS subordinati o 11% Co.Co.Co., il resto IRPEF
          const estimatedInpsRate = contractType === 'cococo' ? 0.11 : 0.0919;
          employeeContributions = Number((grossSalary * estimatedInpsRate).toFixed(2));
          employeeTaxWithheld = Number(Math.max(0, totalDeductions - employeeContributions).toFixed(2));
        }
      } else if (grossSalary > 0 && netPaid === 0) {
        netPaid = Number((grossSalary - employeeContributions - employeeTaxWithheld).toFixed(2));
      }

      // Se non sono presenti oneri aziendali espliciti, stima prudenziale
      const hasExplicitCompanyCost = employerContributions > 0 || severancePayAccrual > 0;
      if (!hasExplicitCompanyCost && grossSalary > 0) {
        if (contractType === 'cococo') {
          employerContributions = Number((grossSalary * 0.2335).toFixed(2)); // Quota 2/3 gestione separata
          severancePayAccrual = 0;
          otherCompanyCosts = 0;
        } else {
          employerContributions = Number((grossSalary * 0.30).toFixed(2)); // INPS c/ditta + INAIL
          severancePayAccrual = Number((grossSalary / 13.5).toFixed(2)); // ~7.41% TFR
          otherCompanyCosts = 0;
        }
      }

      const totalCompanyCost = Number((grossSalary + employerContributions + severancePayAccrual + otherCompanyCosts).toFixed(2));
      const isConfirmed = hasExplicitCompanyCost;

      // Crea il record
      const record: ParsedPdfPayrollRecord = {
        id: `pr-pdf-${detectedMonth}-${matchedEmployee?.id || `emp-${page.pageNumber}`}`,
        employeeId: matchedEmployee?.id || `emp-pdf-${page.pageNumber}`,
        employeeName,
        contractType,
        month: detectedMonth,
        grossSalary,
        taxableBaseContributory: grossSalary,
        employeeContributions,
        employeeTaxWithheld,
        netPaid,
        employerContributions,
        severancePayAccrual,
        otherCompanyCosts,
        totalCompanyCost,
        isCompanyCostConfirmed: isConfirmed,
        source: 'job_sistemi_import',
        status: 'draft',
        pageNumber: page.pageNumber,
        pdfFileName: fileName
      };

      record.validationDetails = validatePayrollCalculations(record);
      parsedRecords.push(record);
    }

    const totalGross = Number(parsedRecords.reduce((s, r) => s + r.grossSalary, 0).toFixed(2));
    const totalNet = Number(parsedRecords.reduce((s, r) => s + r.netPaid, 0).toFixed(2));
    const totalCompanyCost = Number(parsedRecords.reduce((s, r) => s + r.totalCompanyCost, 0).toFixed(2));
    const allValid = parsedRecords.every(r => r.validationDetails?.isValid);

    return {
      fileName,
      month: detectedMonth,
      records: parsedRecords,
      totalGross,
      totalNet,
      totalCompanyCost,
      allValid
    };
  } catch (err: any) {
    return {
      fileName,
      month: new Date().toISOString().substring(0, 7),
      records: [],
      totalGross: 0,
      totalNet: 0,
      totalCompanyCost: 0,
      allValid: false,
      error: `Errore durante il parsing del PDF dei cedolini: ${err.message}`
    };
  }
}
