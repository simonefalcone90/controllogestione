import { 
  BankAccount, 
  BankTransaction,
  EntityCounterpart, 
  FinancialContract, 
  Employee, 
  Invoice, 
  PayrollRecord, 
  TaxRule, 
  AuditLogEntry, 
  CashFlowForecastItem,
  ArubaConfig,
  UserRole
} from '../financial-engine/types';

import {
  INITIAL_BANK_ACCOUNTS,
  INITIAL_BANK_TRANSACTIONS,
  INITIAL_ENTITIES,
  INITIAL_EMPLOYEES,
  INITIAL_CONTRACTS,
  INITIAL_INVOICES,
  INITIAL_PAYROLL_RECORDS,
  INITIAL_TAX_RULES,
  INITIAL_FORECAST_ITEMS,
  INITIAL_AUDIT_LOGS
} from './seed-data';

export interface AppState {
  currentUser: {
    id: string;
    name: string;
    role: UserRole;
  };
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  entities: EntityCounterpart[];
  employees: Employee[];
  contracts: FinancialContract[];
  invoices: Invoice[];
  payrollRecords: PayrollRecord[];
  taxRules: TaxRule[];
  forecastItems: CashFlowForecastItem[];
  auditLogs: AuditLogEntry[];
  arubaConfig: ArubaConfig;
}

const STORAGE_KEY = 'elacus_gestionale_data_v3';

export function getInitialState(): AppState {
  return {
    currentUser: {
      id: 'usr-admin-1',
      name: 'Amministrazione Elacus',
      role: 'amministrazione'
    },
    bankAccounts: INITIAL_BANK_ACCOUNTS,
    bankTransactions: INITIAL_BANK_TRANSACTIONS,
    entities: INITIAL_ENTITIES,
    employees: INITIAL_EMPLOYEES,
    contracts: INITIAL_CONTRACTS,
    invoices: INITIAL_INVOICES,
    payrollRecords: INITIAL_PAYROLL_RECORDS,
    taxRules: INITIAL_TAX_RULES,
    forecastItems: INITIAL_FORECAST_ITEMS,
    auditLogs: INITIAL_AUDIT_LOGS,
    arubaConfig: {
      username: '',
      password: '',
      environment: 'production',
      autoSyncDaily: true,
      lastSyncTimestamp: undefined,
      lastSyncStatus: undefined
    }
  };
}

export function loadState(): AppState {
  if (typeof window === 'undefined') {
    return getInitialState();
  }
  try {
    // Purga vecchie chiavi di cache obsolete
    localStorage.removeItem('elacus_gestionale_data_v1');
    localStorage.removeItem('elacus_gestionale_data_v2');

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const state = getInitialState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return state;
    }
    const parsed = JSON.parse(raw);
    if (!parsed.arubaConfig) {
      parsed.arubaConfig = {
        username: '',
        password: '',
        environment: 'production',
        autoSyncDaily: true
      };
    }
    if (parsed.currentUser?.name?.includes('Laura Riva')) {
      parsed.currentUser.name = 'Amministrazione Elacus';
    }
    // Filtra ed elimina vecchi conti bancari fittizi (UniCredit, Bper, Credem) se presenti nel localStorage
    if (Array.isArray(parsed.bankAccounts)) {
      parsed.bankAccounts = parsed.bankAccounts.filter(
        (b: BankAccount) => b.id !== 'bank-2' && b.id !== 'bank-3' && b.id !== 'bank-5-closed'
      );
      if (parsed.bankAccounts.length === 0) {
        parsed.bankAccounts = INITIAL_BANK_ACCOUNTS;
      }
    } else {
      parsed.bankAccounts = INITIAL_BANK_ACCOUNTS;
    }

    // Filtra transazioni fittizie collegate a conti rimossi
    if (Array.isArray(parsed.bankTransactions)) {
      parsed.bankTransactions = parsed.bankTransactions.filter(
        (tx: BankTransaction) => tx.bankAccountId !== 'bank-2' && tx.bankAccountId !== 'bank-3' && tx.bankAccountId !== 'bank-5-closed'
      );
    } else {
      parsed.bankTransactions = INITIAL_BANK_TRANSACTIONS;
    }

    // Filtra contratti fittizi di prova (es. cnt-3 leasing FLIR)
    if (Array.isArray(parsed.contracts)) {
      parsed.contracts = parsed.contracts.filter(
        (c: FinancialContract) => c.id !== 'cnt-3'
      );
    }

    // Filtra forecast items fittizi di test
    if (Array.isArray(parsed.forecastItems)) {
      parsed.forecastItems = parsed.forecastItems.filter(
        (f: CashFlowForecastItem) => f.id !== 'fc-1' && f.id !== 'fc-2' && f.id !== 'fc-3'
      );
    }

    // Filtra audit logs fittizi di test
    if (Array.isArray(parsed.auditLogs)) {
      parsed.auditLogs = parsed.auditLogs.filter(
        (a: AuditLogEntry) => a.id !== 'aud-1' && a.id !== 'aud-2'
      );
    }

    // Filtra anagrafiche fittizie di test
    if (Array.isArray(parsed.entities)) {
      parsed.entities = parsed.entities.filter(
        (e: EntityCounterpart) => !e.id.startsWith('cli-') && !e.id.startsWith('for-')
      );
    }

    // Assicura che solo i dipendenti reali e validi siano presenti
    if (!Array.isArray(parsed.employees) || parsed.employees.length === 0) {
      parsed.employees = INITIAL_EMPLOYEES;
    }

    // Assicura che i cedolini validi siano caricati
    if (!Array.isArray(parsed.payrollRecords) || parsed.payrollRecords.length === 0) {
      parsed.payrollRecords = INITIAL_PAYROLL_RECORDS;
    }

    return parsed;
  } catch (err) {
    console.error('Failed to load state from localStorage', err);
    return getInitialState();
  }
}

export function saveState(state: AppState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save state to localStorage', err);
  }
}

export function addAuditLog(
  state: AppState, 
  entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'userId' | 'userName' | 'userRole'>
): AppState {
  const newLog: AuditLogEntry = {
    id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userId: state.currentUser.id,
    userName: state.currentUser.name,
    userRole: state.currentUser.role,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    ...entry
  };
  return {
    ...state,
    auditLogs: [newLog, ...state.auditLogs]
  };
}
