-- ========================================================================
-- ELACUS GESTIONALE - SUPABASE SCHEMA INITIALIZATION
-- Incolla ed esegui questo script nel Supabase Dashboard > SQL Editor
-- ========================================================================

-- Abilita estensione UUID se non già presente
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELLA: BANK ACCOUNTS (Conti Correnti Bancari)
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id TEXT PRIMARY KEY,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    iban TEXT NOT NULL,
    initial_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    initial_balance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    current_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    credit_limit NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABELLA: ENTITIES (Clienti / Fornitori)
CREATE TABLE IF NOT EXISTS public.entities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    vat_number TEXT,
    tax_code TEXT,
    type TEXT NOT NULL CHECK (type IN ('client', 'supplier', 'both')),
    email TEXT,
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    standard_payment_terms_days INTEGER DEFAULT 30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABELLA: INVOICES (Fatture Attive e Passive)
CREATE TABLE IF NOT EXISTS public.invoices (
    id TEXT PRIMARY KEY,
    number TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('active', 'passive')),
    counterpart_id TEXT,
    counterpart_name TEXT NOT NULL,
    issue_date DATE NOT NULL,
    economic_competence_month TEXT NOT NULL,
    due_date DATE NOT NULL,
    taxable_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    vat_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    category TEXT NOT NULL DEFAULT 'Generale',
    status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'partially_paid', 'paid', 'overdue')),
    is_withholding_applicable BOOLEAN DEFAULT FALSE,
    withholding_rate NUMERIC(5, 4) DEFAULT 0.00,
    withholding_amount NUMERIC(15, 2) DEFAULT 0.00,
    amount_credited_by_bank NUMERIC(15, 2),
    amount_paid_by_client NUMERIC(15, 2),
    outstanding_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    bank_transaction_id TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    imported_from TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABELLA: INVOICE INSTALLMENTS (Scadenze / Rate Fatture)
CREATE TABLE IF NOT EXISTS public.invoice_installments (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    paid_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TABELLA: BANK TRANSACTIONS (Movimenti Estratto Conto)
CREATE TABLE IF NOT EXISTS public.bank_transactions (
    id TEXT PRIMARY KEY,
    bank_account_id TEXT REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    value_date DATE NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    description TEXT NOT NULL,
    counterpart TEXT,
    reconciled BOOLEAN NOT NULL DEFAULT FALSE,
    reconciled_with_id TEXT,
    reconciled_type TEXT CHECK (reconciled_type IN ('invoice', 'payroll', 'contract', 'tax', 'manual') OR reconciled_type IS NULL),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    hash TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TABELLA: FINANCIAL CONTRACTS (Mutui, Leasing, Noleggi)
CREATE TABLE IF NOT EXISTS public.financial_contracts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('loan', 'leasing', 'operating_rental')),
    counterpart TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_financed NUMERIC(15, 2) NOT NULL,
    installment_amount NUMERIC(15, 2) NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'quarterly')),
    installments_count INTEGER NOT NULL DEFAULT 0,
    paid_installments_count INTEGER NOT NULL DEFAULT 0,
    principal_portion NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    interest_portion NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    bank_account_id TEXT REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    next_due_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. TABELLA: EMPLOYEES (Anagrafica Dipendenti e Collaboratori)
CREATE TABLE IF NOT EXISTS public.employees (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    tax_code TEXT NOT NULL,
    role TEXT NOT NULL,
    contract_type TEXT NOT NULL CHECK (contract_type IN ('subordinate', 'cococo')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    standard_gross_salary NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. TABELLA: PAYROLL RECORDS (Cedolini Buste Paga)
CREATE TABLE IF NOT EXISTS public.payroll_records (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES public.employees(id) ON DELETE SET NULL,
    employee_name TEXT NOT NULL,
    contract_type TEXT NOT NULL CHECK (contract_type IN ('subordinate', 'cococo')),
    month TEXT NOT NULL,
    gross_salary NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    taxable_base_contributory NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    employee_contributions NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    employee_tax_withheld NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    net_paid NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    employer_contributions NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    severance_pay_accrual NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    other_company_costs NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_company_cost NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    is_company_cost_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
    source TEXT NOT NULL DEFAULT 'manual_entry',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'verified', 'paid')),
    bank_transaction_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. TABELLA: TAX RULES (Regole Fiscali Deducibilità/Detraibilità)
CREATE TABLE IF NOT EXISTS public.tax_rules (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    vat_deductible_rate NUMERIC(5, 4) NOT NULL DEFAULT 1.00,
    tax_deductible_rate NUMERIC(5, 4) NOT NULL DEFAULT 1.00,
    valid_from DATE NOT NULL,
    valid_to DATE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. TABELLA: CASH FLOW FORECAST ITEMS (Previsionale Tesoreria)
CREATE TABLE IF NOT EXISTS public.forecast_items (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inflow', 'outflow')),
    source_type TEXT NOT NULL,
    reference_id TEXT,
    description TEXT NOT NULL,
    counterpart TEXT,
    expected_amount NUMERIC(15, 2) NOT NULL,
    collection_probability NUMERIC(5, 4) NOT NULL DEFAULT 1.00,
    weighted_amount NUMERIC(15, 2) NOT NULL,
    horizon_days INTEGER NOT NULL CHECK (horizon_days IN (30, 60, 90, 120)),
    is_manual_override BOOLEAN NOT NULL DEFAULT FALSE,
    original_date DATE,
    original_amount NUMERIC(15, 2),
    override_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. TABELLA: AUDIT LOGS (Tracciamento Operazioni)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_role TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    previous_value JSONB,
    new_value JSONB,
    details TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. TABELLA: APP SETTINGS (Configurazione Aruba, etc.)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ABILITAZIONE ROW LEVEL SECURITY (RLS) con accesso aperto via Anon Key
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Policy di accesso completo per la chiave anon (può essere ristretta con auth in futuro)
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow full access for anon" ON public.%I', tbl);
        EXECUTE format('CREATE POLICY "Allow full access for anon" ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true)', tbl);
    END LOOP;
END $$;

