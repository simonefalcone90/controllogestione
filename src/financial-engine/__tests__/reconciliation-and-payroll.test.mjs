import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findBankReconciliationMatches,
  reconcileInvoiceWithTransaction,
  unreconcileInvoiceTransaction,
  validatePayrollCalculations,
  matchBankWithPayroll
} from '../calculations.mjs';

test('Riconciliazione: Match esatto per fattura passiva fornitore', () => {
  const transactions = [
    {
      id: 'tx-1',
      bankAccountId: 'bank-1',
      date: '2026-09-25',
      valueDate: '2026-09-25',
      amount: -14200.00,
      description: 'BONIFICO SEPA A FAVORE DI VAILLANT GROUP SALDO FT 889',
      counterpart: 'Vaillant Group',
      reconciled: false,
      importedAt: '2026-09-26',
      hash: 'hash-tx-1'
    }
  ];

  const invoices = [
    {
      id: 'inv-vaillant-889',
      number: '889',
      type: 'passive',
      counterpartId: 'cp-vaillant',
      counterpartName: 'Vaillant Group Italia SpA',
      issueDate: '2026-08-30',
      economicCompetenceMonth: '2026-08',
      dueDate: '2026-09-30',
      taxableAmount: 11639.34,
      vatAmount: 2560.66,
      totalAmount: 14200.00,
      category: 'Materiale Idraulico e Forniture',
      status: 'issued',
      outstandingAmount: 14200.00,
      isActive: true
    }
  ];

  const suggestions = findBankReconciliationMatches({ transactions, invoices });

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].matchedInvoice.id, 'inv-vaillant-889');
  assert.equal(suggestions[0].confidenceLabel, 'alta');
  assert.equal(suggestions[0].suggestedSettlement.totalPaid, 14200.00);
  assert.equal(suggestions[0].suggestedSettlement.outstandingAfter, 0);

  // Esecuzione riconciliazione
  const { updatedInvoice, updatedTransaction } = reconcileInvoiceWithTransaction({
    invoice: invoices[0],
    transaction: transactions[0]
  });

  assert.equal(updatedInvoice.status, 'paid');
  assert.equal(updatedInvoice.outstandingAmount, 0);
  assert.equal(updatedInvoice.bankTransactionId, 'tx-1');
  assert.equal(updatedTransaction.reconciled, true);
  assert.equal(updatedTransaction.reconciledWithId, 'inv-vaillant-889');

  // Test Scollega (Undo)
  const undone = unreconcileInvoiceTransaction({
    invoice: updatedInvoice,
    transaction: updatedTransaction
  });

  assert.equal(undone.updatedInvoice.status, 'issued');
  assert.equal(undone.updatedInvoice.outstandingAmount, 14200.00);
  assert.equal(undone.updatedInvoice.bankTransactionId, undefined);
  assert.equal(undone.updatedTransaction.reconciled, false);
});

test('Riconciliazione: Bonifico parlante ecobonus con ritenuta 11% ex L. 213/2023', () => {
  // Fattura attiva da 12.200 € lordi (10.000 € imponibile + 2.200 € IVA)
  // Il cliente versa 12.200 €. La banca trattiene l'11% su 10.000 € (1.100 €) e accredita 11.100 €
  const transactions = [
    {
      id: 'tx-cred-1',
      bankAccountId: 'bank-1',
      date: '2026-09-28',
      valueDate: '2026-09-28',
      amount: 11100.00, // Netto accreditato dalla banca
      description: 'BONIFICO PARLANTE DISPOSTO DA CONDOMINIO BELVEDERE FT 103 ECOBONUS',
      counterpart: 'Condominio Belvedere',
      reconciled: false,
      importedAt: '2026-09-28',
      hash: 'hash-tx-cred-1'
    }
  ];

  const invoices = [
    {
      id: 'inv-belvedere-103',
      number: '103',
      type: 'active',
      counterpartId: 'cp-belvedere',
      counterpartName: 'Condominio Belvedere',
      issueDate: '2026-09-01',
      economicCompetenceMonth: '2026-09',
      dueDate: '2026-09-30',
      taxableAmount: 10000.00,
      vatAmount: 2200.00,
      totalAmount: 12200.00,
      category: 'Impianti Termoidraulici',
      status: 'issued',
      outstandingAmount: 12200.00,
      isActive: true
    }
  ];

  const suggestions = findBankReconciliationMatches({ transactions, invoices });

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].matchedInvoice.id, 'inv-belvedere-103');
  assert.equal(suggestions[0].matchReason, 'withholding_parlante');
  assert.equal(suggestions[0].confidenceLabel, 'alta');
  assert.equal(suggestions[0].suggestedSettlement.totalPaid, 12200.00);
  assert.equal(suggestions[0].suggestedSettlement.withholdingAmount, 1100.00);
  assert.equal(suggestions[0].suggestedSettlement.bankCreditedAmount, 11100.00);

  // Esecuzione riconciliazione con bonifico parlante
  const { updatedInvoice, updatedTransaction } = reconcileInvoiceWithTransaction({
    invoice: invoices[0],
    transaction: transactions[0],
    options: { isWithholding: true, withholdingRate: 0.11 }
  });

  assert.equal(updatedInvoice.status, 'paid');
  assert.equal(updatedInvoice.outstandingAmount, 0, 'La ritenuta copre il residuo: nessun insoluto!');
  assert.equal(updatedInvoice.withholdingAmount, 1100.00);
  assert.equal(updatedInvoice.amountCreditedByBank, 11100.00);
  assert.equal(updatedTransaction.reconciled, true);
});

test('Buste Paga: Quadratura calcoli cedolino e segnalazione discrepanza', () => {
  // Cedolino valido
  const validPayroll = {
    id: 'pr-1',
    employeeId: 'emp-8',
    employeeName: 'Guenda Lindo',
    contractType: 'subordinate',
    month: '2026-08',
    grossSalary: 1979.37,
    taxableBaseContributory: 1979.37,
    employeeContributions: 181.90, // 9.19%
    employeeTaxWithheld: 297.47,
    netPaid: 1500.00, // 1979.37 - 181.90 - 297.47 = 1500.00
    employerContributions: 593.81,
    severancePayAccrual: 146.62,
    otherCompanyCosts: 0.00,
    totalCompanyCost: 2719.80,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'draft'
  };

  const validation = validatePayrollCalculations(validPayroll);
  assert.equal(validation.isValid, true);
  assert.equal(validation.netDifference, 0);

  // Cedolino con discrepanza
  const brokenPayroll = {
    ...validPayroll,
    netPaid: 1750.00 // Errore: non quadra con lordo e trattenute
  };
  const brokenValidation = validatePayrollCalculations(brokenPayroll);
  assert.equal(brokenValidation.isValid, false);
  assert.ok(brokenValidation.errors.length > 0);
});

test('Buste Paga: Allineamento con uscite bancarie per stipendi ed F24', () => {
  const payrollRecords = [
    {
      id: 'pr-emp-1',
      employeeId: 'emp-1',
      employeeName: 'Mario Rossi',
      contractType: 'subordinate',
      month: '2026-08',
      grossSalary: 2000.00,
      taxableBaseContributory: 2000.00,
      employeeContributions: 180.00,
      employeeTaxWithheld: 320.00,
      netPaid: 1500.00,
      employerContributions: 600.00,
      severancePayAccrual: 150.00,
      otherCompanyCosts: 0.00,
      totalCompanyCost: 2750.00,
      isCompanyCostConfirmed: true,
      source: 'job_sistemi_import',
      status: 'draft'
    },
    {
      id: 'pr-emp-2',
      employeeId: 'emp-2',
      employeeName: 'Luigi Bianchi',
      contractType: 'subordinate',
      month: '2026-08',
      grossSalary: 2500.00,
      taxableBaseContributory: 2500.00,
      employeeContributions: 230.00,
      employeeTaxWithheld: 470.00,
      netPaid: 1800.00,
      employerContributions: 750.00,
      severancePayAccrual: 185.00,
      otherCompanyCosts: 0.00,
      totalCompanyCost: 3435.00,
      isCompanyCostConfirmed: true,
      source: 'job_sistemi_import',
      status: 'draft'
    }
  ];

  // Totale netti stipendi = 1500 + 1800 = 3300 €
  // F24 = Ritenute (320+470=790) + INPS (180+230+600+750=1760) = 2550 €
  const transactions = [
    {
      id: 'tx-stipendi',
      bankAccountId: 'bank-1',
      date: '2026-09-10',
      valueDate: '2026-09-10',
      amount: -3300.00,
      description: 'BONIFICO CUMULATIVO EMOLUMENTI DIPENDENTI AGOSTO 2026',
      reconciled: false,
      importedAt: '2026-09-11',
      hash: 'h-stip'
    },
    {
      id: 'tx-f24',
      bankAccountId: 'bank-1',
      date: '2026-09-16',
      valueDate: '2026-09-16',
      amount: -2550.00,
      description: 'DELEGA F24 TELEMATICO RITENUTE E INPS DIPENDENTI 2026-08',
      reconciled: false,
      importedAt: '2026-09-17',
      hash: 'h-f24'
    }
  ];

  const matchRes = matchBankWithPayroll({
    transactions,
    payrollRecords,
    month: '2026-08'
  });

  assert.equal(matchRes.totalNetToPay, 3300.00);
  assert.equal(matchRes.suggestedMatches.length, 2);
  assert.equal(matchRes.suggestedMatches[0].type, 'cumulative_salaries');
  assert.equal(matchRes.suggestedMatches[1].type, 'f24_taxes');
});
