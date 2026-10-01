'use client';

import React, { useState, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { 
  CheckCheck, 
  UploadCloud, 
  FileText, 
  Receipt, 
  Landmark, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight, 
  Search, 
  Check, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  FileSpreadsheet, 
  Layers, 
  Calendar,
  AlertTriangle,
  Info,
  DollarSign,
  Filter,
  Eye,
  X
} from 'lucide-react';
import { Invoice, BankTransaction, BankAccount, PayrollRecord, ReconciliationMatchSuggestion } from '@/financial-engine/types';
import { 
  findBankReconciliationMatches, 
  reconcileInvoiceWithTransaction, 
  unreconcileInvoiceTransaction,
  validatePayrollCalculations,
  matchBankWithPayroll,
  syncEntitiesFromInvoices
} from '@/financial-engine/calculations';
import { parseUniversalBankStatementFile, StatementParseResult } from '@/lib/bank-statement-parser';
import { importInvoicesFromFile, InvoiceImportResult } from '@/lib/invoice-import-parser';
import { parsePdfPayroll, PayrollPdfParseResult } from '@/lib/pdf-payroll-parser';
import { addAuditLog, AppState } from '@/lib/store';
import { formatEuro, formatPercent } from '@/lib/format';

export default function AllineamentoPage() {
  const [activeTab, setActiveTab] = useState<'reconciliation' | 'upload' | 'payroll'>('reconciliation');

  // Filtri scheda riconciliazione
  const [selectedBankFilter, setSelectedBankFilter] = useState('all');
  const [selectedDirectionFilter, setSelectedDirectionFilter] = useState<'all' | 'inflow' | 'outflow'>('all');
  const [searchTxQuery, setSearchTxQuery] = useState('');
  const [reconciledStatusFilter, setReconciledStatusFilter] = useState<'unreconciled' | 'reconciled' | 'all'>('unreconciled');

  // Modale abbinamento manuale
  const [manualMatchModalTx, setManualMatchModalTx] = useState<BankTransaction | null>(null);
  const [manualSearchInvoice, setManualSearchInvoice] = useState('');
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [manualIsWithholding, setManualIsWithholding] = useState(false);
  const [manualWithholdingRate, setManualWithholdingRate] = useState(0.11);

  // Stato per Caricamento Estratto Conto (PDF/CSV)
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [statementTargetBankId, setStatementTargetBankId] = useState<string>('bank-1');
  const [statementParseResult, setStatementParseResult] = useState<StatementParseResult | null>(null);
  const [isParsingStatement, setIsParsingStatement] = useState(false);

  // Stato per Caricamento Fatture (PDF/XML/ZIP)
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceParseResult, setInvoiceParseResult] = useState<InvoiceImportResult | null>(null);
  const [isParsingInvoice, setIsParsingInvoice] = useState(false);

  // Stato per Caricamento Buste Paga (PDF)
  const [payrollFile, setPayrollFile] = useState<File | null>(null);
  const [payrollParseResult, setPayrollParseResult] = useState<PayrollPdfParseResult | null>(null);
  const [isParsingPayroll, setIsParsingPayroll] = useState(false);

  // Mese selezionato per la scheda buste paga
  const [selectedPayrollMonth, setSelectedPayrollMonth] = useState('2026-08');

  return (
    <AppLayout>
      {({ state, updateState, currentRole }) => {
        const bankAccounts = state.bankAccounts || [];
        const bankTransactions = state.bankTransactions || [];
        const invoices = state.invoices || [];
        const payrollRecords = state.payrollRecords || [];
        const employees = state.employees || [];

        // Calcolo suggerimenti di matching automatico
        const matchSuggestions = useMemo(() => {
          return findBankReconciliationMatches({
            transactions: bankTransactions,
            invoices: invoices
          });
        }, [bankTransactions, invoices]);

        const suggestionsByTxId = useMemo(() => {
          const map = new Map<string, ReconciliationMatchSuggestion>();
          matchSuggestions.forEach(s => {
            if (!map.has(s.transaction.id)) {
              map.set(s.transaction.id, s);
            }
          });
          return map;
        }, [matchSuggestions]);

        // Filtro transazioni per la tabella
        const filteredTransactions = useMemo(() => {
          return bankTransactions.filter(tx => {
            if (selectedBankFilter !== 'all' && tx.bankAccountId !== selectedBankFilter) {
              return false;
            }
            if (selectedDirectionFilter === 'inflow' && tx.amount <= 0) return false;
            if (selectedDirectionFilter === 'outflow' && tx.amount >= 0) return false;

            if (reconciledStatusFilter === 'unreconciled' && tx.reconciled) return false;
            if (reconciledStatusFilter === 'reconciled' && !tx.reconciled) return false;

            if (searchTxQuery.trim()) {
              const q = searchTxQuery.toLowerCase();
              const mDesc = (tx.description || '').toLowerCase().includes(q);
              const mCp = (tx.counterpart || '').toLowerCase().includes(q);
              const mAmount = Math.abs(tx.amount).toFixed(2).includes(q);
              if (!mDesc && !mCp && !mAmount) return false;
            }

            return true;
          });
        }, [bankTransactions, selectedBankFilter, selectedDirectionFilter, reconciledStatusFilter, searchTxQuery]);

        // Conteggi per badge
        const unreconciledCount = bankTransactions.filter(t => !t.reconciled).length;
        const certMatchCount = matchSuggestions.filter(s => s.confidenceLabel === 'alta').length;

        // Azione: Riconcilia suggerimento singolo
        const handleReconcileSuggestion = (suggestion: ReconciliationMatchSuggestion) => {
          if (currentRole !== 'amministrazione') {
            alert('Solo il ruolo Amministrazione può riconciliare transazioni.');
            return;
          }

          const isWithholding = suggestion.matchReason === 'withholding_parlante';
          const { updatedInvoice, updatedTransaction } = reconcileInvoiceWithTransaction({
            invoice: suggestion.matchedInvoice,
            transaction: suggestion.transaction,
            options: {
              isWithholding,
              withholdingRate: isWithholding ? 0.11 : undefined
            }
          });

          const updatedInvoices = state.invoices.map(i => i.id === updatedInvoice.id ? updatedInvoice : i);
          const updatedTransactions = state.bankTransactions.map(t => t.id === updatedTransaction.id ? updatedTransaction : t);

          let updatedState: AppState = {
            ...state,
            invoices: updatedInvoices,
            bankTransactions: updatedTransactions
          };

          updatedState = addAuditLog(updatedState, {
            entityType: 'RECONCILIATION',
            entityId: suggestion.transaction.id,
            action: 'RECONCILE',
            details: `Riconciliato movimento ${suggestion.transaction.amount > 0 ? 'accredito' : 'addebito'} di € ${Math.abs(suggestion.transaction.amount).toFixed(2)} con fattura ${updatedInvoice.type === 'active' ? 'emessa' : 'ricevuta'} N. ${updatedInvoice.number} (${updatedInvoice.counterpartName}).${isWithholding ? ' Applicato bonifico parlante con ritenuta 11%.' : ''}`
          });

          updateState(updatedState);
        };

        // Azione: Riconcilia tutti i match certi (100%)
        const handleReconcileAllCertain = () => {
          if (currentRole !== 'amministrazione') {
            alert('Solo il ruolo Amministrazione può eseguire riconciliazioni massive.');
            return;
          }

          const certainSuggestions = matchSuggestions.filter(s => s.confidenceLabel === 'alta');
          if (certainSuggestions.length === 0) {
            alert('Nessun abbinamento ad alta confidenza da riconciliare.');
            return;
          }

          if (!confirm(`Confermi la riconciliazione automatica di ${certainSuggestions.length} movimenti bancari con le rispettive fatture?`)) {
            return;
          }

          let currentInvoices = [...state.invoices];
          let currentTransactions = [...state.bankTransactions];

          certainSuggestions.forEach(s => {
            const inv = currentInvoices.find(i => i.id === s.matchedInvoice.id);
            const tx = currentTransactions.find(t => t.id === s.transaction.id);
            if (inv && tx && !tx.reconciled) {
              const isWithholding = s.matchReason === 'withholding_parlante';
              const { updatedInvoice, updatedTransaction } = reconcileInvoiceWithTransaction({
                invoice: inv,
                transaction: tx,
                options: {
                  isWithholding,
                  withholdingRate: isWithholding ? 0.11 : undefined
                }
              });
              currentInvoices = currentInvoices.map(i => i.id === updatedInvoice.id ? updatedInvoice : i);
              currentTransactions = currentTransactions.map(t => t.id === updatedTransaction.id ? updatedTransaction : t);
            }
          });

          let updatedState: AppState = {
            ...state,
            invoices: currentInvoices,
            bankTransactions: currentTransactions
          };

          updatedState = addAuditLog(updatedState, {
            entityType: 'RECONCILIATION',
            entityId: 'batch-reconcile',
            action: 'RECONCILE',
            details: `Riconciliazione massiva completata: abbinati ${certainSuggestions.length} movimenti bancari con fatture attive e passive.`
          });

          updateState(updatedState);
        };

        // Azione: Scollega / Annulla Riconciliazione (Undo)
        const handleUnreconcile = (tx: BankTransaction) => {
          if (currentRole !== 'amministrazione') {
            alert('Solo il ruolo Amministrazione può annullare riconciliazioni.');
            return;
          }

          if (!tx.reconciled || !tx.reconciledWithId) return;

          const inv = state.invoices.find(i => i.id === tx.reconciledWithId);
          if (!inv) {
            // Se la fattura non esiste, resetta solo la transazione
            const updatedTransactions = state.bankTransactions.map(t => t.id === tx.id ? { ...t, reconciled: false, reconciledWithId: undefined, reconciledType: undefined } : t);
            updateState({ ...state, bankTransactions: updatedTransactions });
            return;
          }

          const { updatedInvoice, updatedTransaction } = unreconcileInvoiceTransaction({
            invoice: inv,
            transaction: tx
          });

          const updatedInvoices = state.invoices.map(i => i.id === updatedInvoice.id ? updatedInvoice : i);
          const updatedTransactions = state.bankTransactions.map(t => t.id === updatedTransaction.id ? updatedTransaction : t);

          let updatedState: AppState = {
            ...state,
            invoices: updatedInvoices,
            bankTransactions: updatedTransactions
          };

          updatedState = addAuditLog(updatedState, {
            entityType: 'RECONCILIATION',
            entityId: tx.id,
            action: 'UPDATE',
            details: `Annullata riconciliazione tra transazione € ${Math.abs(tx.amount).toFixed(2)} e fattura N. ${inv.number}. Ripristinato stato fattura a '${updatedInvoice.status}'.`
          });

          updateState(updatedState);
        };

        // Azione: Abbinamento manuale confermato
        const handleConfirmManualMatch = () => {
          if (!manualMatchModalTx || selectedInvoiceIds.length === 0) return;
          if (currentRole !== 'amministrazione') {
            alert('Solo il ruolo Amministrazione può riconciliare transazioni.');
            return;
          }

          let currentInvoices = [...state.invoices];
          let currentTx = { ...manualMatchModalTx };

          // Per ora abbina alla prima fattura selezionata (o gestisce cumulativo)
          const targetInvoice = currentInvoices.find(i => i.id === selectedInvoiceIds[0]);
          if (!targetInvoice) return;

          const { updatedInvoice, updatedTransaction } = reconcileInvoiceWithTransaction({
            invoice: targetInvoice,
            transaction: currentTx,
            options: {
              isWithholding: manualIsWithholding,
              withholdingRate: manualIsWithholding ? manualWithholdingRate : undefined
            }
          });

          currentInvoices = currentInvoices.map(i => i.id === updatedInvoice.id ? updatedInvoice : i);
          const updatedTransactions = state.bankTransactions.map(t => t.id === updatedTransaction.id ? updatedTransaction : t);

          let updatedState: AppState = {
            ...state,
            invoices: currentInvoices,
            bankTransactions: updatedTransactions
          };

          updatedState = addAuditLog(updatedState, {
            entityType: 'RECONCILIATION',
            entityId: currentTx.id,
            action: 'RECONCILE',
            details: `Abbinamento manuale: movimento € ${Math.abs(currentTx.amount).toFixed(2)} collegato a fattura N. ${updatedInvoice.number} (${updatedInvoice.counterpartName}).`
          });

          updateState(updatedState);
          setManualMatchModalTx(null);
          setSelectedInvoiceIds([]);
        };

        // Gestione Caricamento File Estratto Conto (PDF o CSV)
        const handleStatementFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (!file) return;

          setStatementFile(file);
          setIsParsingStatement(true);
          try {
            const targetAccount = bankAccounts.find(a => a.id === statementTargetBankId) || bankAccounts[0];
            const res = await parseUniversalBankStatementFile({
              file,
              bankAccountId: statementTargetBankId,
              currentBankBalance: targetAccount?.currentBalance || 0,
              existingTransactions: bankTransactions.filter(t => t.bankAccountId === statementTargetBankId)
            });
            setStatementParseResult(res);
          } catch (err: any) {
            alert(`Errore lettura file estratto conto: ${err.message}`);
          } finally {
            setIsParsingStatement(false);
          }
        };

        // Conferma Salvataggio Estratto Conto
        const handleConfirmSaveStatement = () => {
          if (!statementParseResult || statementParseResult.transactions.length === 0) return;
          if (currentRole !== 'amministrazione') {
            alert('Solo il ruolo Amministrazione può salvare transazioni.');
            return;
          }

          const newTransactions: BankTransaction[] = statementParseResult.transactions
            .filter(t => !t.isDuplicate)
            .map(t => ({
              id: t.id,
              bankAccountId: statementParseResult.bankAccountId,
              date: t.date,
              valueDate: t.valueDate,
              amount: t.amount,
              description: t.description,
              counterpart: t.counterpart,
              reconciled: false,
              importedAt: new Date().toISOString(),
              hash: t.hash
            }));

          const updatedAccounts = state.bankAccounts.map(b => {
            if (b.id === statementParseResult.bankAccountId) {
              const newBalance = statementParseResult.detectedClosingBalance !== undefined
                ? statementParseResult.detectedClosingBalance
                : (b.currentBalance + statementParseResult.netMovement);
              return {
                ...b,
                currentBalance: Number(newBalance.toFixed(2)),
                lastUpdated: new Date().toISOString().split('T')[0]
              };
            }
            return b;
          });

          let updatedState: AppState = {
            ...state,
            bankAccounts: updatedAccounts,
            bankTransactions: [...newTransactions, ...state.bankTransactions]
          };

          updatedState = addAuditLog(updatedState, {
            entityType: 'BANK_STATEMENT',
            entityId: statementParseResult.bankAccountId,
            action: 'CREATE',
            details: `Importato estratto conto (${statementParseResult.fileName}): acquisiti ${newTransactions.length} nuovi movimenti, rilevati ${statementParseResult.duplicatesCount} duplicati.`
          });

          updateState(updatedState);
          setStatementFile(null);
          setStatementParseResult(null);
          alert(`Estratto conto importato con successo! ${newTransactions.length} nuovi movimenti registrati.`);
        };

        // Gestione Caricamento Fatture (PDF, XML, ZIP)
        const handleInvoiceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (!file) return;

          setInvoiceFile(file);
          setIsParsingInvoice(true);
          try {
            const res = await importInvoicesFromFile({
              file,
              existingInvoices: invoices,
              currentEntities: state.entities
            });
            setInvoiceParseResult(res);
          } catch (err: any) {
            alert(`Errore lettura fatture: ${err.message}`);
          } finally {
            setIsParsingInvoice(false);
          }
        };

        // Conferma Salvataggio Fatture
        const handleConfirmSaveInvoices = () => {
          if (!invoiceParseResult || invoiceParseResult.importedInvoices.length === 0) return;
          if (currentRole !== 'amministrazione') {
            alert('Solo il ruolo Amministrazione può salvare fatture.');
            return;
          }

          const allInvoices = [...invoiceParseResult.importedInvoices, ...state.invoices];
          const entitySync = syncEntitiesFromInvoices(state.entities, allInvoices);

          let updatedState: AppState = {
            ...state,
            invoices: allInvoices,
            entities: entitySync.updatedEntities
          };

          updatedState = addAuditLog(updatedState, {
            entityType: 'INVOICE_IMPORT',
            entityId: invoiceParseResult.fileName,
            action: 'CREATE',
            details: `Importazione mensile fatture (${invoiceParseResult.fileName}): ${invoiceParseResult.newCount} nuove fatture aperte (${invoiceParseResult.activeCount} emesse, ${invoiceParseResult.passiveCount} ricevute). Censite ${entitySync.createdCount} nuove anagrafiche.`
          });

          updateState(updatedState);
          setInvoiceFile(null);
          setInvoiceParseResult(null);
          alert(`Fatture importate con successo! ${invoiceParseResult.newCount} nuove fatture pronte per l'allineamento con la banca.`);
        };

        // Gestione Caricamento Buste Paga (PDF)
        const handlePayrollFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (!file) return;

          setPayrollFile(file);
          setIsParsingPayroll(true);
          try {
            const res = await parsePdfPayroll(file, file.name, employees);
            setPayrollParseResult(res);
            if (res.month) {
              setSelectedPayrollMonth(res.month);
            }
          } catch (err: any) {
            alert(`Errore lettura buste paga PDF: ${err.message}`);
          } finally {
            setIsParsingPayroll(false);
          }
        };

        // Conferma Salvataggio Buste Paga
        const handleConfirmSavePayroll = () => {
          if (!payrollParseResult || payrollParseResult.records.length === 0) return;
          if (currentRole !== 'amministrazione') {
            alert('Solo il ruolo Amministrazione può salvare cedolini.');
            return;
          }

          // Filtra eventuali record già presenti per lo stesso mese e dipendente per sostituirli o aggiornarli
          const newEmpIds = new Set(payrollParseResult.records.map(r => r.employeeId));
          const existingFiltered = state.payrollRecords.filter(
            p => !(p.month === payrollParseResult.month && newEmpIds.has(p.employeeId))
          );

          const updatedRecords = [...payrollParseResult.records, ...existingFiltered];

          let updatedState: AppState = {
            ...state,
            payrollRecords: updatedRecords
          };

          updatedState = addAuditLog(updatedState, {
            entityType: 'PAYROLL_IMPORT',
            entityId: payrollParseResult.month,
            action: 'CREATE',
            details: `Importazione buste paga PDF (${payrollParseResult.fileName}): registrati ${payrollParseResult.records.length} cedolini per il mese ${payrollParseResult.month} (totale netti: € ${payrollParseResult.totalNet.toFixed(2)}).`
          });

          updateState(updatedState);
          setPayrollFile(null);
          setPayrollParseResult(null);
          alert(`Buste paga importate con successo! ${payrollParseResult.records.length} cedolini registrati per il mese ${payrollParseResult.month}.`);
        };

        // Dati scheda buste paga per il mese attivo
        const payrollForMonth = payrollRecords.filter(p => p.month === selectedPayrollMonth);
        const payrollAlignment = matchBankWithPayroll({
          transactions: bankTransactions,
          payrollRecords: payrollRecords,
          month: selectedPayrollMonth
        });

        // Azione: Riconcilia stipendi con movimento banca
        const handleReconcilePayrollBatch = (tx: BankTransaction) => {
          if (currentRole !== 'amministrazione') {
            alert('Solo il ruolo Amministrazione può riconciliare stipendi.');
            return;
          }

          const updatedPayroll = state.payrollRecords.map(p => {
            if (p.month === selectedPayrollMonth) {
              return {
                ...p,
                status: 'paid' as const,
                bankTransactionId: tx.id,
                reconciledDate: tx.date
              };
            }
            return p;
          });

          const updatedTransactions = state.bankTransactions.map(t => {
            if (t.id === tx.id) {
              return {
                ...t,
                reconciled: true,
                reconciledWithId: `payroll-${selectedPayrollMonth}`,
                reconciledType: 'payroll' as const,
                reconciledDate: tx.date,
                reconciledCounterpart: 'Personale Dipendente (Stipendi)'
              };
            }
            return t;
          });

          let updatedState: AppState = {
            ...state,
            payrollRecords: updatedPayroll,
            bankTransactions: updatedTransactions
          };

          updatedState = addAuditLog(updatedState, {
            entityType: 'RECONCILIATION',
            entityId: tx.id,
            action: 'RECONCILE',
            details: `Riconciliati stipendi del personale per il mese ${selectedPayrollMonth} con movimento bancario di uscita € ${Math.abs(tx.amount).toFixed(2)}.`
          });

          updateState(updatedState);
          alert(`Stipendi del mese ${selectedPayrollMonth} riconciliati e segnati come pagati!`);
        };

        return (
          <div className="space-y-6">
            {/* Header Principale */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="p-2 rounded-xl bg-sky-50 text-sky-600 font-semibold">
                    <CheckCheck className="w-6 h-6" />
                  </span>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                    Centro Allineamento & Riconciliazione Mensile
                  </h1>
                </div>
                <p className="text-sm text-slate-500">
                  Caricamento universale (PDF, XML, CSV), quadratura estratti conto bancari con fatture e allineamento buste paga.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTab('upload')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold transition-all shadow-sm"
                >
                  <UploadCloud className="w-4 h-4 text-slate-600" />
                  Carica File del Mese
                </button>
                {certMatchCount > 0 && activeTab === 'reconciliation' && (
                  <button
                    onClick={handleReconcileAllCertain}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all shadow-sm shadow-emerald-200"
                  >
                    <Sparkles className="w-4 h-4" />
                    Riconcilia {certMatchCount} Match Certi (1-Click)
                  </button>
                )}
              </div>
            </div>

            {/* Navigazione Schede (Tabs) */}
            <div className="flex items-center border-b border-slate-200 gap-2">
              <button
                onClick={() => setActiveTab('reconciliation')}
                className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === 'reconciliation'
                    ? 'border-sky-600 text-sky-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <CheckCheck className="w-4 h-4" />
                Riconciliazione Banca ↔ Fatture
                {unreconciledCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                    {unreconciledCount} da riconciliare
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('upload')}
                className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === 'upload'
                    ? 'border-sky-600 text-sky-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <UploadCloud className="w-4 h-4" />
                Caricamento Universale (PDF, XML, CSV)
              </button>

              <button
                onClick={() => setActiveTab('payroll')}
                className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === 'payroll'
                    ? 'border-sky-600 text-sky-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users className="w-4 h-4" />
                Buste Paga & Costi Personale
              </button>
            </div>

            {/* TAB 1: RICONCILIAZIONE BANCA ↔ FATTURE */}
            {activeTab === 'reconciliation' && (
              <div className="space-y-6">
                {/* Barra Filtri */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative min-w-[240px]">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        placeholder="Cerca per causale, controparte o importo..."
                        value={searchTxQuery}
                        onChange={(e) => setSearchTxQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <select
                      value={selectedBankFilter}
                      onChange={(e) => setSelectedBankFilter(e.target.value)}
                      className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="all">Tutti i Conti Bancari</option>
                      {bankAccounts.map(b => (
                        <option key={b.id} value={b.id}>{b.bankName}</option>
                      ))}
                    </select>

                    <select
                      value={selectedDirectionFilter}
                      onChange={(e) => setSelectedDirectionFilter(e.target.value as any)}
                      className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="all">Tutte le Direzioni</option>
                      <option value="inflow">Solo Accrediti (Clienti)</option>
                      <option value="outflow">Solo Addebiti (Fornitori/Spese)</option>
                    </select>

                    <div className="flex rounded-xl bg-slate-100 p-1">
                      <button
                        onClick={() => setReconciledStatusFilter('unreconciled')}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                          reconciledStatusFilter === 'unreconciled'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Da Riconciliare ({unreconciledCount})
                      </button>
                      <button
                        onClick={() => setReconciledStatusFilter('reconciled')}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                          reconciledStatusFilter === 'reconciled'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Già Riconciliati ({bankTransactions.filter(t => t.reconciled).length})
                      </button>
                      <button
                        onClick={() => setReconciledStatusFilter('all')}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                          reconciledStatusFilter === 'all'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Tutti
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500">
                    Mostrati <span className="font-bold text-slate-800">{filteredTransactions.length}</span> movimenti
                  </div>
                </div>

                {/* Tabella Movimenti con Abbinamento Suggerito */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Data / Conto</th>
                          <th className="py-3 px-4">Movimento Estratto Conto</th>
                          <th className="py-3 px-4 text-right">Importo</th>
                          <th className="py-3 px-4">Abbinamento Fattura Suggerito / Stato</th>
                          <th className="py-3 px-4 text-right">Azione</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredTransactions.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-slate-400">
                              <CheckCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                              Nessun movimento bancario corrispondente ai filtri selezionati.
                            </td>
                          </tr>
                        ) : (
                          filteredTransactions.map(tx => {
                            const isCredit = tx.amount > 0;
                            const bank = bankAccounts.find(b => b.id === tx.bankAccountId);
                            const suggestion = suggestionsByTxId.get(tx.id);
                            const reconciledInvoice = tx.reconciled && tx.reconciledWithId 
                              ? invoices.find(i => i.id === tx.reconciledWithId) 
                              : null;

                            return (
                              <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-3.5 px-4 align-top">
                                  <div className="font-semibold text-slate-800">{tx.date}</div>
                                  <div className="text-xs text-slate-400 truncate max-w-[140px]" title={bank?.bankName}>
                                    {bank?.bankName || 'Banca'}
                                  </div>
                                </td>

                                <td className="py-3.5 px-4 align-top max-w-[320px]">
                                  <div className="font-medium text-slate-800 leading-snug line-clamp-2">
                                    {tx.description}
                                  </div>
                                  {tx.counterpart && (
                                    <div className="text-xs font-semibold text-sky-600 mt-0.5">
                                      {tx.counterpart}
                                    </div>
                                  )}
                                </td>

                                <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                                  <span className={`font-bold inline-flex items-center gap-0.5 ${isCredit ? 'text-emerald-600' : 'text-slate-800'}`}>
                                    {isCredit ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />}
                                    {isCredit ? '+' : ''}{formatEuro(tx.amount)} €
                                  </span>
                                </td>

                                <td className="py-3.5 px-4 align-top">
                                  {tx.reconciled ? (
                                    <div className="space-y-1">
                                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                        <Check className="w-3 h-3 text-emerald-600" />
                                        Riconciliato ({tx.reconciledType})
                                      </div>
                                      {reconciledInvoice && (
                                        <div className="text-xs text-slate-600 font-medium">
                                          Ft. N. <span className="font-bold">{reconciledInvoice.number}</span> - {reconciledInvoice.counterpartName}
                                        </div>
                                      )}
                                      {tx.reconciledCounterpart && !reconciledInvoice && (
                                        <div className="text-xs text-slate-500">
                                          {tx.reconciledCounterpart}
                                        </div>
                                      )}
                                    </div>
                                  ) : suggestion ? (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5">
                                        {suggestion.matchReason === 'withholding_parlante' ? (
                                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                            Bonifico Parlante (Ritenuta 11%)
                                          </span>
                                        ) : suggestion.confidenceLabel === 'alta' ? (
                                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                            Match Certo ({Math.round(suggestion.confidenceScore * 100)}%)
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                            Match Probabile ({Math.round(suggestion.confidenceScore * 100)}%)
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs font-semibold text-slate-800">
                                        {suggestion.matchedInvoice.type === 'active' ? 'Cliente:' : 'Fornitore:'} {suggestion.matchedInvoice.counterpartName}
                                      </div>
                                      <div className="text-xs text-slate-500">
                                        Ft. N. {suggestion.matchedInvoice.number} del {suggestion.matchedInvoice.issueDate} (Tot: € {formatEuro(suggestion.matchedInvoice.totalAmount)})
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-400 italic">
                                      Nessun abbinamento automatico rilevato
                                    </span>
                                  )}
                                </td>

                                <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                                  {tx.reconciled ? (
                                    <button
                                      onClick={() => handleUnreconcile(tx)}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-xs font-semibold text-slate-600 hover:text-rose-700 transition-all"
                                      title="Annulla la riconciliazione e ripristina la fattura a non saldata"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      Scollega
                                    </button>
                                  ) : suggestion ? (
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        onClick={() => handleReconcileSuggestion(suggestion)}
                                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
                                          suggestion.matchReason === 'withholding_parlante'
                                            ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-100'
                                            : suggestion.confidenceLabel === 'alta'
                                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100'
                                              : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-100'
                                        }`}
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        Riconcilia
                                      </button>
                                      <button
                                        onClick={() => {
                                          setManualMatchModalTx(tx);
                                          setSelectedInvoiceIds([suggestion.matchedInvoice.id]);
                                          setManualIsWithholding(suggestion.matchReason === 'withholding_parlante');
                                        }}
                                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all"
                                        title="Modifica o verifica abbinamento manualmente"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setManualMatchModalTx(tx);
                                        setSelectedInvoiceIds([]);
                                        setManualIsWithholding(false);
                                      }}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-sky-50 hover:border-sky-200 text-xs font-semibold text-slate-700 hover:text-sky-700 transition-all"
                                    >
                                      <Search className="w-3 h-3" />
                                      Abbina Manualmente
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: CARICAMENTO MENSILE UNIVERSALE (PDF, XML, CSV) */}
            {activeTab === 'upload' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Card 1: Estratto Conto Bancario */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 rounded-xl bg-sky-50 text-sky-600">
                        <Landmark className="w-6 h-6" />
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                        PDF, CSV, TSV
                      </span>
                    </div>

                    <h2 className="text-lg font-bold text-slate-900 mb-1">
                      1. Estratto Conto Bancario
                    </h2>
                    <p className="text-xs text-slate-500 mb-4">
                      Carica l'estratto conto mensile o la lista movimenti scaricata dal remote banking in formato PDF o CSV.
                    </p>

                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Conto di Destinazione
                      </label>
                      <select
                        value={statementTargetBankId}
                        onChange={(e) => setStatementTargetBankId(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        {bankAccounts.map(b => (
                          <option key={b.id} value={b.id}>{b.bankName} (Sal: € {formatEuro(b.currentBalance)})</option>
                        ))}
                      </select>
                    </div>

                    <div className="border-2 border-dashed border-slate-200 hover:border-sky-400 rounded-xl p-5 text-center cursor-pointer transition-colors relative mb-4">
                      <input
                        type="file"
                        accept=".pdf,.csv,.tsv,.txt"
                        onChange={handleStatementFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <UploadCloud className="w-8 h-8 text-sky-500 mx-auto mb-2" />
                      <div className="text-xs font-semibold text-slate-800">
                        {statementFile ? statementFile.name : 'Trascina o seleziona PDF o CSV'}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Deduplicazione automatica tramite hash
                      </div>
                    </div>

                    {isParsingStatement && (
                      <div className="p-3 bg-sky-50 text-sky-700 rounded-xl text-xs flex items-center gap-2 mb-4">
                        <span className="animate-spin">🔄</span>
                        Analisi ed estrazione del documento in corso...
                      </div>
                    )}

                    {statementParseResult && (
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 mb-4 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Nuovi Movimenti:</span>
                          <span className="font-bold text-emerald-600">{statementParseResult.newTransactionsCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Duplicati Rilevati:</span>
                          <span className="font-bold text-slate-500">{statementParseResult.duplicatesCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Totale Entrate:</span>
                          <span className="font-semibold text-emerald-600">+€ {formatEuro(statementParseResult.totalInflows)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Totale Uscite:</span>
                          <span className="font-semibold text-rose-600">-€ {formatEuro(statementParseResult.totalOutflows)}</span>
                        </div>
                        {statementParseResult.detectedClosingBalance !== undefined && (
                          <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold">
                            <span className="text-slate-700">Saldo Finale Rilevato:</span>
                            <span className="text-sky-700">€ {formatEuro(statementParseResult.detectedClosingBalance)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    disabled={!statementParseResult || statementParseResult.newTransactionsCount === 0}
                    onClick={handleConfirmSaveStatement}
                    className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:pointer-events-none text-white text-sm font-semibold transition-all shadow-sm"
                  >
                    Salva in Tesoreria ({statementParseResult?.newTransactionsCount || 0} nuovi)
                  </button>
                </div>

                {/* Card 2: Fatture Emesse e Ricevute */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
                        <Receipt className="w-6 h-6" />
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                        PDF, XML, ZIP
                      </span>
                    </div>

                    <h2 className="text-lg font-bold text-slate-900 mb-1">
                      2. Fatture del Mese
                    </h2>
                    <p className="text-xs text-slate-500 mb-4">
                      Carica fatture emesse o ricevute in PDF (copie di cortesia/parcelle), file XML singoli o archivio ZIP mensile SDI.
                    </p>

                    <div className="border-2 border-dashed border-slate-200 hover:border-purple-400 rounded-xl p-5 text-center cursor-pointer transition-colors relative mb-4">
                      <input
                        type="file"
                        accept=".pdf,.xml,.p7m,.zip"
                        onChange={handleInvoiceFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <UploadCloud className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                      <div className="text-xs font-semibold text-slate-800">
                        {invoiceFile ? invoiceFile.name : 'Trascina PDF, ZIP o XML'}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Le nuove fatture entrano aperte (da riconciliare)
                      </div>
                    </div>

                    {isParsingInvoice && (
                      <div className="p-3 bg-purple-50 text-purple-700 rounded-xl text-xs flex items-center gap-2 mb-4">
                        <span className="animate-spin">🔄</span>
                        Parsing del file fatture in corso...
                      </div>
                    )}

                    {invoiceParseResult && (
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 mb-4 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Nuove Fatture:</span>
                          <span className="font-bold text-purple-700">{invoiceParseResult.newCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Fatture Emesse (Clienti):</span>
                          <span className="font-semibold text-emerald-600">{invoiceParseResult.activeCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Fatture Ricevute (Fornitori):</span>
                          <span className="font-semibold text-rose-600">{invoiceParseResult.passiveCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Duplicati Evitati:</span>
                          <span className="font-bold text-slate-400">{invoiceParseResult.duplicatesCount}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold">
                          <span className="text-slate-700">Totale Importo:</span>
                          <span className="text-purple-700">€ {formatEuro(invoiceParseResult.totalAmountSum)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    disabled={!invoiceParseResult || invoiceParseResult.newCount === 0}
                    onClick={handleConfirmSaveInvoices}
                    className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:pointer-events-none text-white text-sm font-semibold transition-all shadow-sm"
                  >
                    Importa ({invoiceParseResult?.newCount || 0} fatture aperte)
                  </button>
                </div>

                {/* Card 3: Buste Paga & Cedolini */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
                        <Users className="w-6 h-6" />
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                        PDF
                      </span>
                    </div>

                    <h2 className="text-lg font-bold text-slate-900 mb-1">
                      3. Buste Paga (JOB / Paghe)
                    </h2>
                    <p className="text-xs text-slate-500 mb-4">
                      Carica il file PDF dei cedolini mensili del personale con estrazione di lordo, contributi, ritenute e netti.
                    </p>

                    <div className="border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-xl p-5 text-center cursor-pointer transition-colors relative mb-4">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handlePayrollFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <UploadCloud className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      <div className="text-xs font-semibold text-slate-800">
                        {payrollFile ? payrollFile.name : 'Trascina PDF Cedolini del Mese'}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Controllo quadratura formule matematiche
                      </div>
                    </div>

                    {isParsingPayroll && (
                      <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs flex items-center gap-2 mb-4">
                        <span className="animate-spin">🔄</span>
                        Lettura cedolini PDF e verifica quadratura...
                      </div>
                    )}

                    {payrollParseResult && (
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 mb-4 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Mese Rilevato:</span>
                          <span className="font-bold text-slate-800">{payrollParseResult.month}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Dipendenti Estratti:</span>
                          <span className="font-bold text-emerald-700">{payrollParseResult.records.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Totale Competenze/Lordo:</span>
                          <span className="font-semibold text-slate-800">€ {formatEuro(payrollParseResult.totalGross)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Totale Netti da Bonificare:</span>
                          <span className="font-bold text-emerald-600">€ {formatEuro(payrollParseResult.totalNet)}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold">
                          <span className="text-slate-700">Quadratura Conteggi:</span>
                          <span className={payrollParseResult.allValid ? 'text-emerald-600 flex items-center gap-1' : 'text-amber-600'}>
                            {payrollParseResult.allValid ? <><Check className="w-3.5 h-3.5" /> Corretta</> : 'Con Avvisi'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    disabled={!payrollParseResult || payrollParseResult.records.length === 0}
                    onClick={handleConfirmSavePayroll}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none text-white text-sm font-semibold transition-all shadow-sm"
                  >
                    Salva Cedolini ({payrollParseResult?.records.length || 0} dipendenti)
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: BUSTE PAGA & COSTI PERSONALE */}
            {activeTab === 'payroll' && (
              <div className="space-y-6">
                {/* Selettore Mese e Riepilogo */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-sky-600" />
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        Quadro Cedolini & Allineamento Salari Mese
                      </h2>
                      <p className="text-xs text-slate-500">
                        Controllo quadratura competenze/netti e associazione con uscite bancarie per stipendi ed F24.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-600">Mese:</label>
                    <input
                      type="month"
                      value={selectedPayrollMonth}
                      onChange={(e) => setSelectedPayrollMonth(e.target.value)}
                      className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-semibold"
                    />
                  </div>
                </div>

                {/* KPI Mese */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                      Dipendenti & Co.Co.Co.
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      {payrollForMonth.length}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">cedolini registrati nel mese</div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                      Totale Netti da Bonificare
                    </div>
                    <div className="text-2xl font-bold text-emerald-600">
                      € {formatEuro(payrollForMonth.reduce((s, r) => s + r.netPaid, 0))}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">uscita di cassa stipendi</div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                      Ritenute & INPS Dipendenti
                    </div>
                    <div className="text-2xl font-bold text-sky-600">
                      € {formatEuro(payrollForMonth.reduce((s, r) => s + r.employeeTaxWithheld + r.employeeContributions, 0))}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">confluisce in delega F24</div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                      Costo Totale Azienda
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      € {formatEuro(payrollForMonth.reduce((s, r) => s + r.totalCompanyCost, 0))}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">comprensivo oneri ditta e TFR</div>
                  </div>
                </div>

                {/* Box Allineamento con la Banca */}
                {payrollAlignment.candidateTransactions.length > 0 && (
                  <div className="bg-sky-50/60 rounded-2xl p-5 border border-sky-200 shadow-sm space-y-3">
                    <div className="flex items-center gap-2 text-sky-900 font-bold text-sm">
                      <Sparkles className="w-4 h-4 text-sky-600" />
                      Allineamento Automatico Uscite Banca per Stipendi ed F24
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {payrollAlignment.suggestedMatches.map((match, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-xl border border-sky-100 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-bold text-slate-800">{match.description}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {match.transaction.date} - Causale: "{match.transaction.description}"
                            </div>
                            <div className="text-xs font-semibold text-rose-600 mt-1">
                              Importo addebito: € {formatEuro(Math.abs(match.transaction.amount))}
                            </div>
                          </div>

                          <button
                            onClick={() => handleReconcilePayrollBatch(match.transaction)}
                            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold whitespace-nowrap shadow-sm"
                          >
                            Riconcilia Uscita
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tabella Cedolini Dipendenti */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Dipendente</th>
                          <th className="py-3 px-4">Contratto</th>
                          <th className="py-3 px-4 text-right">Lordo</th>
                          <th className="py-3 px-4 text-right">INPS Dip.</th>
                          <th className="py-3 px-4 text-right">IRPEF</th>
                          <th className="py-3 px-4 text-right">Netto in Busta</th>
                          <th className="py-3 px-4 text-right">Costo Azienda</th>
                          <th className="py-3 px-4 text-center">Quadratura</th>
                          <th className="py-3 px-4 text-center">Stato Banca</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {payrollForMonth.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-12 text-center text-slate-400">
                              Nessun cedolino registrato per il mese {selectedPayrollMonth}.
                              <br />
                              <button
                                onClick={() => setActiveTab('upload')}
                                className="mt-2 text-sky-600 hover:underline text-xs font-semibold"
                              >
                                Carica il PDF dei cedolini nella scheda Caricamento
                              </button>
                            </td>
                          </tr>
                        ) : (
                          payrollForMonth.map(p => {
                            const val = validatePayrollCalculations(p);
                            const isPaid = p.status === 'paid' || Boolean(p.bankTransactionId);

                            return (
                              <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-3.5 px-4 font-semibold text-slate-800">
                                  {p.employeeName}
                                </td>
                                <td className="py-3.5 px-4 text-xs text-slate-500">
                                  {p.contractType === 'cococo' ? 'Co.Co.Co.' : 'Subordinato'}
                                </td>
                                <td className="py-3.5 px-4 text-right font-medium text-slate-800">
                                  € {formatEuro(p.grossSalary)}
                                </td>
                                <td className="py-3.5 px-4 text-right text-xs text-slate-600">
                                  € {formatEuro(p.employeeContributions)}
                                </td>
                                <td className="py-3.5 px-4 text-right text-xs text-slate-600">
                                  € {formatEuro(p.employeeTaxWithheld)}
                                </td>
                                <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                                  € {formatEuro(p.netPaid)}
                                </td>
                                <td className="py-3.5 px-4 text-right font-medium text-slate-800">
                                  € {formatEuro(p.totalCompanyCost)}
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  {val.isValid ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      OK
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200" title={val.errors.join('; ')}>
                                      <AlertCircle className="w-3 h-3 text-rose-600" />
                                      Diff. € {val.netDifference}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  {isPaid ? (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Bonificato
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                      Da Liquidare
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* MODALE ABBINAMENTO MANUALE ASSISTITO */}
            {manualMatchModalTx && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Abbinamento Manuale Movimento Bancario
                      </h3>
                      <p className="text-xs text-slate-500">
                        Seleziona una fattura aperta per abbinarla al movimento dell'estratto conto.
                      </p>
                    </div>
                    <button
                      onClick={() => setManualMatchModalTx(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Dettagli Transazione */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-800">{manualMatchModalTx.date} - {manualMatchModalTx.description}</div>
                      {manualMatchModalTx.counterpart && (
                        <div className="text-sky-600 font-semibold">{manualMatchModalTx.counterpart}</div>
                      )}
                    </div>
                    <div className={`text-base font-bold ${manualMatchModalTx.amount > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {manualMatchModalTx.amount > 0 ? '+' : ''}{formatEuro(manualMatchModalTx.amount)} €
                    </div>
                  </div>

                  {/* Opzione Bonifico Parlante se credito */}
                  {manualMatchModalTx.amount > 0 && (
                    <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-200 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-purple-900">Bonifico Parlante (Ecobonus / Ristrutturazione)</div>
                        <div className="text-purple-700">Riconosci la ritenuta dell'11% applicata dalla banca alla fonte</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={manualIsWithholding}
                        onChange={(e) => setManualIsWithholding(e.target.checked)}
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                      />
                    </div>
                  )}

                  {/* Ricerca Fattura */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Cerca per numero fattura, cliente o fornitore..."
                      value={manualSearchInvoice}
                      onChange={(e) => setManualSearchInvoice(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  {/* Lista Fatture Selezionabili */}
                  <div className="overflow-y-auto flex-1 space-y-2 max-h-[300px]">
                    {invoices
                      .filter(i => {
                        if (!i.isActive || i.status === 'paid') return false;
                        // Solo coerenti con la direzione (credito -> attive, debito -> passive)
                        if (manualMatchModalTx.amount > 0 && i.type !== 'active') return false;
                        if (manualMatchModalTx.amount < 0 && i.type !== 'passive') return false;

                        if (manualSearchInvoice.trim()) {
                          const q = manualSearchInvoice.toLowerCase();
                          return i.number.toLowerCase().includes(q) || i.counterpartName.toLowerCase().includes(q);
                        }
                        return true;
                      })
                      .map(inv => {
                        const isSelected = selectedInvoiceIds.includes(inv.id);
                        return (
                          <div
                            key={inv.id}
                            onClick={() => setSelectedInvoiceIds([inv.id])}
                            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between text-xs ${
                              isSelected
                                ? 'bg-sky-50 border-sky-500 shadow-sm'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div>
                              <div className="font-bold text-slate-900">
                                Ft. N. {inv.number} - {inv.counterpartName}
                              </div>
                              <div className="text-slate-500">
                                Del {inv.issueDate} - Scadenza {inv.dueDate}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-slate-900">€ {formatEuro(inv.outstandingAmount)}</div>
                              <div className="text-[10px] text-slate-400">Tot: € {formatEuro(inv.totalAmount)}</div>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Pulsanti Azione Modale */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                    <button
                      onClick={() => setManualMatchModalTx(null)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all"
                    >
                      Annulla
                    </button>
                    <button
                      disabled={selectedInvoiceIds.length === 0}
                      onClick={handleConfirmManualMatch}
                      className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-semibold transition-all shadow-sm"
                    >
                      Conferma Abbinamento
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      }}
    </AppLayout>
  );
}
