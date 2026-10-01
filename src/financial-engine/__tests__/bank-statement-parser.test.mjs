import test from 'node:test';
import assert from 'node:assert/strict';

import { 
  parseBankAmount, 
  parseBankDate, 
  parseBankStatementFile 
} from '../../lib/bank-statement-parser.mjs';
import { generateTransactionHash } from '../calculations.mjs';

test('Parser Estratto Conto: parsing importi bancari italiani e internazionali', () => {
  assert.equal(parseBankAmount('1.250,50 €'), 1250.50);
  assert.equal(parseBankAmount('-3.400,00'), -3400.00);
  assert.equal(parseBankAmount('(500,00)'), -500.00);
  assert.equal(parseBankAmount('120,50-'), -120.50);
  assert.equal(parseBankAmount('1500.00'), 1500.00);
});

test('Parser Estratto Conto: normalizzazione date bancarie a ISO YYYY-MM-DD', () => {
  assert.equal(parseBankDate('28/09/2026'), '2026-09-28');
  assert.equal(parseBankDate('05-10-2026'), '2026-10-05');
  assert.equal(parseBankDate('2026-09-28'), '2026-09-28');
});

test('Parser Estratto Conto: parsing tracciato CSV bancario con deduplicazione hash', () => {
  const bankAccountId = 'bank-1';
  const csvContent = 
`Data Contabile;Data Valuta;Causale Operazione;Importo;Saldo
28/09/2026;28/09/2026;BONIFICO SEPA DISPOSTO DA CONDOMINIO BELVEDERE;18300,00;45620,50
26/09/2026;26/09/2026;DELEGA F24 TELEMATICO RITENUTE ACQUISTI;-2150,00;27320,50
20/09/2026;20/09/2026;BONIFICO SEPA DISPOSTO DA ROSSI MARIO SALDO FAT. 101 RIT 8%;10120,00;29470,50
`;

  // Simuliamo che il movimento di Rossi Mario del 20/09 sia già registrato nel gestionale
  const existingHash = generateTransactionHash(
    bankAccountId, 
    '2026-09-20', 
    10120.00, 
    'BONIFICO SEPA DISPOSTO DA ROSSI MARIO SALDO FAT. 101 RIT 8%'
  );

  const existingTransactions = [
    {
      id: 'tx-existing-1',
      bankAccountId,
      date: '2026-09-20',
      valueDate: '2026-09-20',
      amount: 10120.00,
      description: 'BONIFICO SEPA DISPOSTO DA ROSSI MARIO SALDO FAT. 101 RIT 8%',
      hash: existingHash,
      reconciled: true,
      importedAt: '2026-09-21'
    }
  ];

  const result = parseBankStatementFile({
    fileContent: csvContent,
    fileName: 'estratto_conto_sett_2026.csv',
    bankAccountId,
    currentBankBalance: 29470.50,
    existingTransactions
  });

  assert.equal(result.transactions.length, 3, 'Tutti e 3 i movimenti devono essere estratti');
  assert.equal(result.duplicatesCount, 1, 'Il movimento già registrato di Rossi Mario deve essere rilevato come duplicato');
  assert.equal(result.newTransactionsCount, 2, 'Devono esserci esattamente 2 nuovi movimenti');
  
  // Entrata: 18300, Uscita: 2150 -> Netto: 16150 (escluso il duplicato)
  assert.equal(result.totalInflows, 18300.00);
  assert.equal(result.totalOutflows, 2150.00);
  assert.equal(result.netMovement, 16150.00);

  // Rilevamento saldo finale dall'ultima colonna saldo
  assert.equal(result.detectedClosingBalance, 29470.50);
});
