'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { calculateCashFlowProjection, calculateCurrentLiquidity, calculateVatPosition } from '@/financial-engine/calculations';
import { CalendarClock, AlertTriangle, CheckCircle, Edit3, ArrowDownLeft, ArrowUpRight, DollarSign, History, Landmark } from 'lucide-react';
import { CashFlowForecastItem } from '@/financial-engine/types';
import { addAuditLog } from '@/lib/store';
import { formatEuro, formatPercent } from '@/lib/format';

export default function PrevisioneCassaPage() {
  const [selectedHorizon, setSelectedHorizon] = useState<30 | 60 | 90>(30);
  const [editingItem, setEditingItem] = useState<CashFlowForecastItem | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editProbability, setEditProbability] = useState('1.0');
  const [editNote, setEditNote] = useState('');

  return (
    <AppLayout>
      {({ state, updateState, currentRole }) => {
        const liquidity = calculateCurrentLiquidity(state.bankAccounts);

        // Calcolo posizione IVA dell'anno per schedulazione automatica F24
        const vatPos = calculateVatPosition({
          invoices: state.invoices,
          periodType: 'year',
          periodValue: '2026'
        });

        // Genera voci F24 per IVA, IRPEF dipendenti e contributi INPS con scadenza al 16 del mese
        // Nota: importo dinamico lato client per evitare crash SSR Next.js durante prerendering statico
        let f24Items: CashFlowForecastItem[] = [];
        if (typeof window !== 'undefined') {
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { generateF24CashForecastItems } = require('@/financial-engine/calculations');
            f24Items = generateF24CashForecastItems({
              payrollRecords: state.payrollRecords,
              vatPosition: vatPos,
              referenceYear: '2026'
            });
          } catch {
            f24Items = [];
          }
        }

        // Combina forecast items salvati con le scadenze tributarie F24 (evitando duplicati se già presenti)
        const combinedForecastItems = [
          ...state.forecastItems,
          ...f24Items.filter(f => !state.forecastItems.some(i => i.id === f.id))
        ];

        const projection = calculateCashFlowProjection({
          currentLiquidity: liquidity.totalBalance,
          todayDate: '2026-09-25',
          forecastItems: combinedForecastItems
        });


        const activeProjection = 
          selectedHorizon === 30 ? projection.projections.days30 :
          selectedHorizon === 60 ? projection.projections.days60 :
          projection.projections.days90;

        const handleSaveOverride = (e: React.FormEvent) => {
          e.preventDefault();
          if (!editingItem) return;
          if (currentRole !== 'amministrazione') {
            alert('Solo il ruolo Amministrazione può modificare le previsioni di tesoreria.');
            return;
          }

          const newAmt = parseFloat(editAmount) || 0;
          const newProb = parseFloat(editProbability) || 1.0;
          const weighted = Number((newAmt * newProb).toFixed(2));

          const updatedItems = state.forecastItems.map(item => {
            if (item.id === editingItem.id) {
              return {
                ...item,
                date: editDate,
                expectedAmount: newAmt,
                collectionProbability: newProb,
                weightedAmount: weighted,
                isManualOverride: true,
                originalDate: item.originalDate || item.date,
                originalAmount: item.originalAmount || item.expectedAmount,
                overrideNote: editNote
              };
            }
            return item;
          });

          let updatedState = {
            ...state,
            forecastItems: updatedItems
          };

          updatedState = addAuditLog(updatedState, {
            entityType: 'CASH_FORECAST_ITEM',
            entityId: editingItem.id,
            action: 'UPDATE',
            previousValue: editingItem,
            newValue: updatedItems.find(i => i.id === editingItem.id),
            details: `Rettifica manuale previsione per "${editingItem.description}": data=${editDate}, importo=${newAmt}, probabilità=${(newProb * 100)}%. Nota: ${editNote}`
          });

          updateState(updatedState);
          setEditingItem(null);
        };

        return (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                  <CalendarClock className="w-8 h-8 text-sky-600" />
                  Previsione di Cassa & Tesoreria Dinamica
                </h1>
                <p className="text-base text-slate-500 mt-1">
                  Proiezione analitica e verificabile a 30, 60 e 90 giorni con probabilità di incasso
                </p>
              </div>

              {/* Selettore Orizzonte Temporale */}
              <div className="flex items-center gap-2 bg-slate-200/80 p-1.5 rounded-2xl">
                <button
                  onClick={() => setSelectedHorizon(30)}
                  className={`px-5 py-2 rounded-xl text-base font-bold transition-all ${
                    selectedHorizon === 30 ? 'bg-sky-600 text-white shadow-md' : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  30 Giorni
                </button>
                <button
                  onClick={() => setSelectedHorizon(60)}
                  className={`px-5 py-2 rounded-xl text-base font-bold transition-all ${
                    selectedHorizon === 60 ? 'bg-sky-600 text-white shadow-md' : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  60 Giorni
                </button>
                <button
                  onClick={() => setSelectedHorizon(90)}
                  className={`px-5 py-2 rounded-xl text-base font-bold transition-all ${
                    selectedHorizon === 90 ? 'bg-sky-600 text-white shadow-md' : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  90 Giorni
                </button>
              </div>
            </div>

            {/* Alert Saldi Negativi Previsti */}
            {projection.hasNegativeBalance && (
              <div className="p-5 bg-rose-50 border-l-4 border-rose-500 rounded-2xl flex items-center gap-4 text-rose-900">
                <AlertTriangle className="w-7 h-7 text-rose-600 shrink-0" />
                <div>
                  <h3 className="text-lg font-bold">Rilevato Deficit di Cassa Previsto</h3>
                  <p className="text-base text-rose-800">
                    In uno degli orizzonti temporali il saldo scende sotto lo zero. Valutare l'attivazione del castelletto/fidi bancari o posticipare uscite non prioritarie.
                  </p>
                </div>
              </div>
            )}

            {/* Cards Riepilogo Orizzonte Selezionato */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-sm font-semibold uppercase text-slate-500">Saldo Odierno Disponibile</span>
                <div className="text-2xl font-black text-slate-900 mt-2">
                  € {formatEuro(liquidity.totalBalance)}
                </div>
                <div className="text-xs text-slate-400 mt-1">Base di partenza calcolo</div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-sm font-semibold uppercase text-emerald-600">Entrate Previste ({selectedHorizon}gg)</span>
                <div className="text-2xl font-black text-emerald-700 mt-2">
                  + € {formatEuro(activeProjection.inflows)}
                </div>
                <div className="text-xs text-slate-400 mt-1">Ponderate su probabilità</div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-sm font-semibold uppercase text-rose-600">Uscite Previste ({selectedHorizon}gg)</span>
                <div className="text-2xl font-black text-rose-700 mt-2">
                  - € {formatEuro(activeProjection.outflows)}
                </div>
                <div className="text-xs text-slate-400 mt-1">Fornitori, stipendi, F24, rate</div>
              </div>

              <div className={`p-6 rounded-2xl border shadow-sm ${activeProjection.isNegative ? 'bg-rose-50 border-rose-300' : 'bg-sky-50 border-sky-200'}`}>
                <span className="text-sm font-bold uppercase text-slate-700">Saldo Previsto a +{selectedHorizon} Giorni</span>
                <div className={`text-2xl font-black mt-2 ${activeProjection.isNegative ? 'text-rose-700' : 'text-sky-900'}`}>
                  € {formatEuro(activeProjection.projectedBalance)}
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  Flusso netto: {activeProjection.netFlow >= 0 ? '+' : ''}€ {formatEuro(activeProjection.netFlow)}
                </div>
              </div>
            </div>

            {/* Dettaglio Voci Analitiche che compongono la previsione */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Voci Analitiche di Tesoreria (Orizzonte {selectedHorizon} giorni)
                  </h2>
                  <p className="text-sm text-slate-500">Ogni previsione è ricostruibile dalle singole scadenze registrate</p>
                </div>
                <span className="text-sm font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                  {activeProjection.items.length} voci pianificate
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {activeProjection.items.map((item) => (
                  <div key={item.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        {item.direction === 'inflow' ? (
                          <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                            <ArrowDownLeft className="w-5 h-5" />
                          </span>
                        ) : (
                          <span className="p-1.5 bg-rose-100 text-rose-800 rounded-lg">
                            <ArrowUpRight className="w-5 h-5" />
                          </span>
                        )}
                        <span className="text-lg font-bold text-slate-900">{item.description}</span>
                        {item.isManualOverride && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            <Edit3 className="w-3 h-3" /> Rettificato Manualmente
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-500 flex items-center gap-4">
                        <span>Data Prevista: <strong>{item.date}</strong></span>
                        {item.counterpart && <span>Controparte: <strong>{item.counterpart}</strong></span>}
                        {item.overrideNote && <span className="text-amber-800 italic">Nota: "{item.overrideNote}"</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-sm text-slate-500">
                          Nominale: € {formatEuro(item.expectedAmount)} ({Math.round(item.collectionProbability * 100)}%)
                        </div>
                        <div className={`text-xl font-extrabold ${item.direction === 'inflow' ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {item.direction === 'inflow' ? '+' : '-'} € {formatEuro(item.weightedAmount)}
                        </div>
                      </div>

                      {currentRole === 'amministrazione' && (
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setEditDate(item.date);
                            setEditAmount(item.expectedAmount.toString());
                            setEditProbability(item.collectionProbability.toString());
                            setEditNote(item.overrideNote || '');
                          }}
                          className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-sky-600 hover:bg-sky-50 transition-all"
                          title="Rettifica manuale data o probabilità di incasso"
                        >
                          <Edit3 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Rettifica Voce Previsione */}
            {editingItem && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl p-7 max-w-lg w-full shadow-2xl space-y-5">
                  <h3 className="text-xl font-bold text-slate-900">
                    Rettifica Previsione: {editingItem.description}
                  </h3>
                  <form onSubmit={handleSaveOverride} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Data Prevista Effettiva</label>
                      <input
                        type="date"
                        required
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Importo Previsto (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Probabilità Incasso</label>
                        <select
                          value={editProbability}
                          onChange={(e) => setEditProbability(e.target.value)}
                          className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base font-medium"
                        >
                          <option value="1.0">100% (Certo / Contrattuale)</option>
                          <option value="0.9">90% (Molto Probabile)</option>
                          <option value="0.75">75% (Probabile)</option>
                          <option value="0.5">50% (Incerto / In Contenzioso)</option>
                          <option value="0.0">0% (Insoluto o Sospeso)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Motivazione Rettifica (Audit Trail)</label>
                      <input
                        type="text"
                        required
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        placeholder="es. Accordo telefonico con cliente: saldo posticipato di 10gg"
                        className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-3">
                      <button
                        type="button"
                        onClick={() => setEditingItem(null)}
                        className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl"
                      >
                        Annulla
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl shadow-sm"
                      >
                        Salva Rettifica
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
