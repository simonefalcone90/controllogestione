'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { FileSpreadsheet, CheckCircle, PowerOff, Plus, AlertCircle, Info, Trash2 } from 'lucide-react';
import { calculateContractInstallmentImpact } from '@/financial-engine/calculations';
import { FinancialContract } from '@/financial-engine/types';
import { addAuditLog } from '@/lib/store';
import { deleteFinancialContractFromSupabase } from '@/lib/supabase-adapter';
import { formatEuro, formatPercent } from '@/lib/format';

export default function ContrattiPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [contractType, setContractType] = useState<'loan' | 'leasing' | 'operating_rental'>('loan');
  const [counterpart, setCounterpart] = useState('');
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [principalPortion, setPrincipalPortion] = useState('');
  const [interestPortion, setInterestPortion] = useState('');

  return (
    <AppLayout>
      {({ state, updateState, currentRole }) => {
        const activeContracts = state.contracts.filter(c => c.isActive);

        // Calcolo totali impatto rate
        let totalCashOutflow = 0;
        let totalIncomeCost = 0;
        let totalDebtReduction = 0;

        activeContracts.forEach(c => {
          const impact = calculateContractInstallmentImpact(c);
          totalCashOutflow += impact.cashOutflow;
          totalIncomeCost += impact.incomeStatementCost;
          totalDebtReduction += impact.debtReduction;
        });

        const handleToggleStatus = (contract: FinancialContract) => {
          if (currentRole !== 'amministrazione') {
            alert('Solo il ruolo Amministrazione può chiudere o riattivare contratti finanziari.');
            return;
          }

          const action = contract.isActive ? 'Estinzione anticipata / Chiusura' : 'Riattivazione';
          if (!confirm(`${action} del contratto: ${contract.title}?\nLo storico resterà conservato.`)) return;

          const updatedContracts = state.contracts.map(c => {
            if (c.id === contract.id) {
              return { ...c, isActive: !c.isActive };
            }
            return c;
          });

          let updatedState = {
            ...state,
            contracts: updatedContracts
          };

          updatedState = addAuditLog(updatedState, {
            entityType: 'FINANCIAL_CONTRACT',
            entityId: contract.id,
            action: 'UPDATE',
            previousValue: { isActive: contract.isActive },
            newValue: { isActive: !contract.isActive },
            details: `${action} del contratto finanziario: ${contract.title}`
          });

          updateState(updatedState);
        };

        const handleDeleteContract = async (contract: FinancialContract) => {
          if (currentRole !== 'amministrazione') {
            alert('Solo il ruolo Amministrazione può eliminare contratti finanziari.');
            return;
          }
          if (!confirm(`Sei sicuro di voler eliminare DEFINITIVAMENTE il contratto: "${contract.title}"?\nQuesta operazione non può essere annullata.`)) return;

          const updatedContracts = state.contracts.filter(c => c.id !== contract.id);
          let updatedState = {
            ...state,
            contracts: updatedContracts
          };

          updatedState = addAuditLog(updatedState, {
            entityType: 'FINANCIAL_CONTRACT',
            entityId: contract.id,
            action: 'DELETE',
            details: `Eliminazione contratto finanziario: ${contract.title}`
          });

          updateState(updatedState);
          await deleteFinancialContractFromSupabase(contract.id);
        };

        const handleCreateContract = (e: React.FormEvent) => {
          e.preventDefault();
          if (currentRole !== 'amministrazione') {
            alert('Solo il ruolo Amministrazione può inserire contratti finanziari.');
            return;
          }

          const installment = parseFloat(installmentAmount) || 0;
          const principal = parseFloat(principalPortion) || 0;
          const interest = parseFloat(interestPortion) || 0;

          const newCnt: FinancialContract = {
            id: `cnt-${Date.now()}`,
            title,
            type: contractType,
            counterpart,
            startDate: new Date().toISOString().split('T')[0],
            endDate: '2028-12-31',
            totalFinanced: installment * 36,
            installmentAmount: installment,
            frequency: 'monthly',
            installmentsCount: 36,
            paidInstallmentsCount: 0,
            principalPortion: contractType === 'operating_rental' ? 0 : principal,
            interestPortion: contractType === 'operating_rental' ? installment : interest,
            bankAccountId: state.bankAccounts[0]?.id || 'bank-1',
            isActive: true,
            nextDueDate: '2026-10-15'
          };

          let updatedState = {
            ...state,
            contracts: [...state.contracts, newCnt]
          };

          updatedState = addAuditLog(updatedState, {
            entityType: 'FINANCIAL_CONTRACT',
            entityId: newCnt.id,
            action: 'CREATE',
            newValue: newCnt,
            details: `Inserimento nuovo contratto: ${newCnt.title} (${newCnt.type})`
          });

          updateState(updatedState);
          setShowAddModal(false);
          setTitle('');
          setCounterpart('');
          setInstallmentAmount('');
        };

        return (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                  <FileSpreadsheet className="w-8 h-8 text-sky-600" />
                  Contratti Finanziari, Mutui & Noleggi Operativi
                </h1>
                <p className="text-base text-slate-500 mt-1">
                  Separazione rigorosa tra uscita di cassa complessiva e quota di costo economico
                </p>
              </div>

              {currentRole === 'amministrazione' && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl shadow-sm transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Aggiungi Contratto
                </button>
              )}
            </div>

            {/* Banner Contabile Didattico */}
            <div className="p-5 bg-sky-50 border border-sky-200 rounded-2xl flex items-start gap-4">
              <Info className="w-6 h-6 text-sky-600 shrink-0 mt-0.5" />
              <div className="text-sm text-sky-900 leading-relaxed">
                <strong>Regola di Controllo Finanziario:</strong> Nei finanziamenti e mutui, il pagamento della rata (€ {formatEuro(totalCashOutflow)}) impatta interamente sul conto corrente. Tuttavia, <strong>la sola Quota Interessi (€ {formatEuro(totalIncomeCost)})</strong> concorre al conto economico di periodo, mentre la Quota Capitale estingue debiti verso banche nello Stato Patrimoniale.
              </div>
            </div>

            {/* Riepilogo Mensile Rate */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-sm font-semibold uppercase text-slate-500">Uscita di Cassa Mensile (Tesoreria)</span>
                <div className="text-3xl font-black text-rose-700 mt-2">
                  - € {formatEuro(totalCashOutflow)}
                </div>
                <div className="text-xs text-slate-400 mt-1">Uscite totali per addebiti rate/rid</div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-sm font-semibold uppercase text-slate-500">Costo a Conto Economico (Oneri + Canoni)</span>
                <div className="text-3xl font-black text-slate-900 mt-2">
                  € {formatEuro(totalIncomeCost)}
                </div>
                <div className="text-xs text-slate-400 mt-1">Interessi mutui + Canone puro noleggio</div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-sm font-semibold uppercase text-slate-500">Estinzione Debito Patrimoniale</span>
                <div className="text-3xl font-black text-indigo-700 mt-2">
                  € {formatEuro(totalDebtReduction)}
                </div>
                <div className="text-xs text-slate-400 mt-1">Quota capitale rimborsata mensilmente</div>
              </div>
            </div>

            {/* Elenco Contratti */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-900">Contratti Finanziari in Essere</h2>
                <span className="text-sm font-medium text-slate-500">{state.contracts.length} contratti registrati</span>
              </div>

              <div className="divide-y divide-slate-100">
                {state.contracts.map((contract) => {
                  const impact = calculateContractInstallmentImpact(contract);
                  return (
                    <div key={contract.id} className={`p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 ${!contract.isActive ? 'bg-slate-50/70 opacity-75' : ''}`}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-slate-900">{contract.title}</span>
                          <span className="text-xs uppercase font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {contract.type === 'loan' ? 'Mutuo/Finanziamento' : contract.type === 'operating_rental' ? 'Noleggio Operativo' : 'Leasing Strumentale'}
                          </span>
                          {contract.isActive ? (
                            <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                              In Corso
                            </span>
                          ) : (
                            <span className="text-xs font-semibold px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full">
                              Chiuso / Estinto
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-500">
                          Ente: <strong>{contract.counterpart}</strong> • Scadenza: {contract.endDate} • Prossima rata: {contract.nextDueDate}
                        </div>
                      </div>

                      <div className="flex items-center gap-8">
                        <div className="text-right">
                          <div className="text-sm text-slate-500">Rata Mensile: <strong className="text-slate-900">€ {formatEuro(contract.installmentAmount)}</strong></div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Cassa: <span className="font-semibold text-rose-600">-€ {formatEuro(impact.cashOutflow)}</span> | Costo CE: <span className="font-semibold text-slate-700">€ {formatEuro(impact.incomeStatementCost)}</span>
                          </div>
                          {impact.debtReduction > 0 && (
                            <div className="text-xs text-indigo-600">Quota Capitale: € {formatEuro(impact.debtReduction)}</div>
                          )}
                        </div>

                        {currentRole === 'amministrazione' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleStatus(contract)}
                              title={contract.isActive ? "Estinzione / Chiusura anticipata" : "Riattiva contratto"}
                              className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-amber-600 hover:bg-amber-50 transition-all"
                            >
                              <PowerOff className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteContract(contract)}
                              title="Elimina definitivamente contratto"
                              className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Aggiungi Contratto */}
            {showAddModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl p-7 max-w-lg w-full shadow-2xl space-y-5">
                  <h3 className="text-xl font-bold text-slate-900">Nuovo Contratto Finanziario</h3>
                  <form onSubmit={handleCreateContract} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Descrizione Contratto</label>
                      <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="es. Noleggio Furgone Iveco Daily"
                        className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Tipologia</label>
                        <select
                          value={contractType}
                          onChange={(e) => setContractType(e.target.value as any)}
                          className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base font-medium"
                        >
                          <option value="loan">Mutuo / Finanziamento Chirografario</option>
                          <option value="operating_rental">Noleggio Operativo</option>
                          <option value="leasing">Leasing Strumentale</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Controparte (Banca / Società)</label>
                        <input
                          type="text"
                          required
                          value={counterpart}
                          onChange={(e) => setCounterpart(e.target.value)}
                          placeholder="es. Intesa Sanpaolo"
                          className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Importo Rata Mensile (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={installmentAmount}
                        onChange={(e) => setInstallmentAmount(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base"
                      />
                    </div>

                    {contractType !== 'operating_rental' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Quota Capitale (€)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={principalPortion}
                            onChange={(e) => setPrincipalPortion(e.target.value)}
                            placeholder="es. 850.00"
                            className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Quota Interessi (€)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={interestPortion}
                            onChange={(e) => setInterestPortion(e.target.value)}
                            placeholder="es. 120.00"
                            className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base"
                          />
                        </div>
                      </div>
                    )}

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
                        Salva Contratto
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
