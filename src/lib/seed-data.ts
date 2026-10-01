import { BankAccount, BankTransaction, EntityCounterpart, FinancialContract, Employee, Invoice, PayrollRecord, TaxRule, AuditLogEntry, CashFlowForecastItem } from '../financial-engine/types';
import { generateTransactionHash } from '../financial-engine/calculations';

export const INITIAL_BANK_ACCOUNTS: BankAccount[] = [
  {
    id: 'bank-1',
    bankName: 'Intesa Sanpaolo (C/C Business Insieme)',
    accountNumber: '03682/1000/00070880',
    iban: 'IT85W0306911310100000070880',
    initialBalance: 27163.16,
    initialBalanceDate: '2025-12-31',
    currentBalance: 27747.69,
    lastUpdated: '2026-06-30',
    creditLimit: 70000.00, // Affidamento/Anticipi SBF concesso
    isActive: true,
    notes: 'Conto principale operativo (filiale Pavia Battisti) con linea anticipi SBF € 70.000'
  },
  {
    id: 'bank-4',
    bankName: 'Banco BPM (C/C Ordinario Gobetti)',
    accountNumber: '02035/000000002575',
    iban: 'IT16I0503411300000000002575',
    initialBalance: 748.89,
    initialBalanceDate: '2025-12-31',
    currentBalance: 1117.41,
    lastUpdated: '2026-06-30',
    creditLimit: 0.00,
    isActive: true,
    notes: 'Conto corrente operativo filiale Pavia Gobetti (addebiti rate mutuo n. 2035 4702900)'
  }
];

export const INITIAL_ENTITIES: EntityCounterpart[] = [];

export const INITIAL_EMPLOYEES: Employee[] = [
  { id: 'emp-7', fullName: 'Darla Galati Muccilla', taxCode: 'GLTDRL93B58B202R', role: 'Collaboratrice Co.Co.Co. (Gestione Separata)', contractType: 'cococo', isActive: true, standardGrossSalary: 2910.00 },
  { id: 'emp-8', fullName: 'Guenda Lindo', taxCode: 'LNDGND97A61Z133T', role: 'Impiegata Livello D2 (CCNL Metalmeccanici)', contractType: 'subordinate', isActive: true, standardGrossSalary: 1979.37 },
  { id: 'emp-9', fullName: 'Matteo Ndreka', taxCode: 'NDRMTT03S28G388X', role: 'Operaio Livello D1 (CCNL Metalmeccanici)', contractType: 'subordinate', isActive: true, standardGrossSalary: 1784.94 },
  { id: 'emp-10', fullName: 'Samuele Galati Muccilla', taxCode: 'GLTSML03D03G388P', role: 'Operaio Livello C1 (CCNL Metalmeccanici)', contractType: 'subordinate', isActive: true, standardGrossSalary: 2357.07 },
  { id: 'emp-11', fullName: 'Simone Falcone', taxCode: 'FLCSMN90P04F205E', role: 'Collaboratore Co.Co.Co. (Gestione Separata)', contractType: 'cococo', isActive: true, standardGrossSalary: 2950.00 },
  { id: 'emp-12', fullName: 'Simone Galati Mucilla', taxCode: 'GLTSMN08C04G388W', role: 'Operaio Livello D1 (CCNL Metalmeccanici)', contractType: 'subordinate', isActive: true, standardGrossSalary: 1784.94 },
  { id: 'emp-13', fullName: 'Valerio Falcone', taxCode: 'FLCVLR96D11F205Z', role: 'Operaio Livello C1 (Cessato il 30/05/2026)', contractType: 'subordinate', isActive: false, standardGrossSalary: 1998.56 }
];

export const INITIAL_CONTRACTS: FinancialContract[] = [
  {
    id: 'cnt-1',
    title: 'Finanziamento Chirografario Intesa Sanpaolo n. 0IR1049314423',
    type: 'loan',
    counterpart: 'Intesa Sanpaolo (Filiale Pavia Battisti)',
    startDate: '2025-11-11',
    endDate: '2031-11-11',
    totalFinanced: 180000.00,
    installmentAmount: 2990.31,
    frequency: 'monthly',
    installmentsCount: 72,
    paidInstallmentsCount: 4,
    principalPortion: 2139.30,
    interestPortion: 851.01,
    bankAccountId: 'bank-1',
    isActive: true,
    nextDueDate: '2026-04-11'
  },
  {
    id: 'cnt-bpm-mutuo',
    title: 'Mutuo Chirografario Banco BPM n. 2035 4702900',
    type: 'loan',
    counterpart: 'Banco BPM (Filiale Pavia Gobetti)',
    startDate: '2024-01-01',
    endDate: '2028-12-31',
    totalFinanced: 15000.00,
    installmentAmount: 253.47,
    frequency: 'monthly',
    installmentsCount: 60,
    paidInstallmentsCount: 27,
    principalPortion: 220.00,
    interestPortion: 33.47,
    bankAccountId: 'bank-4',
    isActive: true,
    nextDueDate: '2026-04-26'
  },
  {
    id: 'cnt-2',
    title: 'Noleggio Operativo Furgone Fiat Ducato Maxi Attrezzato',
    type: 'operating_rental',
    counterpart: 'Leasys SpA / Arval',
    startDate: '2025-01-01',
    endDate: '2028-12-31',
    totalFinanced: 28800.00,
    installmentAmount: 600.00,
    frequency: 'monthly',
    installmentsCount: 48,
    paidInstallmentsCount: 20,
    principalPortion: 0.00,
    interestPortion: 600.00,
    bankAccountId: 'bank-1',
    isActive: true,
    nextDueDate: '2026-10-05'
  }
];

export const INITIAL_INVOICES: Invoice[] = [];


export const INITIAL_PAYROLL_RECORDS: PayrollRecord[] = [
{
    id: 'pay-2026-01-darla',
    employeeId: 'emp-7',
    employeeName: 'Darla Galati Muccilla',
    contractType: 'cococo',
    month: '2026-01',
    grossSalary: 2901.90, // Compenso 2.282,10 + Trasferta Italia 619,80
    taxableBaseContributory: 2282.10,
    employeeContributions: 269.89, // INPS 266,55 + INAIL 3,34
    employeeTaxWithheld: 311.99, // IRPEF 270,63 + Addizionali 41,36
    netPaid: 2320.00,
    employerContributions: 539.78, // INPS c/az 2/3 (533,10) + INAIL c/az 2/3 (6,68)
    severancePayAccrual: 0.00,
    otherCompanyCosts: 0.00,
    totalCompanyCost: 3441.68,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-02-darla',
    employeeId: 'emp-7',
    employeeName: 'Darla Galati Muccilla',
    contractType: 'cococo',
    month: '2026-02',
    grossSalary: 2929.80, // Ricostruito da progressivo fiscale YTD Marzo
    taxableBaseContributory: 2310.00,
    employeeContributions: 271.70,
    employeeTaxWithheld: 338.10,
    netPaid: 2320.00,
    employerContributions: 546.30,
    severancePayAccrual: 0.00,
    otherCompanyCosts: 0.00,
    totalCompanyCost: 3476.10,
    isCompanyCostConfirmed: true,
    source: 'consultant_summary',
    status: 'verified'
  },
{
    id: 'pay-2026-03-darla',
    employeeId: 'emp-7',
    employeeName: 'Darla Galati Muccilla',
    contractType: 'cococo',
    month: '2026-03',
    grossSalary: 2911.47, // Compenso 2.291,67 + Trasferta Italia 619,80
    taxableBaseContributory: 2291.67,
    employeeContributions: 271.02, // INPS 267,67 + INAIL 3,35
    employeeTaxWithheld: 321.05, // IRPEF 273,43 + Addizionali 47,62
    netPaid: 2320.00,
    employerContributions: 542.04, // INPS c/az 2/3 (535,34) + INAIL c/az 2/3 (6,70)
    severancePayAccrual: 0.00,
    otherCompanyCosts: 0.00,
    totalCompanyCost: 3453.51,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-04-darla',
    employeeId: 'emp-7',
    employeeName: 'Darla Galati Muccilla',
    contractType: 'cococo',
    month: '2026-04',
    grossSalary: 2921.80, // Ricostruito da progressivo fiscale YTD Maggio
    taxableBaseContributory: 2302.00,
    employeeContributions: 272.20,
    employeeTaxWithheld: 329.60,
    netPaid: 2320.00,
    employerContributions: 544.40,
    severancePayAccrual: 0.00,
    otherCompanyCosts: 0.00,
    totalCompanyCost: 3466.20,
    isCompanyCostConfirmed: true,
    source: 'consultant_summary',
    status: 'verified'
  },
{
    id: 'pay-2026-05-darla',
    employeeId: 'emp-7',
    employeeName: 'Darla Galati Muccilla',
    contractType: 'cococo',
    month: '2026-05',
    grossSalary: 2912.53, // Compenso 2.292,73 + Trasferta Italia 619,80
    taxableBaseContributory: 2292.73,
    employeeContributions: 271.14, // INPS 267,79 + INAIL 3,35
    employeeTaxWithheld: 321.40, // IRPEF 273,78 + Addizionali 47,62
    netPaid: 2320.00,
    employerContributions: 542.28, // INPS c/az 2/3 (535,58) + INAIL c/az 2/3 (6,70)
    severancePayAccrual: 0.00,
    otherCompanyCosts: 0.00,
    totalCompanyCost: 3454.81,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-06-darla',
    employeeId: 'emp-7',
    employeeName: 'Darla Galati Muccilla',
    contractType: 'cococo',
    month: '2026-06',
    grossSalary: 2922.19, // Compenso 2.302,39 + Trasferta Italia 619,80
    taxableBaseContributory: 2302.39,
    employeeContributions: 272.29, // INPS 268,92 + INAIL 3,37
    employeeTaxWithheld: 329.97, // IRPEF 282,35 + Addizionali 47,62
    netPaid: 2320.00,
    employerContributions: 544.58, // INPS c/az 2/3 (537,84) + INAIL c/az 2/3 (6,74)
    severancePayAccrual: 0.00,
    otherCompanyCosts: 0.00,
    totalCompanyCost: 3466.77,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-07-darla',
    employeeId: 'emp-7',
    employeeName: 'Darla Galati Muccilla',
    contractType: 'cococo',
    month: '2026-07',
    grossSalary: 2912.39, // Compenso 2.292,59 + Trasferta Italia 619,80 (ricostruito da progressivo Agosto)
    taxableBaseContributory: 2292.59,
    employeeContributions: 271.12, // INPS 267,77 + INAIL 3,35
    employeeTaxWithheld: 321.27, // IRPEF 273,65 + Addizionali 47,62
    netPaid: 2320.00,
    employerContributions: 542.24, // INPS c/az 2/3 (535,54) + INAIL c/az 2/3 (6,70)
    severancePayAccrual: 0.00,
    otherCompanyCosts: 0.00,
    totalCompanyCost: 3454.63,
    isCompanyCostConfirmed: true,
    source: 'consultant_summary',
    status: 'verified'
  },
{
    id: 'pay-2026-08-darla',
    employeeId: 'emp-7',
    employeeName: 'Darla Galati Muccilla',
    contractType: 'cococo',
    month: '2026-08',
    grossSalary: 2912.10, // Compenso 2.292,30 + Trasferta Italia 619,80
    taxableBaseContributory: 2292.30,
    employeeContributions: 271.09, // INPS 267,74 + INAIL 3,35
    employeeTaxWithheld: 321.37, // IRPEF 273,75 + Addizionali 47,62
    netPaid: 2495.00, // Include € 175,32 di rimborso 730 anticipato dall'azienda
    employerContributions: 542.18, // INPS c/az 2/3 (535,48) + INAIL c/az 2/3 (6,70)
    severancePayAccrual: 0.00,
    otherCompanyCosts: 0.00,
    totalCompanyCost: 3454.28, // Costo effettivo CE (il rimborso 730 è credito compensabile in F24)
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-01-guenda',
    employeeId: 'emp-8',
    employeeName: 'Guenda Lindo',
    contractType: 'subordinate',
    month: '2026-01',
    grossSalary: 1931.78,
    taxableBaseContributory: 1931.78,
    employeeContributions: 177.55, // INPS 9,19%
    employeeTaxWithheld: 266.24, // IRPEF 115,93 + Addizionali 28,20 + Tratt. integrativo rata 122,11
    netPaid: 1488.00,
    employerContributions: 579.60, // INPS c/ditta ~30%
    severancePayAccrual: 139.98, // Rateo TFR maturato
    otherCompanyCosts: 22.00, // INAIL 0722 + Metasalute
    totalCompanyCost: 2673.36,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-02-guenda',
    employeeId: 'emp-8',
    employeeName: 'Guenda Lindo',
    contractType: 'subordinate',
    month: '2026-02',
    grossSalary: 3041.70, // Ricostruito da progr. fiscale Marzo (imponibile fiscale 2.762,17 con straordinari/premio)
    taxableBaseContributory: 3041.70,
    employeeContributions: 279.53,
    employeeTaxWithheld: 612.17,
    netPaid: 2150.00,
    employerContributions: 912.50,
    severancePayAccrual: 139.98,
    otherCompanyCosts: 22.00,
    totalCompanyCost: 4116.18,
    isCompanyCostConfirmed: true,
    source: 'consultant_summary',
    status: 'verified'
  },
{
    id: 'pay-2026-03-guenda',
    employeeId: 'emp-8',
    employeeName: 'Guenda Lindo',
    contractType: 'subordinate',
    month: '2026-03',
    grossSalary: 2301.78, // Minimo 1.931,78 + Premio 370,00
    taxableBaseContributory: 2301.78,
    employeeContributions: 211.55, // INPS 9,19%
    employeeTaxWithheld: 357.03, // IRPEF 203,66 + Addizionali e tratt. int. 153,37
    netPaid: 1733.00,
    employerContributions: 690.60,
    severancePayAccrual: 139.98,
    otherCompanyCosts: 22.00,
    totalCompanyCost: 3154.36,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-04-guenda',
    employeeId: 'emp-8',
    employeeName: 'Guenda Lindo',
    contractType: 'subordinate',
    month: '2026-04',
    grossSalary: 2061.78, // Ricostruito da progr. fiscale Maggio
    taxableBaseContributory: 2061.78,
    employeeContributions: 189.50,
    employeeTaxWithheld: 312.28,
    netPaid: 1560.00,
    employerContributions: 618.50,
    severancePayAccrual: 139.98,
    otherCompanyCosts: 22.00,
    totalCompanyCost: 2842.26,
    isCompanyCostConfirmed: true,
    source: 'consultant_summary',
    status: 'verified'
  },
{
    id: 'pay-2026-05-guenda',
    employeeId: 'emp-8',
    employeeName: 'Guenda Lindo',
    contractType: 'subordinate',
    month: '2026-05',
    grossSalary: 2310.78, // Minimo 1.931,78 + Premio 379,00
    taxableBaseContributory: 2310.78,
    employeeContributions: 212.38,
    employeeTaxWithheld: 362.51,
    netPaid: 1735.00,
    employerContributions: 693.30,
    severancePayAccrual: 139.98,
    otherCompanyCosts: 22.00,
    totalCompanyCost: 3166.06,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-06-guenda',
    employeeId: 'emp-8',
    employeeName: 'Guenda Lindo',
    contractType: 'subordinate',
    month: '2026-06',
    grossSalary: 2520.37, // Nuovo minimo CCNL 1.979,37 + Premio 541,00
    taxableBaseContributory: 2520.37,
    employeeContributions: 231.59,
    employeeTaxWithheld: 416.08,
    netPaid: 1873.00,
    employerContributions: 756.00,
    severancePayAccrual: 143.43,
    otherCompanyCosts: 22.00,
    totalCompanyCost: 3441.80,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-07-guenda',
    employeeId: 'emp-8',
    employeeName: 'Guenda Lindo',
    contractType: 'subordinate',
    month: '2026-07',
    grossSalary: 2722.37, // Minimo CCNL 1.979,37 + Una tantum 743,00
    taxableBaseContributory: 2722.37,
    employeeContributions: 250.15, // INPS 9,19%
    employeeTaxWithheld: 468.62, // IRPEF 315,25 + Addizionali 31,26 + Tratt. integrativo rata 122,11
    netPaid: 2046.00, // Include € 41,98 di rimborsi 730 a credito F24
    employerContributions: 816.60,
    severancePayAccrual: 143.43,
    otherCompanyCosts: 22.00,
    totalCompanyCost: 3704.40, // Costo effettivo CE
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-08-guenda',
    employeeId: 'emp-8',
    employeeName: 'Guenda Lindo',
    contractType: 'subordinate',
    month: '2026-08',
    grossSalary: 2105.37, // Minimo CCNL 1.979,37 + Premio 126,00
    taxableBaseContributory: 2105.37,
    employeeContributions: 193.45, // INPS 9,19%
    employeeTaxWithheld: 204.64, // IRPEF 173,38 + Addizionali 31,26 (terminato recupero tratt. integrativo)
    netPaid: 1723.00, // Include € 16,02 di rimborsi 730 a credito F24
    employerContributions: 631.50,
    severancePayAccrual: 143.43,
    otherCompanyCosts: 22.00,
    totalCompanyCost: 2902.30, // Costo effettivo CE
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-01-matteo',
    employeeId: 'emp-9',
    employeeName: 'Matteo Ndreka',
    contractType: 'subordinate',
    month: '2026-01',
    grossSalary: 1742.03,
    taxableBaseContributory: 1742.03,
    employeeContributions: 160.09, // INPS 9,19%
    employeeTaxWithheld: 159.69, // IRPEF 58,90 + Addizionali 38,80 + Tratt. int. rata 61,99
    netPaid: 1423.00,
    employerContributions: 522.60, // INPS c/ditta ~30%
    severancePayAccrual: 126.24, // Rateo TFR maturato
    otherCompanyCosts: 74.00, // INAIL tariffa 3600 operai (~61€) + Metasalute (13€)
    totalCompanyCost: 2464.87,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-02-matteo',
    employeeId: 'emp-9',
    employeeName: 'Matteo Ndreka',
    contractType: 'subordinate',
    month: '2026-02',
    grossSalary: 1793.38, // Base 1.742,03 + Straordinari 51,35
    taxableBaseContributory: 1793.38,
    employeeContributions: 164.78, // INPS 9,19%
    employeeTaxWithheld: 200.26, // IRPEF 99,47 + Addizionali e tratt. int. 100,79
    netPaid: 1428.00,
    employerContributions: 537.90,
    severancePayAccrual: 126.24,
    otherCompanyCosts: 75.70,
    totalCompanyCost: 2533.22,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-03-matteo',
    employeeId: 'emp-9',
    employeeName: 'Matteo Ndreka',
    contractType: 'subordinate',
    month: '2026-03',
    grossSalary: 1742.03,
    taxableBaseContributory: 1742.03,
    employeeContributions: 160.09,
    employeeTaxWithheld: 164.56, // IRPEF 59,26 + Addizionali e tratt. int. 105,30
    netPaid: 1417.00,
    employerContributions: 522.60,
    severancePayAccrual: 126.24,
    otherCompanyCosts: 74.00,
    totalCompanyCost: 2464.87,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-04-matteo',
    employeeId: 'emp-9',
    employeeName: 'Matteo Ndreka',
    contractType: 'subordinate',
    month: '2026-04',
    grossSalary: 1742.03, // Ricostruito esattamente dal progressivo Maggio
    taxableBaseContributory: 1742.03,
    employeeContributions: 160.09,
    employeeTaxWithheld: 164.56,
    netPaid: 1417.00,
    employerContributions: 522.60,
    severancePayAccrual: 126.24,
    otherCompanyCosts: 74.00,
    totalCompanyCost: 2464.87,
    isCompanyCostConfirmed: true,
    source: 'consultant_summary',
    status: 'verified'
  },
{
    id: 'pay-2026-05-matteo',
    employeeId: 'emp-9',
    employeeName: 'Matteo Ndreka',
    contractType: 'subordinate',
    month: '2026-05',
    grossSalary: 1742.03,
    taxableBaseContributory: 1742.03,
    employeeContributions: 160.09,
    employeeTaxWithheld: 164.56,
    netPaid: 1417.00,
    employerContributions: 522.60,
    severancePayAccrual: 126.24,
    otherCompanyCosts: 74.00,
    totalCompanyCost: 2464.87,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-06-matteo',
    employeeId: 'emp-9',
    employeeName: 'Matteo Ndreka',
    contractType: 'subordinate',
    month: '2026-06',
    grossSalary: 1784.94, // Nuovo minimo CCNL Metalmeccanici D1
    taxableBaseContributory: 1784.94,
    employeeContributions: 164.04,
    employeeTaxWithheld: 185.70, // IRPEF 80,40 + Addizionali e tratt. int. 105,30
    netPaid: 1436.00,
    employerContributions: 535.50,
    severancePayAccrual: 129.34,
    otherCompanyCosts: 75.50,
    totalCompanyCost: 2525.28,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-07-matteo',
    employeeId: 'emp-9',
    employeeName: 'Matteo Ndreka',
    contractType: 'subordinate',
    month: '2026-07',
    grossSalary: 1784.94,
    taxableBaseContributory: 1784.94,
    employeeContributions: 164.04, // INPS 9,19%
    employeeTaxWithheld: 175.95, // IRPEF 70,65 + Addizionali 43,31 + Tratt. int. rata 61,99
    netPaid: 1445.00,
    employerContributions: 535.50, // INPS c/ditta ~30%
    severancePayAccrual: 129.34, // Rateo TFR maturato
    otherCompanyCosts: 75.50, // INAIL tariffa 3600 operai + Metasalute
    totalCompanyCost: 2525.28,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-08-matteo',
    employeeId: 'emp-9',
    employeeName: 'Matteo Ndreka',
    contractType: 'subordinate',
    month: '2026-08',
    grossSalary: 1784.94, // Comprese 80h ferie estive
    taxableBaseContributory: 1784.94,
    employeeContributions: 164.04, // INPS 9,19%
    employeeTaxWithheld: 113.96, // IRPEF 70,65 + Addizionali 43,31 (terminata rata DL 3/2020)
    netPaid: 1506.00,
    employerContributions: 535.50,
    severancePayAccrual: 129.34,
    otherCompanyCosts: 75.50,
    totalCompanyCost: 2525.28,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-01-samuele',
    employeeId: 'emp-10',
    employeeName: 'Samuele Galati Muccilla',
    contractType: 'subordinate',
    month: '2026-01',
    grossSalary: 2215.49, // Ordinaria 1.998,56 + Trasferta Italia (7 gg) 216,93
    taxableBaseContributory: 1998.56,
    employeeContributions: 183.71, // INPS 9,19%
    employeeTaxWithheld: 181.78, // IRPEF 136,02 + Addizionali 45,76
    netPaid: 1850.00,
    employerContributions: 599.70, // INPS c/ditta ~30%
    severancePayAccrual: 144.80, // Rateo TFR maturato
    otherCompanyCosts: 83.00, // INAIL tariffa 3600 operai (~70€) + Metasalute (13€)
    totalCompanyCost: 3042.99,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-02-samuele',
    employeeId: 'emp-10',
    employeeName: 'Samuele Galati Muccilla',
    contractType: 'subordinate',
    month: '2026-02',
    grossSalary: 2432.42, // Ordinaria 1.998,56 + Trasferta Italia (14 gg) 433,86
    taxableBaseContributory: 1998.56,
    employeeContributions: 183.71,
    employeeTaxWithheld: 209.01, // IRPEF 163,25 + Addizionali 45,76
    netPaid: 2039.00,
    employerContributions: 599.70,
    severancePayAccrual: 144.80,
    otherCompanyCosts: 83.00,
    totalCompanyCost: 3259.92,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-03-samuele',
    employeeId: 'emp-10',
    employeeName: 'Samuele Galati Muccilla',
    contractType: 'subordinate',
    month: '2026-03',
    grossSalary: 2308.46, // Ordinaria 1.998,56 + Trasferta Italia (10 gg) 309,90
    taxableBaseContributory: 1998.56,
    employeeContributions: 183.71,
    employeeTaxWithheld: 187.65, // IRPEF 136,02 + Addizionali 51,63
    netPaid: 1937.00,
    employerContributions: 599.70,
    severancePayAccrual: 144.80,
    otherCompanyCosts: 83.00,
    totalCompanyCost: 3135.96,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-04-samuele',
    employeeId: 'emp-10',
    employeeName: 'Samuele Galati Muccilla',
    contractType: 'subordinate',
    month: '2026-04',
    grossSalary: 2308.46, // Ricostruito da progressivo Maggio (identico a Marzo)
    taxableBaseContributory: 1998.56,
    employeeContributions: 183.71,
    employeeTaxWithheld: 187.65,
    netPaid: 1937.00,
    employerContributions: 599.70,
    severancePayAccrual: 144.80,
    otherCompanyCosts: 83.00,
    totalCompanyCost: 3135.96,
    isCompanyCostConfirmed: true,
    source: 'consultant_summary',
    status: 'verified'
  },
{
    id: 'pay-2026-05-samuele',
    employeeId: 'emp-10',
    employeeName: 'Samuele Galati Muccilla',
    contractType: 'subordinate',
    month: '2026-05',
    grossSalary: 2308.46, // Ordinaria 1.998,56 + Trasferta (10 gg) 309,90
    taxableBaseContributory: 1998.56,
    employeeContributions: 183.71,
    employeeTaxWithheld: 187.65,
    netPaid: 1938.00,
    employerContributions: 599.70,
    severancePayAccrual: 144.80,
    otherCompanyCosts: 83.00,
    totalCompanyCost: 3135.96,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-06-samuele',
    employeeId: 'emp-10',
    employeeName: 'Samuele Galati Muccilla',
    contractType: 'subordinate',
    month: '2026-06',
    grossSalary: 2357.07, // Nuovo minimo CCNL 2.047,17 + Trasferta (10 gg) 309,90
    taxableBaseContributory: 2047.17,
    employeeContributions: 188.12, // INPS 9,19%
    employeeTaxWithheld: 209.55, // IRPEF 157,92 + Addizionali 51,63
    netPaid: 1959.00,
    employerContributions: 614.10,
    severancePayAccrual: 148.32,
    otherCompanyCosts: 84.60,
    totalCompanyCost: 3204.09,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-07-samuele',
    employeeId: 'emp-10',
    employeeName: 'Samuele Galati Muccilla',
    contractType: 'subordinate',
    month: '2026-07',
    grossSalary: 2289.15, // Minimo 2.022,12 + 2 Scatti anzianità 50,10 + Trasferta (7 gg) 216,93 (ricostruito da progr. Agosto)
    taxableBaseContributory: 2072.22,
    employeeContributions: 190.42, // INPS 9,19%
    employeeTaxWithheld: 207.02, // IRPEF 155,39 + Addizionali 51,63
    netPaid: 1891.00,
    employerContributions: 621.60, // INPS c/ditta ~30%
    severancePayAccrual: 150.13, // Rateo TFR maturato
    otherCompanyCosts: 85.50, // INAIL tariffa 3600 operai + Metasalute
    totalCompanyCost: 3146.38,
    isCompanyCostConfirmed: true,
    source: 'consultant_summary',
    status: 'verified'
  },
{
    id: 'pay-2026-08-samuele',
    employeeId: 'emp-10',
    employeeName: 'Samuele Galati Muccilla',
    contractType: 'subordinate',
    month: '2026-08',
    grossSalary: 2289.15, // Minimo 2.022,12 + 2 Scatti 50,10 + Trasferta (7 gg) 216,93 (comprese 80h ferie estive)
    taxableBaseContributory: 2072.22,
    employeeContributions: 190.42, // INPS 9,19%
    employeeTaxWithheld: 207.02, // IRPEF 155,39 + Addizionali 51,63
    netPaid: 1891.00,
    employerContributions: 621.60,
    severancePayAccrual: 150.13,
    otherCompanyCosts: 85.50,
    totalCompanyCost: 3146.38,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-01-simone',
    employeeId: 'emp-11',
    employeeName: 'Simone Falcone',
    contractType: 'cococo',
    month: '2026-01',
    grossSalary: 2930.13, // Compenso 2.310,33 + Trasferta Italia 619,80
    taxableBaseContributory: 2310.33,
    employeeContributions: 299.43, // INPS 269,85 + INAIL (tariffa 3600) 29,58
    employeeTaxWithheld: 311.60, // IRPEF 270,21 + Addizionali 41,39
    netPaid: 2320.00,
    employerContributions: 598.86, // INPS c/az 2/3 (539,70) + INAIL c/az 2/3 (59,16)
    severancePayAccrual: 0.00,
    otherCompanyCosts: 0.00,
    totalCompanyCost: 3528.99,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-02-simone',
    employeeId: 'emp-11',
    employeeName: 'Simone Falcone',
    contractType: 'cococo',
    month: '2026-02',
    grossSalary: 2963.02, // Compenso 2.343,22 + Trasferta 619,80
    taxableBaseContributory: 2343.22,
    employeeContributions: 303.70, // INPS 273,69 + INAIL 30,01
    employeeTaxWithheld: 339.00, // IRPEF 297,61 + Addizionali 41,39
    netPaid: 2320.00,
    employerContributions: 607.40, // INPS c/az 2/3 (547,38) + INAIL c/az 2/3 (60,02)
    severancePayAccrual: 0.00,
    otherCompanyCosts: 0.00,
    totalCompanyCost: 3570.42,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-03-simone',
    employeeId: 'emp-11',
    employeeName: 'Simone Falcone',
    contractType: 'cococo',
    month: '2026-03',
    grossSalary: 2941.42, // Compenso 2.321,62 + Trasferta 619,80
    taxableBaseContributory: 2321.62,
    employeeContributions: 300.90, // INPS 271,17 + INAIL 29,73
    employeeTaxWithheld: 321.10, // IRPEF 273,46 + Addizionali 47,64
    netPaid: 2319.00,
    employerContributions: 601.80, // INPS c/az 2/3 (542,34) + INAIL c/az 2/3 (59,46)
    severancePayAccrual: 0.00,
    otherCompanyCosts: 0.00,
    totalCompanyCost: 3543.22,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-04-simone',
    employeeId: 'emp-11',
    employeeName: 'Simone Falcone',
    contractType: 'cococo',
    month: '2026-04',
    grossSalary: 2945.00, // Ricostruito da progressivo Giugno
    taxableBaseContributory: 2325.20,
    employeeContributions: 301.37,
    employeeTaxWithheld: 323.63,
    netPaid: 2320.00,
    employerContributions: 602.74,
    severancePayAccrual: 0.00,
    otherCompanyCosts: 0.00,
    totalCompanyCost: 3547.74,
    isCompanyCostConfirmed: true,
    source: 'consultant_summary',
    status: 'verified'
  },
{
    id: 'pay-2026-05-simone',
    employeeId: 'emp-11',
    employeeName: 'Simone Falcone',
    contractType: 'cococo',
    month: '2026-05',
    grossSalary: 2945.00, // Ricostruito da progressivo Giugno
    taxableBaseContributory: 2325.20,
    employeeContributions: 301.37,
    employeeTaxWithheld: 323.63,
    netPaid: 2320.00,
    employerContributions: 602.74,
    severancePayAccrual: 0.00,
    otherCompanyCosts: 0.00,
    totalCompanyCost: 3547.74,
    isCompanyCostConfirmed: true,
    source: 'consultant_summary',
    status: 'verified'
  },
{
    id: 'pay-2026-06-simone',
    employeeId: 'emp-11',
    employeeName: 'Simone Falcone',
    contractType: 'cococo',
    month: '2026-06',
    grossSalary: 2952.61, // Compenso 2.332,81 + Trasferta 619,80
    taxableBaseContributory: 2332.81,
    employeeContributions: 302.35, // INPS 272,47 + INAIL 29,88
    employeeTaxWithheld: 330.10, // IRPEF 282,46 + Addizionali 47,64
    netPaid: 2320.00,
    employerContributions: 604.70, // INPS c/az 2/3 (544,94) + INAIL c/az 2/3 (59,76)
    severancePayAccrual: 0.00,
    otherCompanyCosts: 0.00,
    totalCompanyCost: 3557.31,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-07-simone',
    employeeId: 'emp-11',
    employeeName: 'Simone Falcone',
    contractType: 'cococo',
    month: '2026-07',
    grossSalary: 2942.06, // Compenso 2.322,26 + Trasferta 619,80 (ricostruito da progr. Agosto)
    taxableBaseContributory: 2322.26,
    employeeContributions: 300.97, // INPS 271,24 + INAIL 29,73
    employeeTaxWithheld: 321.25, // IRPEF 273,61 + Addizionali 47,64
    netPaid: 2320.00,
    employerContributions: 601.94, // INPS c/az 2/3 (542,48) + INAIL c/az 2/3 (59,46)
    severancePayAccrual: 0.00,
    otherCompanyCosts: 0.00,
    totalCompanyCost: 3544.00,
    isCompanyCostConfirmed: true,
    source: 'consultant_summary',
    status: 'verified'
  },
{
    id: 'pay-2026-08-simone',
    employeeId: 'emp-11',
    employeeName: 'Simone Falcone',
    contractType: 'cococo',
    month: '2026-08',
    grossSalary: 2941.85, // Compenso 2.322,05 + Trasferta 619,80
    taxableBaseContributory: 2322.05,
    employeeContributions: 300.95, // INPS 271,22 + INAIL 29,73
    employeeTaxWithheld: 321.35, // IRPEF 273,71 + Addizionali 47,64
    netPaid: 2689.00, // Include € 369,70 di rimborso 730 anticipato dall'azienda
    employerContributions: 601.90, // INPS c/az 2/3 (542,44) + INAIL c/az 2/3 (59,46)
    severancePayAccrual: 0.00,
    otherCompanyCosts: 0.00,
    totalCompanyCost: 3543.75, // Costo effettivo CE (il rimborso 730 è credito compensabile in F24)
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-01-simonegalati',
    employeeId: 'emp-12',
    employeeName: 'Simone Galati Mucilla',
    contractType: 'subordinate',
    month: '2026-01',
    grossSalary: 1363.47, // Part-time 75% (1.306,52) + Somma integrativa L.207/2024 (56,95)
    taxableBaseContributory: 1306.52,
    employeeContributions: 120.11, // INPS 9,19%
    employeeTaxWithheld: 28.36, // IRPEF 13,77 + Addizionali 14,59
    netPaid: 1215.00,
    employerContributions: 392.10, // INPS c/ditta ~30%
    severancePayAccrual: 94.69, // Rateo TFR
    otherCompanyCosts: 58.00, // INAIL tariffa 3600 operai + Metasalute
    totalCompanyCost: 1851.31,
    isCompanyCostConfirmed: true,
    source: 'consultant_summary',
    status: 'verified'
  },
{
    id: 'pay-2026-02-simonegalati',
    employeeId: 'emp-12',
    employeeName: 'Simone Galati Mucilla',
    contractType: 'subordinate',
    month: '2026-02',
    grossSalary: 1363.47,
    taxableBaseContributory: 1306.52,
    employeeContributions: 120.11,
    employeeTaxWithheld: 28.36,
    netPaid: 1215.00,
    employerContributions: 392.10,
    severancePayAccrual: 94.69,
    otherCompanyCosts: 58.00,
    totalCompanyCost: 1851.31,
    isCompanyCostConfirmed: true,
    source: 'consultant_summary',
    status: 'verified'
  },
{
    id: 'pay-2026-03-simonegalati',
    employeeId: 'emp-12',
    employeeName: 'Simone Galati Mucilla',
    contractType: 'subordinate',
    month: '2026-03',
    grossSalary: 1363.47, // Base 1.306,52 + Somma integrativa L.207/2024 56,95
    taxableBaseContributory: 1306.52,
    employeeContributions: 120.11, // INPS 9,19%
    employeeTaxWithheld: 28.30, // IRPEF 13,77 + Addizionali 14,53
    netPaid: 1215.00,
    employerContributions: 392.10,
    severancePayAccrual: 94.69,
    otherCompanyCosts: 58.00,
    totalCompanyCost: 1851.31,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-04-simonegalati',
    employeeId: 'emp-12',
    employeeName: 'Simone Galati Mucilla',
    contractType: 'subordinate',
    month: '2026-04',
    grossSalary: 1817.96, // Passaggio a Full Time 100%
    taxableBaseContributory: 1742.03,
    employeeContributions: 160.09,
    employeeTaxWithheld: 149.25,
    netPaid: 1509.00,
    employerContributions: 522.60,
    severancePayAccrual: 126.24,
    otherCompanyCosts: 74.00,
    totalCompanyCost: 2464.87,
    isCompanyCostConfirmed: true,
    source: 'consultant_summary',
    status: 'verified'
  },
{
    id: 'pay-2026-05-simonegalati',
    employeeId: 'emp-12',
    employeeName: 'Simone Galati Mucilla',
    contractType: 'subordinate',
    month: '2026-05',
    grossSalary: 1817.96, // Ordinaria 1.742,03 + Somma integrativa L.207/2024 75,93
    taxableBaseContributory: 1742.03,
    employeeContributions: 160.09, // INPS 9,19%
    employeeTaxWithheld: 149.25, // IRPEF 134,72 + Addizionali 14,53
    netPaid: 1509.00,
    employerContributions: 522.60,
    severancePayAccrual: 126.24,
    otherCompanyCosts: 74.00,
    totalCompanyCost: 2464.87,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-06-simonegalati',
    employeeId: 'emp-12',
    employeeName: 'Simone Galati Mucilla',
    contractType: 'subordinate',
    month: '2026-06',
    grossSalary: 1862.74, // Nuovo minimo CCNL 1.784,94 + Somma integrativa L.207/2024 77,80
    taxableBaseContributory: 1784.94,
    employeeContributions: 164.04, // INPS 9,19%
    employeeTaxWithheld: 167.93, // IRPEF 153,40 + Addizionali 14,53
    netPaid: 1531.00,
    employerContributions: 535.50,
    severancePayAccrual: 129.34,
    otherCompanyCosts: 75.50,
    totalCompanyCost: 2525.28,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-07-simonegalati',
    employeeId: 'emp-12',
    employeeName: 'Simone Galati Mucilla',
    contractType: 'subordinate',
    month: '2026-07',
    grossSalary: 1862.74, // Minimo 1.784,94 (26 gg retribuiti ord/ferie) + Somma integrativa L.207/2024 77,80
    taxableBaseContributory: 1784.94,
    employeeContributions: 164.04, // INPS 9,19%
    employeeTaxWithheld: 160.62, // IRPEF netta 146,09 + Addizionali 14,53
    netPaid: 1538.00,
    employerContributions: 535.50, // INPS c/ditta ~30%
    severancePayAccrual: 129.34, // TFR maturato mese
    otherCompanyCosts: 75.50, // INAIL 3600 operai (~62,5€) + Metasalute (13€)
    totalCompanyCost: 2525.28,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-08-simonegalati',
    employeeId: 'emp-12',
    employeeName: 'Simone Galati Mucilla',
    contractType: 'subordinate',
    month: '2026-08',
    grossSalary: 1862.74, // Minimo 1.784,94 (25 gg ord + 80h ferie + 1 gg festività) + Somma int. 77,80
    taxableBaseContributory: 1784.94,
    employeeContributions: 164.04, // INPS 9,19%
    employeeTaxWithheld: 160.62, // IRPEF netta 146,09 + Addizionali 14,53
    netPaid: 1538.00,
    employerContributions: 535.50,
    severancePayAccrual: 129.34,
    otherCompanyCosts: 75.50,
    totalCompanyCost: 2525.28,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-01-valerio',
    employeeId: 'emp-13',
    employeeName: 'Valerio Falcone',
    contractType: 'subordinate',
    month: '2026-01',
    grossSalary: 1998.56, // Minimo 1.973,51 + Scatto 25,05
    taxableBaseContributory: 1999.00,
    employeeContributions: 183.71, // INPS 9,19%
    employeeTaxWithheld: 181.01, // IRPEF netta 136,02 + Addizionali 44,99
    netPaid: 1634.00,
    employerContributions: 599.70, // INPS c/ditta ~30%
    severancePayAccrual: 144.71, // TFR maturato (1.953,57 / 13,5)
    otherCompanyCosts: 79.00, // INAIL 3600 cantieri (~66€) + Metasalute (13€)
    totalCompanyCost: 2821.97,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-02-valerio',
    employeeId: 'emp-13',
    employeeName: 'Valerio Falcone',
    contractType: 'subordinate',
    month: '2026-02',
    grossSalary: 1998.56,
    taxableBaseContributory: 1999.00,
    employeeContributions: 183.71,
    employeeTaxWithheld: 208.24, // IRPEF netta 163,25 + Addizionali 44,99
    netPaid: 1606.00,
    employerContributions: 599.70,
    severancePayAccrual: 144.71,
    otherCompanyCosts: 79.00,
    totalCompanyCost: 2821.97,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-03-valerio',
    employeeId: 'emp-13',
    employeeName: 'Valerio Falcone',
    contractType: 'subordinate',
    month: '2026-03',
    grossSalary: 1921.69, // Assenza non retribuita 1 gg (netto spettanze 1.875,48)
    taxableBaseContributory: 1875.00,
    employeeContributions: 172.31,
    employeeTaxWithheld: 160.18, // IRPEF netta 109,46 + Addizionali 50,72
    netPaid: 1543.00,
    employerContributions: 562.50,
    severancePayAccrual: 135.17,
    otherCompanyCosts: 76.00,
    totalCompanyCost: 2695.36,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-04-valerio',
    employeeId: 'emp-13',
    employeeName: 'Valerio Falcone',
    contractType: 'subordinate',
    month: '2026-04',
    grossSalary: 1994.46, // Ord. 1.537,35 + Fest. 153,74 + Carenza 230,60 + Int. c/ditta 32,23 + Malattia INPS 40,54
    taxableBaseContributory: 1954.00,
    employeeContributions: 179.57,
    employeeTaxWithheld: 194.98, // IRPEF netta 144,26 + Addizionali 50,72
    netPaid: 1620.00,
    employerContributions: 586.20,
    severancePayAccrual: 144.71,
    otherCompanyCosts: 78.00,
    totalCompanyCost: 2803.37,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  },
{
    id: 'pay-2026-05-valerio',
    employeeId: 'emp-13',
    employeeName: 'Valerio Falcone',
    contractType: 'subordinate',
    month: '2026-05',
    grossSalary: 4501.61, // Ord. 1.998,56 + Ferie res. 154,02 + Permessi res. 515,97 + 13ma 832,74 + Integrazioni 988,86 - Ded.
    taxableBaseContributory: 3501.00,
    employeeContributions: 321.74,
    employeeTaxWithheld: 1460.82, // Conguaglio IRPEF 1.018,87 + Saldo Addizionali 441,95
    netPaid: 2718.86, // Bonifico di chiusura e liquidazione fine rapporto (30/05/2026)
    employerContributions: 1050.30, // INPS c/ditta
    severancePayAccrual: 209.73, // Rateo TFR mese di cessazione
    otherCompanyCosts: 120.00, // INAIL su imponibile di chiusura + quote accessorie
    totalCompanyCost: 5881.64,
    isCompanyCostConfirmed: true,
    source: 'job_sistemi_import',
    status: 'verified'
  }
];

export const INITIAL_TAX_RULES: TaxRule[] = [
  {
    id: 'tax-1',
    code: 'AUTOFURGONI-NOLEGGIO',
    description: 'Noleggio e uso autocarri e veicoli commerciali strumentali N1 (es. furgone allestito)',
    category: 'Automezzi e Noleggi',
    vatDeductibleRate: 1.00, // 100% detraibile se immatricolato autocarro strumentale N1
    taxDeductibleRate: 1.00, // 100% deducibile IRES
    validFrom: '2026-01-01',
    status: 'approved',
    approvedBy: 'Dott. Commercialista / Amministrazione',
    approvedAt: '2026-01-15'
  },
  {
    id: 'tax-1b',
    code: 'AUTOVETTURE-PROMISCUE',
    description: 'Noleggio/Leasing o spese autovetture non esclusivamente strumentali (art. 164 TUIR e art. 19-bis1 D.P.R. 633/72)',
    category: 'Automezzi e Noleggi',
    vatDeductibleRate: 0.40, // 40% detraibilità IVA forfettaria di legge
    taxDeductibleRate: 0.20, // 20% deducibilità IRES ordinaria
    validFrom: '2026-01-01',
    status: 'approved',
    approvedBy: 'Dott. Commercialista / Amministrazione',
    approvedAt: '2026-01-15',
    notes: 'Applicabile ad autovetture aziendali a deducibilità limitata (ripresa fiscale 80% quadro RF)'
  },
  {
    id: 'tax-2',
    code: 'MATERIALI-TERMOIDRAULICI',
    description: 'Acquisto materie prime e semilavorati per cantieri impianti',
    category: 'Materiale Idraulico e Tubazioni',
    vatDeductibleRate: 1.00,
    taxDeductibleRate: 1.00,
    validFrom: '2026-01-01',
    status: 'approved',
    approvedBy: 'Amministrazione',
    approvedAt: '2026-01-15'
  },
  {
    id: 'tax-3',
    code: 'TELEFONIA-INTERNET',
    description: 'Spese telefonia fissa e connettività internet sede aziendale',
    category: 'Utenze e Telecomunicazioni',
    vatDeductibleRate: 1.00,
    taxDeductibleRate: 0.80, // Limite art. 102 TUIR (80% deducibile)
    validFrom: '2026-01-01',
    status: 'approved',
    approvedBy: 'Amministrazione',
    approvedAt: '2026-01-15'
  },
  {
    id: 'tax-3b',
    code: 'TELEFONIA-MOBILE-MISTA',
    description: 'Telefonia cellulare e SIM dati a uso promiscuo aziendale/personale',
    category: 'Utenze e Telecomunicazioni',
    vatDeductibleRate: 0.50, // 50% detraibilità IVA presuntiva
    taxDeductibleRate: 0.80, // 80% deducibilità IRES art. 102 comma 9 TUIR
    validFrom: '2026-01-01',
    status: 'approved',
    approvedBy: 'Amministrazione',
    approvedAt: '2026-01-15'
  },
  {
    id: 'tax-4',
    code: 'SPESE-RAPPRESENTANZA-BOZZA',
    description: 'Pranzi di lavoro e spese ospitalità clienti (art. 108 TUIR)',
    category: 'Spese Rappresentanza e Trasferte',
    vatDeductibleRate: 0.00, // IVA indetraibile ex art. 19-bis1
    taxDeductibleRate: 0.75, // Deducibile nei limiti del plafond 1,5% - 2% dei ricavi
    validFrom: '2026-10-01',
    status: 'draft',
    notes: 'In attesa di parere definitivo dal commercialista sui limiti di plafond ricavi'
  }
];


export const INITIAL_FORECAST_ITEMS: CashFlowForecastItem[] = [];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'aud-3',
    userId: 'user-admin',
    userName: 'Amministrazione Elacus',
    userRole: 'amministrazione',
    entityType: 'PAYROLL',
    entityId: 'emp-7',
    action: 'CREATE',
    newValue: { employee: 'Darla Galati Muccilla', verifiedMonths: ['2026-01', '2026-03', '2026-05', '2026-06', '2026-07', '2026-08'] },
    details: 'Acquisiti e verificati cedolini Co.Co.Co. Darla Galati Muccilla (JOB Sistemi) fino ad Agosto 2026 (compreso conguaglio 730 a credito F24)',
    timestamp: '2026-09-29 14:35:00'
  },
  {
    id: 'aud-4',
    userId: 'user-admin',
    userName: 'Amministrazione Elacus',
    userRole: 'amministrazione',
    entityType: 'PAYROLL',
    entityId: 'emp-8',
    action: 'CREATE',
    newValue: { employee: 'Guenda Lindo', verifiedMonths: ['2026-01', '2026-03', '2026-05', '2026-06', '2026-07', '2026-08'] },
    details: 'Acquisiti e allineati cedolini CCNL Metalmeccanici Guenda Lindo (JOB Sistemi) fino ad Agosto 2026 (compreso nuovo minimo CCNL, una tantum e rimborsi 730)',
    timestamp: '2026-09-29 14:38:00'
  },
  {
    id: 'aud-5',
    userId: 'user-admin',
    userName: 'Amministrazione Elacus',
    userRole: 'amministrazione',
    entityType: 'PAYROLL',
    entityId: 'emp-9',
    action: 'CREATE',
    newValue: { employee: 'Matteo Ndreka', verifiedMonths: ['2026-01', '2026-02', '2026-03', '2026-05', '2026-06', '2026-07', '2026-08'] },
    details: 'Acquisiti e allineati cedolini CCNL Metalmeccanici Operaio Matteo Ndreka (JOB Sistemi) fino ad Agosto 2026 con tariffa INAIL 3600 e rateo TFR',
    timestamp: '2026-09-29 14:43:00'
  },
  {
    id: 'aud-6',
    userId: 'user-admin',
    userName: 'Amministrazione Elacus',
    userRole: 'amministrazione',
    entityType: 'PAYROLL',
    entityId: 'emp-10',
    action: 'CREATE',
    newValue: { employee: 'Samuele Galati Muccilla', verifiedMonths: ['2026-01', '2026-02', '2026-03', '2026-05', '2026-06', '2026-07', '2026-08'] },
    details: 'Acquisiti e allineati cedolini CCNL Metalmeccanici Livello C1 Samuele Galati Muccilla (JOB Sistemi) fino ad Agosto 2026 con scatti anzianità, trasferte e rateo TFR',
    timestamp: '2026-09-29 14:46:00'
  },
  {
    id: 'aud-7',
    userId: 'user-admin',
    userName: 'Amministrazione Elacus',
    userRole: 'amministrazione',
    entityType: 'PAYROLL',
    entityId: 'emp-11',
    action: 'CREATE',
    newValue: { employee: 'Simone Falcone', verifiedMonths: ['2026-01', '2026-02', '2026-03', '2026-06', '2026-07', '2026-08'] },
    details: 'Acquisiti e allineati cedolini Co.Co.Co. Simone Falcone (JOB Sistemi) fino ad Agosto 2026 con tariffa INAIL 3600 (1,268%), oneri Gestione Separata e rimborso 730',
    timestamp: '2026-09-29 14:49:00'
  },
  {
    id: 'aud-8',
    userId: 'user-admin',
    userName: 'Amministrazione Elacus',
    userRole: 'amministrazione',
    entityType: 'PAYROLL',
    entityId: 'emp-12',
    action: 'CREATE',
    newValue: { employee: 'Simone Galati Mucilla', verifiedMonths: ['2026-03', '2026-05', '2026-06', '2026-07', '2026-08'] },
    details: 'Acquisiti e allineati cedolini Operaio Simone Galati Mucilla (JOB Sistemi) fino ad Agosto 2026 con decontribuzione L.207/2024, scatti CCNL e rateo TFR',
    timestamp: '2026-09-29 14:51:00'
  },
  {
    id: 'aud-9',
    userId: 'user-admin',
    userName: 'Amministrazione Elacus',
    userRole: 'amministrazione',
    entityType: 'PAYROLL',
    entityId: 'emp-13',
    action: 'CREATE',
    newValue: { employee: 'Valerio Falcone', verifiedMonths: ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05'], status: 'terminated', terminationDate: '2026-05-30' },
    details: 'Acquisiti e allineati cedolini Operaio C1 Valerio Falcone (JOB Sistemi) per il periodo 01/2026 - 05/2026 con liquidazione ferie/ROL, rateo 13ma e chiusura rapporto al 30/05/2026',
    timestamp: '2026-09-29 14:55:00'
  }
];

export const INITIAL_BANK_TRANSACTIONS: BankTransaction[] = [];

