'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { calculateManagementIncomeStatement } from '@/financial-engine/calculations';
import { Scale, AlertCircle, CheckCircle2, TrendingUp, HelpCircle } from 'lucide-react';
import { formatEuro, formatPercent } from '@/lib/format';

export default function BilancioGestionalePage() {
  const currentYearStr = new Date().getFullYear().toString();
  const [viewMode, setViewMode] = useState<'year' | 'quarter' | 'month'>('year');
  const [selectedYear, setSelectedYear] = useState(currentYearStr);
  const [selectedQuarter, setSelectedQuarter] = useState('Q3');
  const [selectedMonth, setSelectedMonth] = useState(`${currentYearStr}-09`);
  // Stato modale rettifiche OIC 12/13/23 — DEVE essere al top-level del componente (Rules of Hooks)
  const [showAdjustmentsModal, setShowAdjustmentsModal] = useState(false);
  const [inventoryOpening, setInventoryOpening] = useState('0');
  const [inventoryClosing, setInventoryClosing] = useState('0');
  const [wipOpening, setWipOpening] = useState('0');
  const [wipClosing, setWipClosing] = useState('0');
  const [depTangible, setDepTangible] = useState('0');
  const [depIntangible, setDepIntangible] = useState('0');
  const [badDebt, setBadDebt] = useState('0');

  return (
    <AppLayout>
      {({ state }) => {
        // Calcolo dinamico degli anni e mesi disponibili
        const detectedMonths = new Set<string>();
        const detectedYears = new Set<string>();
        detectedYears.add(currentYearStr);

        for (let m = 1; m <= 12; m++) {
          detectedMonths.add(`${currentYearStr}-${String(m).padStart(2, '0')}`);
        }
        state.invoices.forEach(inv => {
          const compMonth = inv.economicCompetenceMonth || (inv.issueDate ? inv.issueDate.substring(0, 7) : null);
          if (compMonth) {
            detectedMonths.add(compMonth);
            detectedYears.add(compMonth.substring(0, 4));
          }
        });
        state.payrollRecords.forEach(p => {
          if (p.month) {
            detectedMonths.add(p.month);
            detectedYears.add(p.month.substring(0, 4));
          }
        });

        const sortedMonths = Array.from(detectedMonths).sort().reverse();
        const sortedYears = Array.from(detectedYears).sort().reverse();

        const activeYear = sortedYears.includes(selectedYear) ? selectedYear : sortedYears[0];
        const activeMonth = sortedMonths.includes(selectedMonth) ? selectedMonth : sortedMonths[0];

        let periodValue = activeYear;
        let periodLabel = `Anno ${activeYear}`;

        if (viewMode === 'year') {
          periodValue = activeYear;
          periodLabel = `Anno ${activeYear}`;
        } else if (viewMode === 'quarter') {
          periodValue = `${activeYear}-${selectedQuarter}`;
          const qNames: Record<string, string> = {
            Q1: '1° Trimestre (Gen-Mar)',
            Q2: '2° Trimestre (Apr-Giu)',
            Q3: '3° Trimestre (Lug-Set)',
            Q4: '4° Trimestre (Ott-Dic)'
          };
          periodLabel = `${qNames[selectedQuarter] || selectedQuarter} ${activeYear}`;
        } else {
          periodValue = activeMonth;
          periodLabel = `Mese ${activeMonth}`;
        }

        const statement = calculateManagementIncomeStatement({
          periodType: viewMode,
          periodValue: periodValue,
          invoices: state.invoices,
          payrollRecords: state.payrollRecords,
          contracts: state.contracts,
          adjustments: {
            inventoryOpening: parseFloat(inventoryOpening) || 0,
            inventoryClosing: parseFloat(inventoryClosing) || 0,
            workInProgressOpening: parseFloat(wipOpening) || 0,
            workInProgressClosing: parseFloat(wipClosing) || 0,
            depreciationTangible: parseFloat(depTangible) || 0,
            depreciationIntangible: parseFloat(depIntangible) || 0,
            badDebtProvision: parseFloat(badDebt) || 0
          }
        });

        return (
          <div className="space-y-8">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                  <Scale className="w-8 h-8 text-sky-600" />
                  Bilancio Gestionale & Conto Economico OIC
                </h1>
                <p className="text-base text-slate-500 mt-1">
                  Riclassificazione a valore aggiunto, EBITDA ed EBIT a norma OIC 12 per Elacus SRL • <span className="font-semibold text-slate-800">{periodLabel}</span>
                </p>
              </div>

              {/* Selettori Periodo & Rettifiche */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdjustmentsModal(true)}
                  className="px-3.5 py-1.5 rounded-xl border border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 text-sm font-semibold transition-all"
                >
                  ⚙️ Rettifiche & Rimanenze
                </button>

                {/* Segmented Control Tipo Periodo */}
                <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setViewMode('year')}
                    className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                      viewMode === 'year'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Anno Intero
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('quarter')}
                    className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                      viewMode === 'quarter'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Trimestre
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('month')}
                    className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                      viewMode === 'month'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Mese
                  </button>
                </div>

                {/* Dropdown Anno */}
                {viewMode !== 'month' && (
                  <select
                    value={activeYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="bg-white border border-slate-300 rounded-xl px-3.5 py-1.5 text-sm font-medium shadow-sm focus:ring-2 focus:ring-sky-500"
                  >
                    {sortedYears.map(yr => (
                      <option key={yr} value={yr}>
                        Anno {yr} {yr === currentYearStr ? '(Corrente)' : ''}
                      </option>
                    ))}
                  </select>
                )}

                {/* Dropdown Trimestre */}
                {viewMode === 'quarter' && (
                  <select
                    value={selectedQuarter}
                    onChange={(e) => setSelectedQuarter(e.target.value)}
                    className="bg-white border border-slate-300 rounded-xl px-3.5 py-1.5 text-sm font-medium shadow-sm focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="Q1">Q1 (Gennaio - Marzo)</option>
                    <option value="Q2">Q2 (Aprile - Giugno)</option>
                    <option value="Q3">Q3 (Luglio - Settembre)</option>
                    <option value="Q4">Q4 (Ottobre - Dicembre)</option>
                  </select>
                )}

                {/* Dropdown Mese */}
                {viewMode === 'month' && (
                  <select
                    value={activeMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-white border border-slate-300 rounded-xl px-3.5 py-1.5 text-sm font-medium shadow-sm focus:ring-2 focus:ring-sky-500"
                  >
                    {sortedMonths.map(m => (
                      <option key={m} value={m}>
                        Mese {m} {m === `${currentYearStr}-09` ? '(Corrente)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Note di conformità normativa */}
            <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl text-sky-900 text-sm leading-relaxed flex items-center justify-between">
              <div>
                <strong>Inquadramento OIC / Codice Civile:</strong> Prospetto conforme alla struttura a valore aggiunto e margine operativo lordo (OIC 12). Include la variazione dei lavori in corso su ordinazione (SAL cantieri art. 2425 A.3 C.C.), la variazione delle rimanenze di magazzino (B.11 C.C.), gli ammortamenti di beni strumentali (B.10.a/b C.C.) e l'EBIT.
              </div>
            </div>

            {/* Prospetto Conto Economico Riclassificato */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold">Conto Economico a Valore Aggiunto & Risultato Operativo</h2>
                  <p className="text-sm text-slate-400">Periodo di competenza: {periodLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                  {statement.isPersonnelCostComplete ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/40">
                      <CheckCircle2 className="w-4 h-4" /> Dati Completi
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/40">
                      <AlertCircle className="w-4 h-4" /> Dati Parziali / Incompleti
                    </span>
                  )}
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {/* 1. Valore della produzione / Ricavi */}
                <div className="p-6 flex justify-between items-center bg-slate-50/50">
                  <div>
                    <span className="text-base font-bold text-slate-900">A) VALORE DELLA PRODUZIONE (Ricavi + SAL Cantieri)</span>
                    <p className="text-sm text-slate-500">
                      Fatturato attivo (€ {formatEuro(statement.revenues)}) 
                      {statement.workInProgressVariation !== 0 && ` + Variazione SAL Cantieri (€ ${formatEuro(statement.workInProgressVariation)})`}
                    </p>
                  </div>
                  <span className="text-xl font-extrabold text-emerald-700">
                    + € {formatEuro(statement.totalProductionValue)}
                  </span>
                </div>

                {/* 2. Consumi di materie prime e servizi */}
                <div className="p-6 flex justify-between items-center">
                  <div className="pl-4">
                    <span className="text-base font-medium text-slate-800">1. Consumi di Materie Prime & Materiale Idraulico</span>
                    <p className="text-sm text-slate-500">
                      Acquisti fatture passive (€ {formatEuro(statement.materialPurchases)})
                      {statement.inventoryVariation !== 0 && ` con rettifica variazione rimanenze (€ ${formatEuro(statement.inventoryVariation)})`}
                    </p>
                  </div>
                  <span className="text-lg font-semibold text-rose-600">
                    - € {formatEuro(statement.adjustedMaterialCosts)}
                  </span>
                </div>

                {/* Margine di Contribuzione Industriale / Margine Primo */}
                <div className="p-6 flex justify-between items-center bg-sky-50/40">
                  <div>
                    <span className="text-base font-bold text-sky-950">MARGINE INDUSTRIALE PRIMO (Valore Aggiunto Industriale)</span>
                    <p className="text-sm text-slate-600">Capacità della gestione operativa di coprire i costi fissi e di struttura</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-extrabold text-sky-900">
                      € {formatEuro(statement.grossMargin)}
                    </span>
                    <span className="block text-xs font-semibold text-sky-700">
                      {formatPercent(statement.grossMarginPercent)}% sulla produzione
                    </span>
                  </div>
                </div>

                {/* 3. Costo del Personale Complessivo */}
                <div className="p-6 flex justify-between items-center">
                  <div className="pl-4">
                    <span className="text-base font-medium text-slate-800">2. Costo del Personale Dipendente & Co.Co.Co. (Voce B.9 C.C.)</span>
                    <p className="text-sm text-slate-500">
                      Retribuzioni lorde + Oneri c/azienda INPS/INAIL + Quota TFR maturata
                    </p>
                    {!statement.isPersonnelCostComplete && (
                      <span className="inline-block mt-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-semibold">
                        Attenzione: Oneri riflessi di 1 operatore in stima provvisoria
                      </span>
                    )}
                  </div>
                  <span className="text-lg font-semibold text-rose-600">
                    - € {formatEuro(statement.personnelCost)}
                  </span>
                </div>

                {/* 4. Canoni Noleggio Operativo & Leasing Patrimoniale */}
                <div className="p-6 flex justify-between items-center">
                  <div className="pl-4">
                    <span className="text-base font-medium text-slate-800">3. Godimento Beni di Terzi (Canoni Noleggio & Leasing OIC - Voce B.8 C.C.)</span>
                    <p className="text-sm text-slate-500">Canoni per furgoni, autocarri strumentali e attrezzature da cantiere</p>
                  </div>
                  <span className="text-lg font-semibold text-rose-600">
                    - € {formatEuro(statement.rentalCosts)}
                  </span>
                </div>

                {/* MARGINE OPERATIVO LORDO (EBITDA) */}
                <div className="p-6 flex justify-between items-center bg-indigo-50/50 border-t-2 border-indigo-200">
                  <div>
                    <span className="text-lg font-extrabold text-indigo-950">EBITDA / MARGINE OPERATIVO LORDO (MOL)</span>
                    <p className="text-sm text-slate-600">Redditività della gestione caratteristica prima di ammortamenti e oneri finanziari</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-2xl font-black ${statement.ebitda >= 0 ? 'text-indigo-900' : 'text-rose-600'}`}>
                      € {formatEuro(statement.ebitda)}
                    </span>
                    <span className="block text-xs font-semibold text-indigo-700">
                      {formatPercent(statement.ebitdaPercent)}% sulla produzione
                    </span>
                  </div>
                </div>

                {/* Ammortamenti e Svalutazione Crediti */}
                <div className="p-6 flex justify-between items-center">
                  <div className="pl-4">
                    <span className="text-base font-medium text-slate-800">4. Ammortamenti Cespiti & Svalutazione Crediti (Voci B.10.a/b/d C.C.)</span>
                    <p className="text-sm text-slate-500">
                      Ammortamenti beni materiali/immateriali ed eventuale fondo rischi su crediti clienti
                    </p>
                  </div>
                  <span className="text-lg font-semibold text-rose-600">
                    - € {formatEuro(statement.depreciationTotal + statement.badDebtProvision)}
                  </span>
                </div>

                {/* RISULTATO OPERATIVO NETTO (EBIT) */}
                <div className="p-6 flex justify-between items-center bg-sky-50/60 border-t border-sky-200">
                  <div>
                    <span className="text-lg font-extrabold text-sky-950">EBIT / RISULTATO OPERATIVO NETTO</span>
                    <p className="text-sm text-slate-600">Margine al netto del deperimento economico dei beni aziendali</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-2xl font-black ${statement.ebit >= 0 ? 'text-sky-900' : 'text-rose-600'}`}>
                      € {formatEuro(statement.ebit)}
                    </span>
                    <span className="block text-xs font-semibold text-sky-700">
                      {formatPercent(statement.ebitPercent)}% sulla produzione
                    </span>
                  </div>
                </div>

                {/* 5. Oneri Finanziari */}
                <div className="p-6 flex justify-between items-center">
                  <div className="pl-4">
                    <span className="text-base font-medium text-slate-800">5. Interessi Passivi & Oneri Finanziari (Mutui / Finanziamenti - Voce C.17 C.C.)</span>
                    <p className="text-sm text-slate-500">
                      Quota interessi rate (esclusa quota capitale che estingue debito patrimoniale)
                    </p>
                  </div>
                  <span className="text-lg font-semibold text-rose-600">
                    - € {formatEuro(statement.financialCosts)}
                  </span>
                </div>

                {/* RISULTATO PRIMA DELLE IMPOSTE (EBT) */}
                <div className="p-6 flex justify-between items-center bg-slate-100">
                  <div>
                    <span className="text-lg font-black text-slate-900">RISULTATO D'ESERCIZIO ANTE IMPOSTE (EBT)</span>
                    <p className="text-sm text-slate-600">Utile / Perdita civilistica prima delle imposte correnti IRES/IRAP</p>
                  </div>
                  <span className={`text-2xl font-black ${statement.ebt >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    € {formatEuro(statement.ebt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Rettifiche Rimanenze e Ammortamenti */}
            {showAdjustmentsModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl p-7 max-w-xl w-full shadow-2xl space-y-5">
                  <h3 className="text-xl font-bold text-slate-900">
                    Rettifiche di Competenza (OIC 12 / OIC 13 / OIC 23)
                  </h3>
                  <p className="text-sm text-slate-500">
                    Inserisci le valorizzazioni di magazzino, SAL cantieri e ammortamenti per il periodo selezionato ({periodLabel}):
                  </p>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Rimanenze Iniziali Magazzino (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={inventoryOpening}
                        onChange={(e) => setInventoryOpening(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-base"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Rimanenze Finali Magazzino (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={inventoryClosing}
                        onChange={(e) => setInventoryClosing(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-base"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">SAL Cantieri Iniziali (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={wipOpening}
                        onChange={(e) => setWipOpening(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-base"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">SAL Cantieri Finali non fatturati (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={wipClosing}
                        onChange={(e) => setWipClosing(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-base"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Ammortamenti Materiali Periodo (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={depTangible}
                        onChange={(e) => setDepTangible(e.target.value)}
                        placeholder="es. furgoni, macchinari"
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-base"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Svalutazione Crediti Periodo (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={badDebt}
                        onChange={(e) => setBadDebt(e.target.value)}
                        placeholder="Accantonamento fondo rischi"
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-base"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowAdjustmentsModal(false)}
                      className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl shadow-sm"
                    >
                      Applica Rettifiche al Bilancio
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

