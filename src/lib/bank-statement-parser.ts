import { BankTransaction } from '../financial-engine/types';
import { generateTransactionHash } from '../financial-engine/calculations';

export interface ParsedStatementTransaction {
  id: string;
  date: string;
  valueDate: string;
  amount: number;
  description: string;
  counterpart?: string;
  balanceAfter?: number;
  hash: string;
  isDuplicate: boolean;
}

export interface StatementParseResult {
  bankAccountId: string;
  fileName: string;
  transactions: ParsedStatementTransaction[];
  newTransactionsCount: number;
  duplicatesCount: number;
  totalInflows: number;
  totalOutflows: number;
  netMovement: number;
  detectedOpeningBalance?: number;
  detectedClosingBalance?: number;
  calculatedClosingBalance?: number;
  error?: string;
}

/**
 * Normalizza una stringa numerica bancaria (es. "-1.450,20", "1.234,56 €", "(500,00)", "1234.56") in un float.
 */
export function parseBankAmount(raw: string | undefined | null): number {
  if (!raw) return 0;
  let str = raw.trim().replace(/€|\s|EUR/gi, '');
  if (!str) return 0;

  // Gestione formato contabile tra parentesi es. (150,00) -> negativo
  const isParenNegative = /^\(.*\)$/.test(str);
  if (isParenNegative) {
    str = str.replace(/[()]/g, '');
  }

  // Gestione segno alla fine es. "120,50-"
  let isSuffixNegative = false;
  if (str.endsWith('-')) {
    isSuffixNegative = true;
    str = str.slice(0, -1).trim();
  }

  // Gestione formato italiano con punto per le migliaia e virgola per decimali (1.250,50)
  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // Formato italiano 1.250,50
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato anglosassone 1,250.50
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Solo virgola (es. 1250,50)
    str = str.replace(',', '.');
  }

  const parsed = parseFloat(str);
  if (isNaN(parsed)) return 0;
  let finalVal = isParenNegative || isSuffixNegative ? -Math.abs(parsed) : parsed;
  return Number(finalVal.toFixed(2));
}

/**
 * Normalizza date bancarie (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD.MM.YYYY) in formato ISO YYYY-MM-DD.
 */
export function parseBankDate(raw: string | undefined | null): string {
  if (!raw) return new Date().toISOString().split('T')[0];
  const cleaned = raw.trim().replace(/[^\d\/\-\.]/g, '');

  // Formato YYYY-MM-DD
  if (/^\d{4}[\-\/\.]\d{1,2}[\-\/\.]\d{1,2}$/.test(cleaned)) {
    const parts = cleaned.split(/[\-\/\.]/);
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }

  // Formato DD/MM/YYYY o DD-MM-YYYY o DD.MM.YYYY
  if (/^\d{1,2}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4}$/.test(cleaned)) {
    const parts = cleaned.split(/[\-\/\.]/);
    let year = parts[2];
    if (year.length === 2) {
      year = `20${year}`;
    }
    return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Estrae una controparte probabile dalla causale bancaria.
 */
function extractCounterpart(description: string): string | undefined {
  const upper = description.toUpperCase();
  if (upper.includes('DISPOSTO DA') || upper.includes('DA ') || upper.includes('ORDINANTE')) {
    const match = description.match(/(?:DISPOSTO DA|DA|ORDINANTE)\s+([A-Z0-9\s\.\-]{3,30})/i);
    if (match && match[1]) return match[1].trim();
  }
  if (upper.includes('A FAVORE DI') || upper.includes('BENEFICIARIO')) {
    const match = description.match(/(?:A FAVORE DI|BENEFICIARIO)\s+([A-Z0-9\s\.\-]{3,30})/i);
    if (match && match[1]) return match[1].trim();
  }
  if (upper.includes('F24')) return 'Agenzia delle Entrate';
  if (upper.includes('STIPENDI') || upper.includes('EMOLUMENTI')) return 'Personale Dipendente';
  return undefined;
}

/**
 * Parser universale per file CSV/TSV esportati da remote banking italiani.
 */
export function parseBankStatementFile(params: {
  fileContent: string;
  fileName: string;
  bankAccountId: string;
  currentBankBalance: number;
  existingTransactions: BankTransaction[];
}): StatementParseResult {
  const { fileContent, fileName, bankAccountId, currentBankBalance, existingTransactions } = params;

  const existingHashes = new Set(existingTransactions.map(t => t.hash));
  const lines = fileContent.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length === 0) {
    return {
      bankAccountId,
      fileName,
      transactions: [],
      newTransactionsCount: 0,
      duplicatesCount: 0,
      totalInflows: 0,
      totalOutflows: 0,
      netMovement: 0,
      error: 'Il file caricato è vuoto.'
    };
  }

  // Rileva il delimitatore (, ; \t)
  const firstFew = lines.slice(0, 10).join('\n');
  const countSemicolons = (firstFew.match(/;/g) || []).length;
  const countTabs = (firstFew.match(/\t/g) || []).length;
  const countCommas = (firstFew.match(/,/g) || []).length;

  let delimiter = ';';
  if (countTabs > countSemicolons && countTabs > countCommas) {
    delimiter = '\t';
  } else if (countCommas > countSemicolons && countCommas > countTabs) {
    delimiter = ',';
  }

  // Trova la riga di intestazione delle colonne
  let headerIndex = -1;
  let colDate = -1;
  let colValueDate = -1;
  let colDesc = -1;
  let colAmount = -1;
  let colDebit = -1;
  let colCredit = -1;
  let colBalance = -1;

  for (let i = 0; i < Math.min(lines.length, 25); i++) {
    const rawTokens = lines[i].split(delimiter).map(t => t.replace(/^["']|["']$/g, '').trim().toLowerCase());
    
    // Controlla se la riga assomiglia a un'intestazione
    const hasDate = rawTokens.some(t => t.includes('data') || t.includes('date'));
    const hasDesc = rawTokens.some(t => t.includes('causal') || t.includes('descriz') || t.includes('operaz') || t.includes('dettagl'));
    const hasMoney = rawTokens.some(t => t.includes('import') || t.includes('dare') || t.includes('avere') || t.includes('amount') || t.includes('saldo'));

    if (hasDate && (hasDesc || hasMoney)) {
      headerIndex = i;
      rawTokens.forEach((tok, idx) => {
        if ((tok.includes('data') && !tok.includes('valuta')) || tok === 'date') {
          if (colDate === -1) colDate = idx;
        } else if (tok.includes('valuta') || tok.includes('value date')) {
          colValueDate = idx;
        } else if (tok.includes('causal') || tok.includes('descriz') || tok.includes('operaz') || tok.includes('dettagl') || tok.includes('motivo')) {
          if (colDesc === -1) colDesc = idx;
        } else if (tok.includes('import') || tok === 'amount') {
          colAmount = idx;
        } else if (tok.includes('dare') || tok.includes('addebit') || tok.includes('uscita')) {
          colDebit = idx;
        } else if (tok.includes('avere') || tok.includes('accredit') || tok.includes('entrata')) {
          colCredit = idx;
        } else if (tok.includes('saldo') || tok.includes('balance')) {
          colBalance = idx;
        }
      });
      break;
    }
  }

  // Fallback se nessuna intestazione esplicita trovata: prova a indovinare dalle colonne tipiche
  const dataStartLine = headerIndex >= 0 ? headerIndex + 1 : 0;
  const parsedRows: ParsedStatementTransaction[] = [];
  let detectedOpening: number | undefined;
  let detectedClosing: number | undefined;

  for (let i = dataStartLine; i < lines.length; i++) {
    const row = lines[i];
    // Ignora righe con metadati / note finali
    if (row.toLowerCase().includes('totale movimenti') || row.toLowerCase().includes('saldo iniziale') || row.toLowerCase().includes('saldo finale')) {
      const matchBal = row.match(/[-+]?\s*[\d\.\,]+/);
      if (matchBal) {
        const val = parseBankAmount(matchBal[0]);
        if (row.toLowerCase().includes('iniziale')) detectedOpening = val;
        if (row.toLowerCase().includes('finale')) detectedClosing = val;
      }
      continue;
    }

    const tokens = row.split(delimiter).map(t => t.replace(/^["']|["']$/g, '').trim());
    if (tokens.length < 2) continue;

    // Se non avevamo intestazioni, assegna indici plausibili
    if (colDate === -1) colDate = 0;
    if (colDesc === -1) colDesc = tokens.length > 2 ? 1 : 0;
    if (colAmount === -1 && colDebit === -1 && colCredit === -1) {
      colAmount = tokens.length - 1;
    }

    const rawDate = tokens[colDate];
    if (!rawDate || !/\d/.test(rawDate)) continue;

    const date = parseBankDate(rawDate);
    const valueDate = colValueDate >= 0 && tokens[colValueDate] ? parseBankDate(tokens[colValueDate]) : date;
    const description = colDesc >= 0 && tokens[colDesc] ? tokens[colDesc] : 'Movimento Bancario';

    let amount = 0;
    if (colDebit >= 0 && colCredit >= 0) {
      const debitVal = Math.abs(parseBankAmount(tokens[colDebit]));
      const creditVal = Math.abs(parseBankAmount(tokens[colCredit]));
      if (creditVal > 0) amount = creditVal;
      else if (debitVal > 0) amount = -debitVal;
    } else if (colAmount >= 0) {
      amount = parseBankAmount(tokens[colAmount]);
    }

    if (amount === 0 && (!tokens[colDebit] && !tokens[colCredit] && !tokens[colAmount])) {
      continue;
    }

    let balanceAfter: number | undefined = undefined;
    if (colBalance >= 0 && tokens[colBalance]) {
      balanceAfter = parseBankAmount(tokens[colBalance]);
    }

    const hash = generateTransactionHash(bankAccountId, date, amount, description);
    const isDuplicate = existingHashes.has(hash);

    parsedRows.push({
      id: `tx-imp-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
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

  let totalInflows = 0;
  let totalOutflows = 0;
  let newCount = 0;
  let dupCount = 0;

  parsedRows.forEach(tx => {
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

  // Se l'ultima riga dell'estratto conteneva un saldo progressivo, lo usiamo come saldo finale rilevato
  if (parsedRows.length > 0 && detectedClosing === undefined) {
    const lastWithBalance = [...parsedRows].reverse().find(r => r.balanceAfter !== undefined);
    if (lastWithBalance) {
      detectedClosing = lastWithBalance.balanceAfter;
    }
  }

  return {
    bankAccountId,
    fileName,
    transactions: parsedRows,
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

/**
 * Funzione unificata che accetta qualsiasi file di estratto conto (PDF, CSV, TSV)
 * e richiama il parser specializzato corrispondente.
 */
export async function parseUniversalBankStatementFile(params: {
  file: File;
  bankAccountId: string;
  currentBankBalance: number;
  existingTransactions: BankTransaction[];
}): Promise<StatementParseResult> {
  const { file, bankAccountId, currentBankBalance, existingTransactions } = params;
  const fileName = file.name;
  const isPdf = fileName.toLowerCase().endsWith('.pdf');

  if (isPdf) {
    const { parsePdfBankStatement } = await import('./pdf-bank-statement-parser');
    return parsePdfBankStatement({
      file,
      fileName,
      bankAccountId,
      currentBankBalance,
      existingTransactions
    });
  }

  // File CSV / TSV / Testo
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const res = parseBankStatementFile({
        fileContent: text,
        fileName,
        bankAccountId,
        currentBankBalance,
        existingTransactions
      });
      resolve(res);
    };
    reader.onerror = () => {
      resolve({
        bankAccountId,
        fileName,
        transactions: [],
        newTransactionsCount: 0,
        duplicatesCount: 0,
        totalInflows: 0,
        totalOutflows: 0,
        netMovement: 0,
        error: 'Errore durante la lettura del file CSV.'
      });
    };
    reader.readAsText(file, 'ISO-8859-1');
  });
}
