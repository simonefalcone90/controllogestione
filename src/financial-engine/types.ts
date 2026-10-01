export type UserRole = 'amministrazione' | 'socio';

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  entityType: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RECONCILE' | 'APPROVE';
  previousValue?: any;
  newValue?: any;
  details?: string;
  timestamp: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  iban: string;
  initialBalance: number;
  initialBalanceDate: string;
  currentBalance: number;
  lastUpdated: string;
  creditLimit: number; // Fido/Castelletto
  isActive: boolean;
  notes?: string;
}

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  date: string;
  valueDate: string;
  amount: number; // positive for credits, negative for debits
  description: string;
  counterpart?: string;
  reconciled: boolean;
  reconciledWithId?: string; // invoiceId, payrollId, contractId, or manual
  reconciledType?: 'invoice' | 'payroll' | 'contract' | 'tax' | 'manual';
  reconciledAmount?: number;
  reconciledDate?: string;
  reconciledCounterpart?: string;
  importedAt: string;
  hash: string; // for deduplication
}

export interface EntityCounterpart {
  id: string;
  name: string;
  vatNumber?: string;
  taxCode?: string;
  type: 'client' | 'supplier' | 'both';
  email?: string;
  phone?: string;
  isActive: boolean;
  standardPaymentTermsDays?: number;
}

export interface InvoiceInstallment {
  id: string;
  invoiceId: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  isPaid: boolean;
  paidDate?: string;
}

export interface Invoice {
  id: string;
  number: string;
  type: 'active' | 'passive'; // active = sales/clients, passive = purchases/suppliers
  counterpartId: string;
  counterpartName: string;
  issueDate: string;
  economicCompetenceMonth: string; // YYYY-MM
  dueDate: string;
  taxableAmount: number; // Imponibile
  vatAmount: number; // IVA
  totalAmount: number; // Totale fattura
  category: string; // Categoria di ricavo o costo
  status: 'draft' | 'issued' | 'partially_paid' | 'paid' | 'overdue';
  
  // Specifiche Bonifico Parlante & Ritenuta
  isWithholdingApplicable?: boolean; // Bonifico parlante (ecobonus, ristrutturazione, ecc.)
  withholdingRate?: number; // es. 0.08 o 0.11 (8% o 11% ex L. 213/2023)
  withholdingAmount?: number; // Ritenuta bancaria alla fonte
  amountCreditedByBank?: number; // Netto effettivamente accreditato in conto
  amountPaidByClient?: number; // Importo bonificato dal cliente (totale)
  outstandingAmount: number; // Residuo effettivamente da incassare (totale - accreditato - ritenuta)

  // Riconciliazione bancaria & Regime fiscale
  bankTransactionId?: string;
  reconciledDate?: string;
  isSplitPayment?: boolean; // Split payment per PA (IVA non incassata)
  vatExemptionCode?: string; // es. N6.3 per Reverse Charge art. 17 c.6 lett. a-ter
  
  installments?: InvoiceInstallment[];
  isActive: boolean;
  importedFrom?: string;
  sourceFileType?: 'pdf' | 'xml' | 'zip' | 'csv' | 'manual' | 'aruba_api';
}

export interface FinancialContract {
  id: string;
  title: string; // es. "Mutuo Chirografario Intesa", "Noleggio Operativo Furgone Ducato"
  type: 'loan' | 'leasing' | 'operating_rental';
  accountingMethod?: 'patrimonial_oic' | 'financial'; // Default per leasing in S.r.l.: patrimonial_oic
  counterpart: string;
  startDate: string;
  endDate: string;
  totalFinanced: number;
  installmentAmount: number;
  frequency: 'monthly' | 'quarterly';
  installmentsCount: number;
  paidInstallmentsCount: number;
  principalPortion: number; // Quota capitale media o calcolata (Cassa)
  interestPortion: number; // Quota interessi/oneri o canone puro (Costo CE)
  bankAccountId: string;
  isActive: boolean; // Chiusura anticipata supportata
  nextDueDate: string;
}

export interface Employee {
  id: string;
  fullName: string;
  taxCode: string;
  role: string;
  contractType: 'subordinate' | 'cococo'; // Dipendente vs Co.Co.Co.
  isActive: boolean;
  standardGrossSalary: number;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  contractType: 'subordinate' | 'cococo';
  month: string; // YYYY-MM
  grossSalary: number; // Retribuzione lorda o compenso
  taxableBaseContributory: number; // Imponibile contributivo
  employeeContributions: number; // Contributi a carico lavoratore
  employeeTaxWithheld: number; // IRPEF e addizionali trattenute
  netPaid: number; // Netto in busta da pagare
  
  // Costo aziendale complessivo
  employerContributions: number; // Oneri previdenziali/assistenziali c/azienda (INPS, INAIL, ecc.)
  severancePayAccrual: number; // Quota TFR maturata
  otherCompanyCosts: number; // Cassa edile, fondi integrativi, ecc.
  totalCompanyCost: number; // Costo complessivo reale
  
  isCompanyCostConfirmed: boolean; // Se false -> visualizzato come "Costo Incompleto"
  source: 'job_sistemi_import' | 'manual_entry' | 'consultant_summary';
  status: 'draft' | 'verified' | 'paid';
  bankTransactionId?: string;
  reconciledDate?: string;
  pdfFileName?: string;
  validationErrors?: string[];
}

export interface ReconciliationMatchSuggestion {
  transaction: BankTransaction;
  matchedInvoice: Invoice;
  confidenceScore: number; // 0.0 to 1.0
  matchReason: 'exact_amount' | 'withholding_parlante' | 'counterpart_and_amount' | 'invoice_number' | 'partial_match';
  confidenceLabel: 'alta' | 'media' | 'bassa';
  suggestedSettlement: {
    totalPaid: number;
    withholdingAmount: number;
    bankCreditedAmount: number;
    outstandingAfter: number;
  };
}

export interface TaxRule {
  id: string;
  code: string;
  description: string;
  category: string;
  vatDeductibleRate: number; // 0 to 1
  taxDeductibleRate: number; // 0 to 1 (IRES/IRPEF)
  validFrom: string;
  validTo?: string;
  status: 'draft' | 'approved';
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
}

export interface CashFlowForecastItem {
  id: string;
  date: string; // YYYY-MM-DD
  direction: 'inflow' | 'outflow';
  sourceType: 'invoice_client' | 'invoice_supplier' | 'payroll_net' | 'taxes_f24' | 'financial_contract' | 'recurring_cost' | 'manual_adjustment';
  referenceId?: string;
  description: string;
  counterpart?: string;
  expectedAmount: number;
  collectionProbability: number; // 0.0 to 1.0 (default 1.0, editable)
  weightedAmount: number; // expectedAmount * collectionProbability
  horizonDays: 30 | 60 | 90 | 120;
  isManualOverride: boolean;
  originalDate?: string;
  originalAmount?: number;
  overrideNote?: string;
  taxCode?: 'F24_IVA' | 'F24_RITENUTE' | 'F24_INPS' | 'F24_IRES_IRAP';
}

export interface ArubaConfig {
  username: string;
  password?: string;
  environment: 'production' | 'demo';
  autoSyncDaily: boolean;
  lastSyncTimestamp?: string;
  lastSyncStatus?: string;
  lastActiveCount?: number;
  lastPassiveCount?: number;
}

export interface VatMonthlyItem {
  month: string; // YYYY-MM
  label: string; // Gen, Feb, ...
  activeTaxable: number;
  activeVat: number;
  passiveTaxable: number;
  passiveVat: number;
  netBalance: number; // activeVat - passiveVat (positivo = debito da versare)
}

export interface VatPosition {
  periodType: 'year' | 'quarter' | 'month';
  periodValue: string;
  activeTaxable: number;     // Imponibile vendite (Fatturato Netto)
  activeVat: number;         // IVA a debito
  activeTotal: number;       // Lordo vendite (c/IVA)
  passiveTaxable: number;    // Imponibile acquisti (Fornitori Netto)
  passiveVat: number;        // IVA a credito
  passiveTotal: number;      // Lordo acquisti (c/IVA)
  netVatBalance: number;     // IVA a debito - IVA a credito (positivo = debito)
  isDebtor: boolean;         // true se saldo > 0 (debito da versare), false se credito
  monthlyBreakdown: VatMonthlyItem[];
}

export interface IncomeStatementAdjustments {
  inventoryOpening?: number;       // Rimanenze iniziali merci/materie prime
  inventoryClosing?: number;       // Rimanenze finali merci/materie prime
  workInProgressOpening?: number;  // Lavori in corso iniziali
  workInProgressClosing?: number;  // Lavori in corso finali (SAL cantieri non ancora fatturati)
  depreciationTangible?: number;   // Ammortamenti materiali (mezzi, attrezzature)
  depreciationIntangible?: number; // Ammortamenti immateriali (software, licenze)
  badDebtProvision?: number;       // Accantonamento svalutazione crediti
}

export interface ManagementIncomeStatementResult {
  month: string;
  periodType: 'month' | 'quarter' | 'year';
  periodValue: string;
  revenues: number;
  workInProgressVariation: number; // Variazione SAL cantieri (A.3 C.C.)
  totalProductionValue: number;    // Valore della Produzione (A C.C.)
  materialPurchases: number;       // Acquisti materie prime
  inventoryVariation: number;      // Variazione rimanenze (B.11 C.C.)
  adjustedMaterialCosts: number;   // Consumi effettivi di materie prime
  materialAndServiceCosts: number;
  grossMargin: number;             // Valore Aggiunto Industriale
  grossMarginPercent: number;
  personnelCost: number;
  isPersonnelCostComplete: boolean;
  missingPersonnelDetails: string[];
  rentalCosts: number;             // Godimento beni di terzi (B.8 C.C. - noleggi e leasing patrimoniale)
  otherCosts: number;
  ebitda: number;                  // Margine Operativo Lordo
  ebitdaPercent: number;
  depreciationTotal: number;       // Ammortamenti complessivi (B.10.a/b C.C.)
  badDebtProvision: number;        // Accantonamento crediti (B.10.d C.C.)
  ebit: number;                    // Risultato Operativo (EBIT)
  ebitPercent: number;
  financialCosts: number;          // Oneri finanziari netti (C.17 C.C.)
  ebt: number;                     // Risultato prima delle imposte (EBT)
  hasDataIncompleteness: boolean;
  activeInvoicesCount: number;
  passiveInvoicesCount: number;
}


