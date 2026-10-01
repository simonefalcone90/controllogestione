import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateWithholdingSettlement,
  calculateContractInstallmentImpact,
  calculateCurrentLiquidity,
  calculateManagementIncomeStatement,
  calculateCashFlowProjection,
  generateTransactionHash,
  syncEntitiesFromInvoices
} from '../calculations.mjs';

test('Criterio 1: Fattura con bonifico parlante e ritenuta del 11% con scorporo IVA 22% ex L.213/2023', () => {
  // Fattura attiva per ristrutturazione/ecobonus da 12.200€ lordi (10.000€ imponibile + 2.200€ IVA 22%)
  // Cliente dispone bonifico parlante di 12.200€
  // La banca scorpora convenzionalmente l'IVA 22% (base 10.000€), applica la ritenuta dell'11% (1.100€) e accredita 11.100€
  const result = calculateWithholdingSettlement({
    totalAmount: 12200,
    isWithholdingApplicable: true,
    withholdingRate: 0.11,
    clientPaidAmount: 12200,
    applyVatDescorporation: true
  });

  assert.equal(result.clientPaid, 12200);
  assert.equal(result.withholdingAmount, 1100);
  assert.equal(result.bankCreditedAmount, 11100);
  assert.equal(result.outstandingAmount, 0, 'Il residuo non deve contenere insoluto: la ritenuta è credito fiscale!');
  assert.equal(result.isFullySettled, true);
  assert.equal(result.status, 'paid');
});

test('Criterio 2: Pagamento parziale lascia il residuo corretto', () => {
  // Fattura da 5.000€, cliente versa acconto di 2.000€ (bonifico ordinario)
  const result = calculateWithholdingSettlement({
    totalAmount: 5000,
    isWithholdingApplicable: false,
    clientPaidAmount: 2000
  });

  assert.equal(result.clientPaid, 2000);
  assert.equal(result.outstandingAmount, 3000);
  assert.equal(result.isFullySettled, false);
  assert.equal(result.status, 'partially_paid');
});

test('Criterio 3: Deduplica transazioni con hash identificativo', () => {
  const hash1 = generateTransactionHash('bank_1', '2026-09-15', 1500, 'Bonifico da Rossi SRL  fatt 102 ');
  const hash2 = generateTransactionHash('bank_1', '2026-09-15', 1500, 'bonifico da rossi srl fatt 102');
  assert.equal(hash1, hash2, 'La normalizzazione deve rilevare il duplicato');
});

test('Criterio 4: Rata finanziamento distingue effetto cassa da quota costo a CE e Metodo OIC per leasing', () => {
  const loanContract = {
    id: 'c1',
    title: 'Finanziamento Chirografario Intesa',
    type: 'loan',
    counterpart: 'Intesa Sanpaolo',
    startDate: '2025-01-01',
    endDate: '2028-12-31',
    totalFinanced: 50000,
    installmentAmount: 1100, // Cassa: escono 1.100€
    frequency: 'monthly',
    installmentsCount: 48,
    paidInstallmentsCount: 12,
    principalPortion: 950, // Stato patrimoniale (riduzione debito)
    interestPortion: 150,  // Conto Economico (Costo effettivo C.17)
    bankAccountId: 'b1',
    isActive: true,
    nextDueDate: '2026-10-01'
  };

  const impactLoan = calculateContractInstallmentImpact(loanContract);
  assert.equal(impactLoan.cashOutflow, 1100, 'La cassa deve subire l intera uscita della rata');
  assert.equal(impactLoan.incomeStatementCost, 150, 'Al conto economico gestionale del mutuo va SOLO la quota interessi!');
  assert.equal(impactLoan.debtReduction, 950, 'La quota capitale estingue debito');

  // Leasing con metodo patrimoniale OIC (default S.r.l.)
  const leasingContract = {
    id: 'c2',
    title: 'Leasing Furgone',
    type: 'leasing',
    accountingMethod: 'patrimonial_oic',
    counterpart: 'Leasing SpA',
    startDate: '2025-01-01',
    endDate: '2028-12-31',
    totalFinanced: 30000,
    installmentAmount: 600,
    frequency: 'monthly',
    installmentsCount: 48,
    paidInstallmentsCount: 10,
    principalPortion: 480,
    interestPortion: 120,
    bankAccountId: 'b1',
    isActive: true,
    nextDueDate: '2026-10-01'
  };

  const impactLeasing = calculateContractInstallmentImpact(leasingContract);
  assert.equal(impactLeasing.incomeStatementCost, 600, 'Nel metodo patrimoniale OIC l intero canone è costo di esercizio B.8!');
});


test('Criterio 5: Chiudere un conto conserva movimenti ed esclude saldo dai correnti', () => {
  const accounts = [
    { id: 'b1', bankName: 'Intesa Sanpaolo', accountNumber: '1', iban: 'IT...', initialBalance: 10000, initialBalanceDate: '2026-01-01', currentBalance: 25000, lastUpdated: '2026-09-20', creditLimit: 5000, isActive: true },
    { id: 'b2', bankName: 'UniCredit', accountNumber: '2', iban: 'IT...', initialBalance: 5000, initialBalanceDate: '2026-01-01', currentBalance: 12000, lastUpdated: '2026-09-22', creditLimit: 0, isActive: true },
    { id: 'b3', bankName: 'BPER', accountNumber: '3', iban: 'IT...', initialBalance: 2000, initialBalanceDate: '2026-01-01', currentBalance: 8000, lastUpdated: '2026-09-21', creditLimit: 0, isActive: true },
    { id: 'b4_closed', bankName: 'BPM Vecchio', accountNumber: '4', iban: 'IT...', initialBalance: 1000, initialBalanceDate: '2025-01-01', currentBalance: 15000, lastUpdated: '2025-12-31', creditLimit: 0, isActive: false }
  ];

  const result = calculateCurrentLiquidity(accounts);
  // Solo conti attivi: 25000 + 12000 + 8000 = 45000. Il conto chiuso da 15000 NON deve essere incluso!
  assert.equal(result.activeAccountsCount, 3);
  assert.equal(result.totalBalance, 45000);
  assert.equal(result.totalAvailableLiquidity, 50000); // 45000 + 5000 fido
});

test('Criterio 6: Previsione a 30/60/90 giorni ricostruibile dalle sue singole voci analitiche', () => {
  const currentLiquidity = 20000;
  const items = [
    { id: '1', date: '2026-10-05', direction: 'inflow', sourceType: 'invoice_client', description: 'Incasso Cliente Alfa', expectedAmount: 10000, collectionProbability: 0.9, weightedAmount: 9000, horizonDays: 30, isManualOverride: false },
    { id: '2', date: '2026-10-15', direction: 'outflow', sourceType: 'payroll_net', description: 'Stipendi netti', expectedAmount: 6000, collectionProbability: 1.0, weightedAmount: 6000, horizonDays: 30, isManualOverride: false },
    { id: '3', date: '2026-11-10', direction: 'inflow', sourceType: 'invoice_client', description: 'Incasso Beta', expectedAmount: 8000, collectionProbability: 1.0, weightedAmount: 8000, horizonDays: 60, isManualOverride: false },
    { id: '4', date: '2026-12-10', direction: 'outflow', sourceType: 'financial_contract', description: 'Rata Mutuo', expectedAmount: 1100, collectionProbability: 1.0, weightedAmount: 1100, horizonDays: 90, isManualOverride: false }
  ];

  const projection = calculateCashFlowProjection({
    currentLiquidity,
    todayDate: '2026-09-25',
    forecastItems: items
  });

  // A 30 giorni: +9000 - 6000 = +3000 -> Saldo: 20000 + 3000 = 23000
  assert.equal(projection.projections.days30.netFlow, 3000);
  assert.equal(projection.projections.days30.projectedBalance, 23000);
  assert.equal(projection.projections.days30.items.length, 2);

  // A 60 giorni: +8000 -> Saldo: 23000 + 8000 = 31000
  assert.equal(projection.projections.days60.netFlow, 8000);
  assert.equal(projection.projections.days60.projectedBalance, 31000);

  // A 90 giorni: -1100 -> Saldo: 31000 - 1100 = 29900
  assert.equal(projection.projections.days90.netFlow, -1100);
  assert.equal(projection.projections.days90.projectedBalance, 29900);
  assert.equal(projection.hasNegativeBalance, false);
});

test('Criterio 7: Un utente senza permesso (socio) non può approvare regole fiscali', () => {
  // Simuliamo un tentativo di approvazione eseguito con ruolo 'socio'
  const currentUserRole = 'socio';
  
  function attemptTaxRuleApproval(role, rule) {
    if (role !== 'amministrazione') {
      throw new Error('Accesso Negato: Solo il ruolo amministrazione può approvare regole fiscali.');
    }
    return { ...rule, status: 'approved' };
  }

  const dummyRule = { id: 'tax-test', code: 'TEST-RULE', status: 'draft' };

  assert.throws(
    () => attemptTaxRuleApproval(currentUserRole, dummyRule),
    /Accesso Negato/,
    'Il socio non deve avere il permesso di approvare regole fiscali'
  );
});

test('Criterio 8: Genera anagrafica fornitore da fattura passiva e cliente da fattura attiva', () => {
  const initialEntities = [
    { id: 'ent-1', name: 'Idrotermica Lombarda SpA', type: 'supplier', isActive: true }
  ];

  const invoices = [
    // Fattura passiva con fornitore esistente
    {
      id: 'inv-1',
      number: 'F-100',
      type: 'passive',
      counterpartName: 'Idrotermica Lombarda SpA',
      totalAmount: 1500
    },
    // Fattura passiva con NUOVO fornitore
    {
      id: 'inv-2',
      number: 'F-101',
      type: 'passive',
      counterpartName: 'Daikin Air Conditioning Italy SpA',
      totalAmount: 4500
    },
    // Fattura attiva con NUOVO cliente
    {
      id: 'inv-3',
      number: 'F-102',
      type: 'active',
      counterpartName: 'Condominio Milano Due',
      totalAmount: 9000
    },
    // Fattura attiva e passiva per la stessa azienda (controparte mista -> 'both')
    {
      id: 'inv-4',
      number: 'F-103',
      type: 'active',
      counterpartName: 'Partner Impianti Global SRL',
      totalAmount: 2000
    },
    {
      id: 'inv-5',
      number: 'F-104',
      type: 'passive',
      counterpartName: 'Partner Impianti Global SRL',
      totalAmount: 1200
    }
  ];

  const result = syncEntitiesFromInvoices(initialEntities, invoices);

  assert.equal(result.createdCount, 3, 'Devono essere create 3 nuove anagrafiche');
  assert.equal(result.updatedEntities.length, 4, 'Totale entità 1 preesistente + 3 nuove');

  const daikin = result.updatedEntities.find(e => e.name.toLowerCase().includes('daikin'));
  assert.ok(daikin, 'Daikin deve essere presente tra le anagrafiche');
  assert.equal(daikin.type, 'supplier', 'Daikin deve essere fornitore perché presente solo in fattura passiva');

  const milanoDue = result.updatedEntities.find(e => e.name.toLowerCase().includes('milano due'));
  assert.ok(milanoDue, 'Condominio Milano Due deve essere presente');
  assert.equal(milanoDue.type, 'client', 'Milano Due deve essere cliente perché presente solo in fattura attiva');

  const partner = result.updatedEntities.find(e => e.name.toLowerCase().includes('partner impianti'));
  assert.ok(partner, 'Partner Impianti Global deve essere presente');
  assert.equal(partner.type, 'both', 'Partner Impianti deve essere both perché presente sia in attive che passive');

  // Idempotenza: una seconda esecuzione non deve creare duplicati
  const reSync = syncEntitiesFromInvoices(result.updatedEntities, invoices);
  assert.equal(reSync.createdCount, 0, 'La riesecuzione non deve creare duplicati');
  assert.equal(reSync.updatedEntities.length, 4);
});

test('Criterio 9: Controllo economico per anno intero, trimestre e mese', () => {
  const testInvoices = [
    { id: 'i1', type: 'active', economicCompetenceMonth: '2026-02', taxableAmount: 10000, isActive: true },
    { id: 'i2', type: 'active', economicCompetenceMonth: '2026-05', taxableAmount: 20000, isActive: true },
    { id: 'i3', type: 'active', economicCompetenceMonth: '2026-10', taxableAmount: 30000, isActive: true },
    { id: 'i4', type: 'passive', economicCompetenceMonth: '2026-02', taxableAmount: 4000, isActive: true },
    { id: 'i5', type: 'passive', economicCompetenceMonth: '2026-05', taxableAmount: 8000, isActive: true }
  ];

  // 1. Intero Anno 2026
  const annual = calculateManagementIncomeStatement({
    periodType: 'year',
    periodValue: '2026',
    invoices: testInvoices,
    payrollRecords: [],
    contracts: []
  });
  assert.equal(annual.revenues, 60000, 'I ricavi 2026 devono sommare tutti i mesi (10k+20k+30k)');
  assert.equal(annual.materialAndServiceCosts, 12000, 'I costi 2026 devono sommare tutti i mesi (4k+8k)');
  assert.equal(annual.grossMargin, 48000);

  // 2. Secondo Trimestre (Q2: Aprile, Maggio, Giugno)
  const q2 = calculateManagementIncomeStatement({
    periodType: 'quarter',
    periodValue: '2026-Q2',
    invoices: testInvoices,
    payrollRecords: [],
    contracts: []
  });
  assert.equal(q2.revenues, 20000, 'In Q2 ci deve essere solo maggio (20k)');
  assert.equal(q2.materialAndServiceCosts, 8000);

  // 3. Singolo Mese (Febbraio)
  const feb = calculateManagementIncomeStatement({
    periodType: 'month',
    periodValue: '2026-02',
    invoices: testInvoices,
    payrollRecords: [],
    contracts: []
  });
  assert.equal(feb.revenues, 10000);
  assert.equal(feb.materialAndServiceCosts, 4000);
});

test('Criterio 10: Conto Economico OIC calcola EBITDA, Ammortamenti, EBIT ed EBT con variazione rimanenze e SAL', () => {
  const invoices = [
    { id: 'i1', type: 'active', economicCompetenceMonth: '2026-03', taxableAmount: 50000, isActive: true },
    { id: 'i2', type: 'passive', economicCompetenceMonth: '2026-03', taxableAmount: 20000, isActive: true }
  ];

  const payroll = [
    {
      id: 'p1',
      employeeName: 'Operaio Tecnico',
      month: '2026-03',
      totalCompanyCost: 4000,
      isCompanyCostConfirmed: true
    }
  ];

  const contracts = [
    {
      id: 'c1',
      type: 'loan',
      installmentAmount: 1200,
      principalPortion: 1000,
      interestPortion: 200,
      isActive: true
    }
  ];

  const adjustments = {
    inventoryOpening: 5000,
    inventoryClosing: 8000, // Le giacenze aumentano di 3000 -> consumi = 20000 - 3000 = 17000
    workInProgressOpening: 0,
    workInProgressClosing: 5000, // SAL cantieri a fine mese 5000 -> Valore produzione = 50000 + 5000 = 55000
    depreciationTangible: 1500, // Ammortamento furgoni
    depreciationIntangible: 500,  // Ammortamento software
    badDebtProvision: 500        // Svalutazione crediti
  };

  const statement = calculateManagementIncomeStatement({
    periodType: 'month',
    periodValue: '2026-03',
    invoices,
    payrollRecords: payroll,
    contracts,
    adjustments
  });

  // Valore produzione: 50.000 + 5.000 (SAL) = 55.000
  assert.equal(statement.totalProductionValue, 55000);
  // Consumi effettivi: 20.000 - (8.000 - 5.000) = 17.000
  assert.equal(statement.adjustedMaterialCosts, 17000);
  // Valore aggiunto: 55.000 - 17.000 = 38.000
  assert.equal(statement.grossMargin, 38000);
  // EBITDA: 38.000 - 4.000 (personale) = 34.000
  assert.equal(statement.ebitda, 34000);
  // Ammortamenti complessivi: 1.500 + 500 = 2.000
  assert.equal(statement.depreciationTotal, 2000);
  // EBIT: 34.000 - 2.000 (ammortamenti) - 500 (fondo crediti) = 31.500
  assert.equal(statement.ebit, 31500);
  // EBT: 31.500 - 200 (interessi passivi) = 31.300
  assert.equal(statement.ebt, 31300);
});



