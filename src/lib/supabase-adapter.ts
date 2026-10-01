import { supabase } from './supabase';
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
  ArubaConfig
} from '../financial-engine/types';
import { AppState } from './store';

// Helper per mappare tra CamelCase (TypeScript) e SnakeCase (PostgreSQL)
export async function fetchFullStateFromSupabase(): Promise<Partial<AppState> | null> {
  try {
    const [
      accountsRes,
      entitiesRes,
      invoicesRes,
      installmentsRes,
      transactionsRes,
      contractsRes,
      employeesRes,
      payrollRes,
      taxRulesRes,
      forecastRes,
      auditRes,
      settingsRes
    ] = await Promise.all([
      supabase.from('bank_accounts').select('*'),
      supabase.from('entities').select('*').limit(5000),
      supabase.from('invoices').select('*').limit(5000),
      supabase.from('invoice_installments').select('*').limit(5000),
      supabase.from('bank_transactions').select('*').limit(5000),
      supabase.from('financial_contracts').select('*'),
      supabase.from('employees').select('*'),
      supabase.from('payroll_records').select('*').limit(5000),
      supabase.from('tax_rules').select('*'),
      supabase.from('forecast_items').select('*'),
      supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(200),
      supabase.from('app_settings').select('*')
    ]);

    // Se la tabella non esiste ancora o errore DB grave, restituiamo null per fallback a localStorage
    if (accountsRes.error && accountsRes.error.code === 'PGRST205') {
      return null;
    }

    const installmentsByInvoice = new Map<string, any[]>();
    if (installmentsRes.data) {
      installmentsRes.data.forEach((inst: any) => {
        const list = installmentsByInvoice.get(inst.invoice_id) || [];
        list.push({
          id: inst.id,
          invoiceId: inst.invoice_id,
          dueDate: inst.due_date,
          amount: Number(inst.amount),
          paidAmount: Number(inst.paid_amount),
          isPaid: Boolean(inst.is_paid),
          paidDate: inst.paid_date || undefined
        });
        installmentsByInvoice.set(inst.invoice_id, list);
      });
    }

    const invoices: Invoice[] = (invoicesRes.data || []).map((inv: any) => ({
      id: inv.id,
      number: inv.number,
      type: inv.type,
      counterpartId: inv.counterpart_id,
      counterpartName: inv.counterpart_name,
      issueDate: inv.issue_date,
      economicCompetenceMonth: inv.economic_competence_month,
      dueDate: inv.due_date,
      taxableAmount: Number(inv.taxable_amount),
      vatAmount: Number(inv.vat_amount),
      totalAmount: Number(inv.total_amount),
      category: inv.category,
      status: inv.status,
      isWithholdingApplicable: Boolean(inv.is_withholding_applicable),
      withholdingRate: inv.withholding_rate ? Number(inv.withholding_rate) : undefined,
      withholdingAmount: inv.withholding_amount ? Number(inv.withholding_amount) : undefined,
      amountCreditedByBank: inv.amount_credited_by_bank ? Number(inv.amount_credited_by_bank) : undefined,
      amountPaidByClient: inv.amount_paid_by_client ? Number(inv.amount_paid_by_client) : undefined,
      outstandingAmount: Number(inv.outstanding_amount),
      bankTransactionId: inv.bank_transaction_id || undefined,
      installments: installmentsByInvoice.get(inv.id) || [],
      isActive: Boolean(inv.is_active),
      importedFrom: inv.imported_from || undefined
    }));

    const bankAccounts: BankAccount[] = (accountsRes.data || [])
      .filter((acc: any) => acc.id !== 'bank-2' && acc.id !== 'bank-3' && acc.id !== 'bank-5-closed')
      .map((acc: any) => ({
        id: acc.id,
        bankName: acc.bank_name,
        accountNumber: acc.account_number,
        iban: acc.iban,
        initialBalance: Number(acc.initial_balance),
        initialBalanceDate: acc.initial_balance_date,
        currentBalance: Number(acc.current_balance),
        lastUpdated: acc.last_updated,
        creditLimit: Number(acc.credit_limit),
        isActive: Boolean(acc.is_active),
        notes: acc.notes || undefined
      }));

    const entities: EntityCounterpart[] = (entitiesRes.data || [])
      .filter((e: any) => !e.id.startsWith('cli-') && !e.id.startsWith('for-'))
      .map((e: any) => ({
      id: e.id,
      name: e.name,
      vatNumber: e.vat_number || undefined,
      taxCode: e.tax_code || undefined,
      type: e.type,
      email: e.email || undefined,
      phone: e.phone || undefined,
      isActive: Boolean(e.is_active),
      standardPaymentTermsDays: e.standard_payment_terms_days ? Number(e.standard_payment_terms_days) : undefined
    }));

    const bankTransactions: BankTransaction[] = (transactionsRes.data || [])
      .filter((t: any) => t.bank_account_id !== 'bank-2' && t.bank_account_id !== 'bank-3' && t.bank_account_id !== 'bank-5-closed')
      .map((t: any) => ({
        id: t.id,
        bankAccountId: t.bank_account_id,
        date: t.date,
        valueDate: t.value_date,
        amount: Number(t.amount),
        description: t.description,
        counterpart: t.counterpart || undefined,
        reconciled: Boolean(t.reconciled),
        reconciledWithId: t.reconciled_with_id || undefined,
        reconciledType: t.reconciled_type || undefined,
        importedAt: t.imported_at,
        hash: t.hash
      }));

    const contracts: FinancialContract[] = (contractsRes.data || [])
      .filter((c: any) => c.id !== 'cnt-3')
      .map((c: any) => ({
      id: c.id,
      title: c.title,
      type: c.type,
      counterpart: c.counterpart,
      startDate: c.start_date,
      endDate: c.end_date,
      totalFinanced: Number(c.total_financed),
      installmentAmount: Number(c.installment_amount),
      frequency: c.frequency,
      installmentsCount: Number(c.installments_count),
      paidInstallmentsCount: Number(c.paid_installments_count),
      principalPortion: Number(c.principal_portion),
      interestPortion: Number(c.interest_portion),
      bankAccountId: c.bank_account_id,
      isActive: Boolean(c.is_active),
      nextDueDate: c.next_due_date
    }));

    const employees: Employee[] = (employeesRes.data || []).map((emp: any) => ({
      id: emp.id,
      fullName: emp.full_name,
      taxCode: emp.tax_code,
      role: emp.role,
      contractType: emp.contract_type,
      isActive: Boolean(emp.is_active),
      standardGrossSalary: Number(emp.standard_gross_salary)
    }));

    const payrollRecords: PayrollRecord[] = (payrollRes.data || []).map((p: any) => ({
      id: p.id,
      employeeId: p.employee_id,
      employeeName: p.employee_name,
      contractType: p.contract_type,
      month: p.month,
      grossSalary: Number(p.gross_salary),
      taxableBaseContributory: Number(p.taxable_base_contributory),
      employeeContributions: Number(p.employee_contributions),
      employeeTaxWithheld: Number(p.employee_tax_withheld),
      netPaid: Number(p.net_paid),
      employerContributions: Number(p.employer_contributions),
      severancePayAccrual: Number(p.severance_pay_accrual),
      otherCompanyCosts: Number(p.other_company_costs),
      totalCompanyCost: Number(p.total_company_cost),
      isCompanyCostConfirmed: Boolean(p.is_company_cost_confirmed),
      source: p.source,
      status: p.status,
      bankTransactionId: p.bank_transaction_id || undefined
    }));

    const taxRules: TaxRule[] = (taxRulesRes.data || []).map((tr: any) => ({
      id: tr.id,
      code: tr.code,
      description: tr.description,
      category: tr.category,
      vatDeductibleRate: Number(tr.vat_deductible_rate),
      taxDeductibleRate: Number(tr.tax_deductible_rate),
      validFrom: tr.valid_from,
      validTo: tr.valid_to || undefined,
      status: tr.status,
      approvedBy: tr.approved_by || undefined,
      approvedAt: tr.approved_at || undefined,
      notes: tr.notes || undefined
    }));

    const forecastItems: CashFlowForecastItem[] = (forecastRes.data || [])
      .filter((f: any) => f.id !== 'fc-1' && f.id !== 'fc-2' && f.id !== 'fc-3')
      .map((f: any) => ({
      id: f.id,
      date: f.date,
      direction: f.direction,
      sourceType: f.source_type,
      referenceId: f.reference_id || undefined,
      description: f.description,
      counterpart: f.counterpart || undefined,
      expectedAmount: Number(f.expected_amount),
      collectionProbability: Number(f.collection_probability),
      weightedAmount: Number(f.weighted_amount),
      horizonDays: Number(f.horizon_days) as any,
      isManualOverride: Boolean(f.is_manual_override),
      originalDate: f.original_date || undefined,
      originalAmount: f.original_amount ? Number(f.original_amount) : undefined,
      overrideNote: f.override_note || undefined
    }));

    const auditLogs: AuditLogEntry[] = (auditRes.data || [])
      .filter((a: any) => a.id !== 'aud-1' && a.id !== 'aud-2')
      .map((a: any) => ({
      id: a.id,
      userId: a.user_id,
      userName: a.user_name,
      userRole: a.user_role,
      entityType: a.entity_type,
      entityId: a.entity_id,
      action: a.action,
      previousValue: a.previous_value,
      newValue: a.new_value,
      details: a.details || undefined,
      timestamp: a.timestamp
    }));

    let arubaConfig: ArubaConfig | undefined;
    if (settingsRes.data) {
      const arubaRow = settingsRes.data.find((s: any) => s.key === 'aruba_config');
      if (arubaRow && arubaRow.value) {
        arubaConfig = arubaRow.value as ArubaConfig;
      }
    }

    return {
      bankAccounts,
      entities,
      invoices,
      bankTransactions,
      contracts,
      employees,
      payrollRecords,
      taxRules,
      forecastItems,
      auditLogs,
      arubaConfig
    };
  } catch (err) {
    console.error('Error fetching data from Supabase:', err);
    return null;
  }
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// Salva o aggiorna dati su Supabase
export async function syncStateToSupabase(state: AppState): Promise<boolean> {
  try {
    // 1. Bank Accounts
    if (state.bankAccounts && state.bankAccounts.length > 0) {
      await supabase.from('bank_accounts').upsert(
        state.bankAccounts
          .filter(a => a.id !== 'bank-2' && a.id !== 'bank-3' && a.id !== 'bank-5-closed')
          .map(a => ({
            id: a.id,
            bank_name: a.bankName,
            account_number: a.accountNumber,
            iban: a.iban,
            initial_balance: a.initialBalance,
            initial_balance_date: a.initialBalanceDate,
            current_balance: a.currentBalance,
            last_updated: a.lastUpdated,
            credit_limit: a.creditLimit,
            is_active: a.isActive,
            notes: a.notes || null,
            updated_at: new Date().toISOString()
          }))
      );
    }

    // 2. Entities
    if (state.entities && state.entities.length > 0) {
      const entityRecords = state.entities.map(e => ({
        id: e.id,
        name: e.name,
        vat_number: e.vatNumber || null,
        tax_code: e.taxCode || null,
        type: e.type,
        email: e.email || null,
        phone: e.phone || null,
        is_active: e.isActive,
        standard_payment_terms_days: e.standardPaymentTermsDays || 30,
        updated_at: new Date().toISOString()
      }));

      for (const chunk of chunkArray(entityRecords, 100)) {
        await supabase.from('entities').upsert(chunk);
      }
    }

    // 3. Invoices & installments
    if (state.invoices && state.invoices.length > 0) {
      const invoiceRecords = state.invoices.map(i => ({
        id: i.id,
        number: i.number,
        type: i.type,
        counterpart_id: i.counterpartId || null,
        counterpart_name: i.counterpartName,
        issue_date: i.issueDate,
        economic_competence_month: i.economicCompetenceMonth,
        due_date: i.dueDate,
        taxable_amount: i.taxableAmount,
        vat_amount: i.vatAmount,
        total_amount: i.totalAmount,
        category: i.category,
        status: i.status,
        is_withholding_applicable: i.isWithholdingApplicable || false,
        withholding_rate: i.withholdingRate || null,
        withholding_amount: i.withholdingAmount || null,
        amount_credited_by_bank: i.amountCreditedByBank || null,
        amount_paid_by_client: i.amountPaidByClient || null,
        outstanding_amount: i.outstandingAmount,
        bank_transaction_id: i.bankTransactionId || null,
        is_active: i.isActive,
        imported_from: i.importedFrom || null,
        updated_at: new Date().toISOString()
      }));

      for (const chunk of chunkArray(invoiceRecords, 100)) {
        await supabase.from('invoices').upsert(chunk);
      }

      const allInstallments = state.invoices.flatMap(inv => 
        (inv.installments || []).map(inst => ({
          id: inst.id,
          invoice_id: inv.id,
          due_date: inst.dueDate,
          amount: inst.amount,
          paid_amount: inst.paidAmount,
          is_paid: inst.isPaid,
          paid_date: inst.paidDate || null,
          updated_at: new Date().toISOString()
        }))
      );

      if (allInstallments.length > 0) {
        for (const chunk of chunkArray(allInstallments, 150)) {
          await supabase.from('invoice_installments').upsert(chunk);
        }
      }
    }

    // 4. Bank Transactions
    if (state.bankTransactions && state.bankTransactions.length > 0) {
      const txRecords = state.bankTransactions
        .filter(t => t.bankAccountId !== 'bank-2' && t.bankAccountId !== 'bank-3' && t.bankAccountId !== 'bank-5-closed')
        .map(t => ({
          id: t.id,
          bank_account_id: t.bankAccountId || null,
          date: t.date,
          value_date: t.valueDate,
          amount: t.amount,
          description: t.description,
          counterpart: t.counterpart || null,
          reconciled: t.reconciled,
          reconciled_with_id: t.reconciledWithId || null,
          reconciled_type: t.reconciledType || null,
          imported_at: t.importedAt,
          hash: t.hash
        }));

      for (const chunk of chunkArray(txRecords, 150)) {
        await supabase.from('bank_transactions').upsert(chunk);
      }
    }

    // 5. Contracts
    if (state.contracts && state.contracts.length > 0) {
      await supabase.from('financial_contracts').upsert(
        state.contracts.map(c => ({
          id: c.id,
          title: c.title,
          type: c.type,
          counterpart: c.counterpart,
          start_date: c.startDate,
          end_date: c.endDate,
          total_financed: c.totalFinanced,
          installment_amount: c.installmentAmount,
          frequency: c.frequency,
          installments_count: c.installmentsCount,
          paid_installments_count: c.paidInstallmentsCount,
          principal_portion: c.principalPortion,
          interest_portion: c.interestPortion,
          bank_account_id: c.bankAccountId || null,
          is_active: c.isActive,
          next_due_date: c.nextDueDate,
          updated_at: new Date().toISOString()
        }))
      );
    }

    // 6. Employees & Payroll
    if (state.employees && state.employees.length > 0) {
      await supabase.from('employees').upsert(
        state.employees.map(e => ({
          id: e.id,
          full_name: e.fullName,
          tax_code: e.taxCode,
          role: e.role,
          contract_type: e.contractType,
          is_active: e.isActive,
          standard_gross_salary: e.standardGrossSalary,
          updated_at: new Date().toISOString()
        }))
      );
    }

    if (state.payrollRecords && state.payrollRecords.length > 0) {
      await supabase.from('payroll_records').upsert(
        state.payrollRecords.map(p => ({
          id: p.id,
          employee_id: p.employeeId || null,
          employee_name: p.employeeName,
          contract_type: p.contractType,
          month: p.month,
          gross_salary: p.grossSalary,
          taxable_base_contributory: p.taxableBaseContributory,
          employee_contributions: p.employeeContributions,
          employee_tax_withheld: p.employeeTaxWithheld,
          net_paid: p.netPaid,
          employer_contributions: p.employerContributions,
          severance_pay_accrual: p.severancePayAccrual,
          other_company_costs: p.otherCompanyCosts,
          total_company_cost: p.totalCompanyCost,
          is_company_cost_confirmed: p.isCompanyCostConfirmed,
          source: p.source,
          status: p.status,
          bank_transaction_id: p.bankTransactionId || null,
          updated_at: new Date().toISOString()
        }))
      );
    }

    // 7. Tax Rules
    if (state.taxRules && state.taxRules.length > 0) {
      await supabase.from('tax_rules').upsert(
        state.taxRules.map(tr => ({
          id: tr.id,
          code: tr.code,
          description: tr.description,
          category: tr.category,
          vat_deductible_rate: tr.vatDeductibleRate,
          tax_deductible_rate: tr.taxDeductibleRate,
          valid_from: tr.validFrom,
          valid_to: tr.validTo || null,
          status: tr.status,
          approved_by: tr.approvedBy || null,
          approved_at: tr.approvedAt || null,
          notes: tr.notes || null,
          updated_at: new Date().toISOString()
        }))
      );
    }

    // 8. Forecast Items
    if (state.forecastItems && state.forecastItems.length > 0) {
      await supabase.from('forecast_items').upsert(
        state.forecastItems.map(f => ({
          id: f.id,
          date: f.date,
          direction: f.direction,
          source_type: f.sourceType,
          reference_id: f.referenceId || null,
          description: f.description,
          counterpart: f.counterpart || null,
          expected_amount: f.expectedAmount,
          collection_probability: f.collectionProbability,
          weighted_amount: f.weightedAmount,
          horizon_days: f.horizonDays,
          is_manual_override: f.isManualOverride,
          original_date: f.originalDate || null,
          original_amount: f.originalAmount || null,
          override_note: f.overrideNote || null,
          updated_at: new Date().toISOString()
        }))
      );
    }

    // 9. Aruba Config / App Settings
    if (state.arubaConfig) {
      await supabase.from('app_settings').upsert({
        key: 'aruba_config',
        value: state.arubaConfig,
        updated_at: new Date().toISOString()
      });
    }

    return true;
  } catch (err) {
    console.error('Failed to sync state to Supabase:', err);
    return false;
  }
}

// Funzioni per cancellazioni fisiche su Supabase
export async function deleteBankAccountFromSupabase(id: string): Promise<boolean> {
  try {
    await supabase.from('bank_transactions').delete().eq('bank_account_id', id);
    const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
    return !error;
  } catch (err) {
    console.error('Error deleting bank account from Supabase:', err);
    return false;
  }
}

export async function deleteInvoiceFromSupabase(id: string): Promise<boolean> {
  try {
    await supabase.from('invoice_installments').delete().eq('invoice_id', id);
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    return !error;
  } catch (err) {
    console.error('Error deleting invoice from Supabase:', err);
    return false;
  }
}

export async function deleteBankTransactionFromSupabase(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('bank_transactions').delete().eq('id', id);
    return !error;
  } catch (err) {
    console.error('Error deleting transaction from Supabase:', err);
    return false;
  }
}

export async function deleteFinancialContractFromSupabase(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('financial_contracts').delete().eq('id', id);
    return !error;
  } catch (err) {
    console.error('Error deleting financial contract from Supabase:', err);
    return false;
  }
}

export async function deletePayrollRecordFromSupabase(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('payroll_records').delete().eq('id', id);
    return !error;
  } catch (err) {
    console.error('Error deleting payroll record from Supabase:', err);
    return false;
  }
}



