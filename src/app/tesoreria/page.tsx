'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';
import { calculateCurrentLiquidity } from '@/financial-engine/calculations';
import { 
  Landmark, 
  Plus, 
  PowerOff, 
  CheckCircle, 
  History, 
  UploadCloud, 
  FileText, 
  ArrowUpRight, 
  ArrowDownRight, 
  AlertCircle, 
  Search, 
  Check, 
  RefreshCw, 
  Download,
  AlertTriangle
} from 'lucide-react';
import { BankAccount, BankTransaction } from '@/financial-engine/types';
import { addAuditLog } from '@/lib/store';
import { parseBankStatementFile, parseUniversalBankStatementFile, StatementParseResult } from '@/lib/bank-statement-parser';
import { formatEuro, formatPercent } from '@/lib/format';

export default function TesoreriaPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [bankName, setBankName] = useState('');
  const [iban, setIban] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [creditLimit, setCreditLimit] = useState('');

  // Stato per Modal Importazione Estratto Conto
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [fileContentStr, setFileContentStr] = useState<string>('');
  const [parseResult, setParseResult] = useState<StatementParseResult | null>(null);
  const [syncAccountBalance, setSyncAccountBalance] = useState(true);
  const [customClosingBalance, setCustomClosingBalance] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  // Filtri registro transazioni
  const [txSearchQuery, setTxSearchQuery] = useState('');
  const [txSelectedAccount, setTxSelectedAccount] = useState('all');

  // Gestione caricamento file (PDF o CSV)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, accounts: BankAccount[], existingTxs: BankTransaction[]) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    const targetId = selectedBankAccountId || accounts.find(a => a.isActive)?.id || accounts[0]?.id;
    if (!selectedBankAccountId && targetId) {
      setSelectedBankAccountId(targetId);
    }

    const targetAccount = accounts.find(a => a.id === targetId);
    try {
      const res = await parseUniversalBankStatementFile({
        file,
        bankAccountId: targetId || '',
        currentBankBalance: targetAccount?.currentBalance || 0,
        existingTransactions: existingTxs.filter(t => t.bankAccountId === targetId)
      });

      setParseResult(res);
      const defaultBal = res.detectedClosingBalance !== undefined 
        ? res.detectedClosingBalance 
        : res.calculatedClosingBalance !== undefined 
          ? res.calculatedClosingBalance 
          : (targetAccount?.currentBalance || 0);
      setCustomClosingBalance(defaultBal.toFixed(2));
    } catch (err: any) {
      alert(`Errore lettura file estratto conto: ${err.message}`);
    }
  };

  const handleBankChange = (newBankId: string, accounts: BankAccount[], existingTxs: BankTransaction[]) => {
    setSelectedBankAccountId(newBankId);
    if (fileContentStr && importFile) {
      const targetAccount = accounts.find(a => a.id === newBankId);
      const res = parseBankStatementFile({
        fileContent: fileContentStr,
        fileName: importFile.name,
        bankAccountId: newBankId,
        currentBankBalance: targetAccount?.currentBalance || 0,
        existingTransactions: existingTxs.filter(t => t.bankAccountId === newBankId)
      });
      setParseResult(res);
      const defaultBal = res.detectedClosingBalance !== undefined 
        ? res.detectedClosingBalance 
        : res.calculatedClosingBalance !== undefined 
          ? res.calculatedClosingBalance 
          : (targetAccount?.currentBalance || 0);
      setCustomClosingBalance(defaultBal.toFixed(2));
    }
  };

  const handleDownloadSampleCsv = () => {
    const csvContent = 
`Data Contabile;Data Valuta;Causale Operazione;Importo;Saldo
28/09/2026;28/09/2026;BONIFICO SEPA DISPOSTO DA CONDOMINIO BELVEDERE SALDO FT 103;18300,00;45620,50
26/09/2026;26/09/2026;DELEGA F24 TELEMATICO RITENUTE ACQUISTI; -2150,00;27320,50
25/09/2026;25/09/2026;BONIFICO A FAVORE DI VAILLANT GROUP ITALIA SALDO FORNITURA; -14200,00;29470,50
22/09/2026;22/09/2026;ACCREDITO POS CANTIERE PRIVATO ROSSI; 2500,00;43670,50
`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'estratto_conto_esempio.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppLayout>
      {({ state, updateState, currentRole }) => {
        const liquidity = calculateCurrentLiquidity(state.bankAccounts);
        const transactions = state.bankTransactions || [];

        const handleToggleAccountStatus = (account: BankAccount) => {
          if (currentRole !== 'amministrazione') {
            alert('Solo il ruolo Amministrazione può modificare lo stato dei conti.');
            return;
          }

          const actionDesc = account.isActive 
            ? `Chiusura del conto ${account.bankName}: non concorrerà ai saldi correnti ma lo storico movimenti sarà conservato.`
            : `Riapertura del conto ${account.bankName}`;

          if (!confirm(`${actionDesc}\n\nConfermi l'operazione?`)) return;

          const updatedAccounts = state.bankAccounts.map(b => {
            if (b.id === account.id) {
              return { ...b, isActive: !b.isActive };
            }
            return b;
          });

          let updatedState = {
            ...state,
            bankAccounts: updatedAccounts
          };

          updatedState = addAuditLog(updatedState, {
            entityType: 'BANK_ACCOUNT',
            entityId: account.id,
            action: 'UPDATE',
            previousValue: { isActive: account.isActive },
            newValue: { isActive: !account.isActive },
            details: actionDesc
          });

          updateState(updatedState);
        };

        const handleCreateAccount = (e: React.FormEvent) => {
          e.preventDefault();
          if (currentRole !== 'amministrazione') {
            alert('Solo il ruolo Amministrazione può creare nuovi conti bancari.');
            return;
          }

          const newAcc: BankAccount = {
            id: `bank-${Date.now()}`,
            bankName,
            accountNumber: 'N/A',
            iban,
            initialBalance: parseFloat(initialBalance) || 0,
            initialBalanceDate: new Date().toISOString().split('T')[0],
            currentBalance: parseFloat(initialBalance) || 0,
            lastUpdated: new Date().toISOString().split('T')[0],
            creditLimit: parseFloat(creditLimit) || 0,
            isActive: true
          };

          let updatedState = {
            ...state,
            bankAccounts: [...state.bankAccounts, newAcc]
          };

          updatedState = addAuditLog(updatedState, {
            entityType: 'BANK_ACCOUNT',
            entityId: newAcc.id,
            action: 'CREATE',
            newValue: newAcc,
            details: `Apertura e censimento nuovo conto bancario: ${newAcc.bankName}`
          });

          updateState(updatedState);
          setShowAddModal(false);
          setBankName('');
          setIban('');
          setInitialBalance('');
          setCreditLimit('');
        };

        const handleConfirmImport = () => {
          if (!parseResult || !selectedBankAccountId) return;
          setIsProcessing(true);

          const targetBank = state.bankAccounts.find(b => b.id === selectedBankAccountId);
          if (!targetBank) return;

          // Filtra solo le transazioni nuove (esclude i duplicati rilevati tramite hash)
          const newTransactionsToAdd: BankTransaction[] = parseResult.transactions
            .filter(t => !t.isDuplicate)
            .map(t => ({
              id: t.id,
              bankAccountId: selectedBankAccountId,
              date: t.date,
              valueDate: t.valueDate,
              amount: t.amount,
              description: t.description,
              counterpart: t.counterpart,
              reconciled: false,
              importedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
              hash: t.hash
            }));

          const updatedTransactions = [...newTransactionsToAdd, ...transactions];

          // Calcola il nuovo saldo se richiesto dall'utente
          let updatedAccounts = [...state.bankAccounts];
          let balanceLogDetails = '';

          if (syncAccountBalance) {
            const newBal = parseFloat(customClosingBalance);
            const validNewBalance = isNaN(newBal) 
              ? (parseResult.calculatedClosingBalance || targetBank.currentBalance) 
              : newBal;

            updatedAccounts = state.bankAccounts.map(b => {
              if (b.id === selectedBankAccountId) {
                return {
                  ...b,
                  currentBalance: validNewBalance,
                  lastUpdated: new Date().toISOString().split('T')[0]
                };
              }
              return b;
            });

            balanceLogDetails = ` Saldo conto aggiornato da € ${targetBank.currentBalance.toFixed(2)} a € ${validNewBalance.toFixed(2)}.`;
          }

          let updatedState = {
            ...state,
            bankAccounts: updatedAccounts,
            bankTransactions: updatedTransactions
          };

          updatedState = addAuditLog(updatedState, {
            entityType: 'BANK_ACCOUNT',
            entityId: selectedBankAccountId,
            action: 'RECONCILE',
            newValue: {
              importedCount: newTransactionsToAdd.length,
              duplicatesSkipped: parseResult.duplicatesCount,
              netMovement: parseResult.netMovement,
              newBalance: syncAccountBalance ? parseFloat(customClosingBalance) : targetBank.currentBalance
            },
            details: `Importato estratto conto "${parseResult.fileName}" su ${targetBank.bankName}: registrate ${newTransactionsToAdd.length} nuove transazioni (${parseResult.duplicatesCount} duplicate ignorate).${balanceLogDetails}`
          });

          updateState(updatedState);
          setIsProcessing(false);
          setShowImportModal(false);
          setImportFile(null);
          setFileContentStr('');
          setParseResult(null);

          setImportSuccessMsg(
            `Estratto conto importato con successo! Registrati ${newTransactionsToAdd.length} nuovi movimenti (${parseResult.duplicatesCount} duplicati scartati). Liquidità e previsione cassa allineate.`
          );
          setTimeout(() => setImportSuccessMsg(null), 8000);
        };

        // Filtra transazioni mostrate nel registro
        const filteredTransactions = transactions.filter(t => {
          const matchAccount = txSelectedAccount === 'all' || t.bankAccountId === txSelectedAccount;
          const matchSearch = txSearchQuery === '' || 
            t.description.toLowerCase().includes(txSearchQuery.toLowerCase()) ||
            (t.counterpart && t.counterpart.toLowerCase().includes(txSearchQuery.toLowerCase()));
          return matchAccount && matchSearch;
        });

        return (
          <div className="space-y-8">
            {/* Banner Messaggio Successo */}
            {importSuccessMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center justify-between shadow-sm animate-fade-in">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <span className="font-semibold text-sm">{importSuccessMsg}</span>
                </div>
                <button 
                  onClick={() => setImportSuccessMsg(null)}
                  className="text-emerald-600 hover:text-emerald-800 text-sm font-bold ml-4"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Testata Pagina & Pulsanti Azione */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                  <Landmark className="w-8 h-8 text-sky-600" />
                  Tesoreria, Banche & Liquidità
                </h1>
                <p className="text-base text-slate-500 mt-1">
                  Monitoraggio dei conti correnti aziendali, caricamento estratti conto e allineamento disponibilità
                </p>
              </div>

              {currentRole === 'amministrazione' && (
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => {
                      setSelectedBankAccountId(state.bankAccounts.find(b => b.isActive)?.id || '');
                      setParseResult(null);
                      setImportFile(null);
                      setShowImportModal(true);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-sm transition-all"
                  >
                    <UploadCloud className="w-5 h-5" />
                    Carica Estratto Conto (CSV)
                  </button>

                  <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl shadow-sm transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    Aggiungi Conto
                  </button>
                </div>
              )}
            </div>

            {/* Liquidità Totale Attiva Card */}
            <div className="bg-slate-900 text-white p-7 rounded-2xl shadow-md grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <span className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Liquidità Totale Effettiva
                </span>
                <div className="text-3xl font-black mt-2 text-white">
                  € {formatEuro(liquidity.totalBalance)}
                </div>
                <p className="text-sm text-slate-400 mt-1">
                  Somma dei soli conti correnti attivi ({liquidity.activeAccountsCount} conti)
                </p>
              </div>

              <div>
                <span className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Affidamenti & Castelletto
                </span>
                <div className="text-3xl font-black mt-2 text-sky-400">
                  € {liquidity.totalCreditLimit}
                </div>
                <p className="text-sm text-slate-400 mt-1">
                  Linee di credito e anticipo fatture accordate dagli istituti
                </p>
              </div>

              <div>
                <span className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Disponibilità Finanziaria Complessiva
                </span>
                <div className="text-3xl font-black mt-2 text-emerald-400">
                  € {liquidity.totalAvailableLiquidity}
                </div>
                <p className="text-sm text-slate-400 mt-1">
                  Ultimo allineamento saldi: {liquidity.latestUpdateDate}
                </p>
              </div>
            </div>

            {/* Lista Conti Bancari */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Elenco Rapporti Bancari</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Seleziona un conto per caricare l'estratto conto ed allineare il saldo reale
                  </p>
                </div>
                <span className="text-sm text-slate-500 font-medium">
                  {state.bankAccounts.length} rapporti censiti
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {state.bankAccounts.map((acc) => {
                  const accountTxs = transactions.filter(t => t.bankAccountId === acc.id);
                  return (
                    <div key={acc.id} className={`p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${!acc.isActive ? 'bg-slate-50/70 opacity-75' : ''}`}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-slate-900">{acc.bankName}</span>
                          {acc.isActive ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              <CheckCircle className="w-3.5 h-3.5" /> Attivo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                              <History className="w-3.5 h-3.5" /> Chiuso (Storico Conservato)
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-mono text-slate-500">{acc.iban}</p>
                        <div className="flex items-center gap-3 pt-0.5">
                          {acc.notes && <p className="text-xs text-slate-400 italic">{acc.notes}</p>}
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-xs text-slate-500 font-medium">
                            {accountTxs.length} movimenti registrati
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 self-end lg:self-center">
                        <div className="text-right">
                          <div className="text-xs text-slate-400 font-medium">Saldo al {acc.lastUpdated}</div>
                          <div className="text-2xl font-black text-slate-900">
                            € {formatEuro(acc.currentBalance)}
                          </div>
                          {acc.creditLimit > 0 && (
                            <div className="text-xs text-sky-600 font-medium">
                              Fido: € {acc.creditLimit}
                            </div>
                          )}
                        </div>

                        {currentRole === 'amministrazione' && acc.isActive && (
                          <button
                            onClick={() => {
                              setSelectedBankAccountId(acc.id);
                              setParseResult(null);
                              setImportFile(null);
                              setShowImportModal(true);
                            }}
                            title={`Carica estratto conto per ${acc.bankName}`}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-xl transition-all shadow-sm"
                          >
                            <UploadCloud className="w-4 h-4" />
                            Carica Estratto
                          </button>
                        )}

                        {currentRole === 'amministrazione' && (
                          <button
                            onClick={() => handleToggleAccountStatus(acc)}
                            title={acc.isActive ? "Chiudi conto (conservando storico)" : "Riattiva conto"}
                            className={`p-2.5 rounded-xl border transition-all ${
                              acc.isActive 
                                ? 'text-rose-600 hover:bg-rose-50 border-rose-200' 
                                : 'text-sky-600 hover:bg-sky-50 border-sky-200'
                            }`}
                          >
                            <PowerOff className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sezione Registro Transazioni & Movimenti Bancari */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
              <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-sky-600" />
                    Registro Movimenti Bancari & Estratti Conto
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Storico transazioni consolidate, con chiave di deduplicazione e causale bancaria
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* Filtro Conto */}
                  <select
                    value={txSelectedAccount}
                    onChange={(e) => setTxSelectedAccount(e.target.value)}
                    className="border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 bg-white focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="all">Tutti i conti ({transactions.length})</option>
                    {state.bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>{b.bankName}</option>
                    ))}
                  </select>

                  {/* Ricerca per causale o controparte */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Cerca causale / controparte..."
                      value={txSearchQuery}
                      onChange={(e) => setTxSearchQuery(e.target.value)}
                      className="border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-700 w-56 focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
              </div>

              {filteredTransactions.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="font-semibold text-base text-slate-600">Nessun movimento trovato</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Carica un file estratto conto CSV dal pulsante in alto per popolare il registro.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-y border-slate-200">
                        <th className="py-3 px-4">Data Contabile</th>
                        <th className="py-3 px-4">Conto</th>
                        <th className="py-3 px-4">Causale / Dettaglio</th>
                        <th className="py-3 px-4">Controparte</th>
                        <th className="py-3 px-4 text-right">Importo</th>
                        <th className="py-3 px-4 text-center">Stato Riconciliazione</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {filteredTransactions.map((tx) => {
                        const bank = state.bankAccounts.find(b => b.id === tx.bankAccountId);
                        const isCredit = tx.amount > 0;
                        return (
                          <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4 font-mono font-medium whitespace-nowrap">
                              {tx.date}
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">
                              {bank?.bankName.split(' ')[0] || 'Banca'}
                            </td>
                            <td className="py-3 px-4 max-w-md font-medium text-slate-900 truncate" title={tx.description}>
                              {tx.description}
                            </td>
                            <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                              {tx.counterpart || '-'}
                            </td>
                            <td className="py-3 px-4 text-right font-bold whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${
                                isCredit 
                                  ? 'text-emerald-700 bg-emerald-50' 
                                  : 'text-rose-700 bg-rose-50'
                              }`}>
                                {isCredit ? <ArrowDownRight className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                                € {formatEuro(Math.abs(tx.amount))}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              {tx.reconciled ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                  <Check className="w-3 h-3" /> Riconciliato ({tx.reconciledType})
                                </span>
                              ) : (
                                <Link
                                  href="/allineamento"
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-800 transition-colors"
                                  title="Vai alla schermata di allineamento per abbinare a una fattura"
                                >
                                  Da riconciliare →
                                </Link>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Importazione Estratto Conto (CSV / TSV) */}
            {showImportModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
                <div className="bg-white rounded-2xl p-6 md:p-8 max-w-4xl w-full shadow-2xl space-y-6 my-8 max-h-[90vh] flex flex-col">
                  {/* Header Modal */}
                  <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <UploadCloud className="w-6 h-6 text-emerald-600" />
                        Carica Estratto Conto Bancario
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Supporta file CSV esportati da tutti gli istituti italiani con separatore virgola o punto e virgola.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowImportModal(false)}
                      className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Selezione Conto e File */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Conto Bancario di Destinazione
                      </label>
                      <select
                        value={selectedBankAccountId}
                        onChange={(e) => handleBankChange(e.target.value, state.bankAccounts, transactions)}
                        className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 bg-white"
                      >
                        {state.bankAccounts.filter(b => b.isActive).map(b => (
                          <option key={b.id} value={b.id}>
                            {b.bankName} (Saldo attuale: € {formatEuro(b.currentBalance)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                          File Estratto Conto (CSV / TSV)
                        </label>
                        <button
                          type="button"
                          onClick={handleDownloadSampleCsv}
                          className="text-xs text-sky-600 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <Download className="w-3 h-3" /> Esempio CSV
                        </button>
                      </div>
                      <input
                        type="file"
                        accept=".pdf,.csv,.tsv,.txt"
                        onChange={(e) => handleFileChange(e, state.bankAccounts, transactions)}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                      />
                    </div>
                  </div>

                  {/* Sezione Anteprima & Risultati del Parsing */}
                  {parseResult && (
                    <div className="flex-1 overflow-y-auto space-y-5">
                      {parseResult.error ? (
                        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-semibold flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                          {parseResult.error}
                        </div>
                      ) : (
                        <>
                          {/* Statistiche di sintesi */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div>
                              <span className="text-[11px] font-semibold uppercase text-slate-500">Movimenti Totali</span>
                              <div className="text-xl font-bold text-slate-900 mt-0.5">{parseResult.transactions.length}</div>
                            </div>
                            <div>
                              <span className="text-[11px] font-semibold uppercase text-emerald-600">Nuovi da Registrare</span>
                              <div className="text-xl font-bold text-emerald-600 mt-0.5">+{parseResult.newTransactionsCount}</div>
                            </div>
                            <div>
                              <span className="text-[11px] font-semibold uppercase text-amber-600">Duplicati Scartati</span>
                              <div className="text-xl font-bold text-amber-600 mt-0.5">{parseResult.duplicatesCount}</div>
                            </div>
                            <div>
                              <span className="text-[11px] font-semibold uppercase text-slate-500">Flusso Netto File</span>
                              <div className={`text-xl font-bold mt-0.5 ${parseResult.netMovement >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                € {parseResult.netMovement}
                              </div>
                            </div>
                          </div>

                          {/* Sezione Allineamento Saldo */}
                          <div className="bg-emerald-50/60 border border-emerald-200 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1">
                              <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-emerald-950">
                                <input
                                  type="checkbox"
                                  checked={syncAccountBalance}
                                  onChange={(e) => setSyncAccountBalance(e.target.checked)}
                                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                                />
                                Aggiorna saldo disponibile e ricalcola previsione cassa
                              </label>
                              <p className="text-xs text-emerald-800">
                                {parseResult.detectedClosingBalance !== undefined
                                  ? `Rilevato saldo finale estratto conto: € ${parseResult.detectedClosingBalance.toFixed(2)}`
                                  : `Saldo calcolato sommando i movimenti al saldo attuale: € ${parseResult.calculatedClosingBalance?.toFixed(2)}`}
                              </p>
                            </div>

                            {syncAccountBalance && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-emerald-900 whitespace-nowrap">Nuovo Saldo (€):</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={customClosingBalance}
                                  onChange={(e) => setCustomClosingBalance(e.target.value)}
                                  className="border border-emerald-300 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-900 bg-white w-32 focus:ring-2 focus:ring-emerald-500"
                                />
                              </div>
                            )}
                          </div>

                          {/* Tabella di Anteprima Transazioni */}
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                                Anteprima Movimenti Rilevati ({parseResult.transactions.length})
                              </span>
                              <span className="text-xs text-slate-400">
                                Gli elementi contrassegnati come duplicati non saranno reinseriti
                              </span>
                            </div>
                            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 font-semibold text-slate-600">
                                  <tr>
                                    <th className="py-2 px-3">Data</th>
                                    <th className="py-2 px-3">Causale</th>
                                    <th className="py-2 px-3">Controparte</th>
                                    <th className="py-2 px-3 text-right">Importo</th>
                                    <th className="py-2 px-3 text-center">Stato</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                  {parseResult.transactions.map((tx, idx) => (
                                    <tr key={idx} className={tx.isDuplicate ? 'bg-slate-50/75 opacity-60' : 'hover:bg-slate-50'}>
                                      <td className="py-2 px-3 font-mono whitespace-nowrap">{tx.date}</td>
                                      <td className="py-2 px-3 max-w-xs truncate" title={tx.description}>{tx.description}</td>
                                      <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{tx.counterpart || '-'}</td>
                                      <td className="py-2 px-3 text-right font-bold whitespace-nowrap">
                                        <span className={tx.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                          {tx.amount > 0 ? '+' : ''}€ {tx.amount.toFixed(2)}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 text-center whitespace-nowrap">
                                        {tx.isDuplicate ? (
                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                                            Già presente (ignorato)
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                            Nuovo
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Footer Modal Azioni */}
                  <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowImportModal(false)}
                      className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl text-sm"
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      disabled={!parseResult || parseResult.newTransactionsCount === 0 || isProcessing}
                      onClick={handleConfirmImport}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-sm text-sm transition-all"
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Salvataggio...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Conferma & Allinea Cassa ({parseResult?.newTransactionsCount || 0} nuovi)
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Creazione Conto */}
            {showAddModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl p-7 max-w-lg w-full shadow-2xl space-y-5">
                  <h3 className="text-xl font-bold text-slate-900">Censisci Nuovo Rapporto Bancario</h3>
                  <form onSubmit={handleCreateAccount} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Nome Istituto & Descrizione</label>
                      <input
                        type="text"
                        required
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="es. BPER Banca (Conto Anticipi Cantieri)"
                        className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-base focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Codice IBAN</label>
                      <input
                        type="text"
                        required
                        value={iban}
                        onChange={(e) => setIban(e.target.value)}
                        placeholder="IT..."
                        className="w-full font-mono border border-slate-300 rounded-xl px-4 py-2.5 text-base focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Saldo Iniziale (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={initialBalance}
                          onChange={(e) => setInitialBalance(e.target.value)}
                          placeholder="0.00"
                          className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-base focus:ring-2 focus:ring-sky-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Fido Accordato (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={creditLimit}
                          onChange={(e) => setCreditLimit(e.target.value)}
                          placeholder="0.00"
                          className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-base focus:ring-2 focus:ring-sky-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-3">
                      <button
                        type="button"
                        onClick={() => setShowAddModal(false)}
                        className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl"
                      >
                        Annulla
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl shadow-sm"
                      >
                        Salva Rapporto
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        );
      }}
    </AppLayout>
  );
}
