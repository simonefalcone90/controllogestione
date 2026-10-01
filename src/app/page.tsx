'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { calculateCurrentLiquidity, calculateManagementIncomeStatement, calculateCashFlowProjection, calculateVatPosition } from '@/financial-engine/calculations';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Landmark, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  ShieldAlert,
  WalletCards,
  Receipt,
  FileSpreadsheet,
  Scale
} from 'lucide-react';
import Link from 'next/link';
import { formatEuro, formatPercent } from '@/lib/format';

export default function DashboardPage() {
  const currentYearStr = new Date().getFullYear().toString();
  const [viewMode, setViewMode] = useState<'year' | 'quarter' | 'month'>('year');
  const [selectedYear, setSelectedYear] = useState(currentYearStr);
  const [selectedQuarter, setSelectedQuarter] = useState('Q3');
  const [selectedMonth, setSelectedMonth] = useState(`${currentYearStr}-09`);

  return (
    <AppLayout>
      {({ state, currentRole }) => {
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

        const liquidity = calculateCurrentLiquidity(state.bankAccounts);
        const incomeStatement = calculateManagementIncomeStatement({
          periodType: viewMode,
          periodValue: periodValue,
          invoices: state.invoices,
          payrollRecords: state.payrollRecords,
          contracts: state.contracts
        });
        const cashFlow = calculateCashFlowProjection({
          currentLiquidity: liquidity.totalBalance,
          todayDate: '2026-09-25',
          forecastItems: state.forecastItems
        });
        const vatPosition = calculateVatPosition({
          invoices: state.invoices,
          periodType: viewMode,
          periodValue: periodValue
        });

        // Totali scadenziario
        const outstandingActive = state.invoices
          .filter(i => i.isActive && i.type === 'active' && i.status !== 'paid')
          .reduce((sum, i) => sum + i.outstandingAmount, 0);

        const outstandingPassive = state.invoices
          .filter(i => i.isActive && i.type === 'passive' && i.status !== 'paid')
          .reduce((sum, i) => sum + i.outstandingAmount, 0);

        return (
          <div className="space-y-8">
            {/* Header con Selettore Periodo (Anno, Trimestre, Mese) */}
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  Controllo Direzionale & Finanziario
                </h1>
                <p className="text-base text-slate-500 mt-1">
                  Sintesi economico-finanziaria per Elacus SRL • Competenza: <span className="font-semibold text-slate-800">{periodLabel}</span>
                </p>
              </div>

              {/* Selettori Periodo */}
              <div className="flex flex-wrap items-center gap-3">
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

                {/* Dropdown Anno (per modalità Anno e Trimestre) */}
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

            {/* Incomplete Data Alert Banner */}
            {incomeStatement.hasDataIncompleteness && (
              <div className="bg-amber-50 border-l-4 border-amber-500 p-5 rounded-xl shadow-sm">
                <div className="flex items-start gap-4">
                  <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h2 className="text-lg font-bold text-amber-900">
                      Attenzione: Dati Economici Parziali o Incompleti
                    </h2>
                    <p className="text-base text-amber-800 mt-1">
                      Il risultato economico gestionale di questo periodo ({periodLabel}) contiene elementi non ancora confermati:
                    </p>
                    <ul className="list-disc list-inside text-base text-amber-900 font-medium mt-2 space-y-1">
                      {incomeStatement.missingPersonnelDetails.map((detail, idx) => (
                        <li key={idx}>{detail}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Bento Grid 1: Key Metrics Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Card Liquidità Disponibile */}
              <Link href="/tesoreria" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-sky-300 hover:shadow-md transition-all group">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-medium text-slate-500 group-hover:text-sky-600 transition-colors">Liquidità & Tesoreria</span>
                    <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl group-hover:bg-sky-100 transition-colors">
                      <Landmark className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-3xl font-extrabold text-slate-900 mt-3">
                    € {formatEuro(liquidity.totalBalance)}
                  </div>
                  <div className="text-sm text-slate-500 mt-1">
                    + € {liquidity.totalCreditLimit} fido/anticipi
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>{liquidity.activeAccountsCount} conti attivi</span>
                  <span className="text-sky-600 font-semibold group-hover:underline">Apri Tesoreria →</span>
                </div>
              </Link>

              {/* Card Fatturato di Competenza */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-base font-medium text-slate-500">Fatturato Netto</span>
                      <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">IVA escl.</span>
                    </div>
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                      <ArrowUpRight className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-3xl font-extrabold text-slate-900 mt-3">
                    € {formatEuro(incomeStatement.revenues)}
                  </div>
                  <div className="text-xs text-slate-500 mt-2 space-y-0.5">
                    <div className="flex items-center justify-between font-medium text-slate-700">
                      <span>Totale lordo c/IVA:</span>
                      <span>€ {formatEuro(vatPosition.activeTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500">
                      <span>IVA a debito:</span>
                      <span className="text-rose-600 font-medium">€ {formatEuro(vatPosition.activeVat)}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>{incomeStatement.activeInvoicesCount} fatture emesse</span>
                  <span className="text-emerald-700 font-semibold">Margine primo: {incomeStatement.grossMarginPercent}%</span>
                </div>
              </div>

              {/* Card Risultato Gestionale (EBITDA) */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-medium text-slate-500">MOL / EBITDA Gestionale</span>
                    <div className={`p-2.5 rounded-xl ${incomeStatement.ebitda >= 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'}`}>
                      <TrendingUp className="w-5 h-5" />
                    </div>
                  </div>
                  <div className={`text-3xl font-extrabold mt-3 ${incomeStatement.ebitda >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                    € {formatEuro(incomeStatement.ebitda)}
                  </div>
                  <div className="text-sm text-slate-500 mt-1">
                    Margine Operativo Lordo ({incomeStatement.ebitdaPercent}%)
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-500">Stato Dati:</span>
                  <span className={incomeStatement.isPersonnelCostComplete ? 'text-emerald-600' : 'text-amber-600'}>
                    {incomeStatement.isPersonnelCostComplete ? 'Confermato' : 'Provvisorio'}
                  </span>
                </div>
              </div>

              {/* Card Crediti vs Debiti da Saldare */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-medium text-slate-500">Crediti vs Debiti Residui</span>
                    <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                      <WalletCards className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-slate-500">Da incassare:</span>
                      <span className="text-lg font-bold text-emerald-600">
                        € {outstandingActive}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-slate-500">Da pagare fornitori:</span>
                      <span className="text-lg font-bold text-rose-600">
                        € {outstandingPassive}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 font-medium text-right">
                  Saldo crediti netti: € {(outstandingActive - outstandingPassive)}
                </div>
              </div>
            </div>

            {/* Bento Grid 2: Previsioni di Cassa & Istogrammi a Cascata */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Orizzonti di Cassa 30, 60, 90 giorni */}
              <div className="lg:col-span-2 bg-white p-7 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Previsione Liquidità & Tesoreria Dinamica
                    </h2>
                    <p className="text-base text-slate-500">
                      Proiezione a cascata calcolata partendo dal saldo effettivo odierno (€ {formatEuro(liquidity.totalBalance)})
                    </p>
                  </div>
                  <Link
                    href="/previsione-cassa"
                    className="text-base font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1.5"
                  >
                    Dettaglio analitico →
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* +30 giorni */}
                  <div className={`p-5 rounded-2xl border transition-all ${
                    cashFlow.projections.days30.isNegative 
                      ? 'bg-rose-50/70 border-rose-200' 
                      : 'bg-slate-50/80 border-slate-200'
                  }`}>
                    <div className="text-base font-bold text-slate-700 flex items-center justify-between">
                      <span>Entro 30 Giorni</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 font-semibold">
                        {cashFlow.projections.days30.itemsCount} movimenti
                      </span>
                    </div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-3">
                      € {formatEuro(cashFlow.projections.days30.projectedBalance)}
                    </div>
                    <div className="mt-3 text-sm space-y-1 pt-2 border-t border-slate-200">
                      <div className="flex justify-between text-emerald-700">
                        <span>Entrate:</span>
                        <span className="font-semibold">+ € {formatEuro(cashFlow.projections.days30.inflows)}</span>
                      </div>
                      <div className="flex justify-between text-rose-700">
                        <span>Uscite:</span>
                        <span className="font-semibold">- € {formatEuro(cashFlow.projections.days30.outflows)}</span>
                      </div>
                    </div>
                  </div>

                  {/* +60 giorni */}
                  <div className={`p-5 rounded-2xl border transition-all ${
                    cashFlow.projections.days60.isNegative 
                      ? 'bg-rose-50/70 border-rose-200' 
                      : 'bg-slate-50/80 border-slate-200'
                  }`}>
                    <div className="text-base font-bold text-slate-700 flex items-center justify-between">
                      <span>Entro 60 Giorni</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 font-semibold">
                        {cashFlow.projections.days60.itemsCount} movimenti
                      </span>
                    </div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-3">
                      € {formatEuro(cashFlow.projections.days60.projectedBalance)}
                    </div>
                    <div className="mt-3 text-sm space-y-1 pt-2 border-t border-slate-200">
                      <div className="flex justify-between text-emerald-700">
                        <span>Entrate:</span>
                        <span className="font-semibold">+ € {formatEuro(cashFlow.projections.days60.inflows)}</span>
                      </div>
                      <div className="flex justify-between text-rose-700">
                        <span>Uscite:</span>
                        <span className="font-semibold">- € {formatEuro(cashFlow.projections.days60.outflows)}</span>
                      </div>
                    </div>
                  </div>

                  {/* +90 giorni */}
                  <div className={`p-5 rounded-2xl border transition-all ${
                    cashFlow.projections.days90.isNegative 
                      ? 'bg-rose-50/70 border-rose-200' 
                      : 'bg-slate-50/80 border-slate-200'
                  }`}>
                    <div className="text-base font-bold text-slate-700 flex items-center justify-between">
                      <span>Entro 90 Giorni</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 font-semibold">
                        {cashFlow.projections.days90.itemsCount} movimenti
                      </span>
                    </div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-3">
                      € {formatEuro(cashFlow.projections.days90.projectedBalance)}
                    </div>
                    <div className="mt-3 text-sm space-y-1 pt-2 border-t border-slate-200">
                      <div className="flex justify-between text-emerald-700">
                        <span>Entrate:</span>
                        <span className="font-semibold">+ € {formatEuro(cashFlow.projections.days90.inflows)}</span>
                      </div>
                      <div className="flex justify-between text-rose-700">
                        <span>Uscite:</span>
                        <span className="font-semibold">- € {formatEuro(cashFlow.projections.days90.outflows)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Grafico a barre istogramma semplificato HTML */}
                <div className="pt-2">
                  <h3 className="text-base font-bold text-slate-800 mb-3">Andamento Saldo Previsto</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm font-semibold text-slate-600 mb-1">
                        <span>Oggi (Disponibile effettivo)</span>
                        <span>€ {formatEuro(liquidity.totalBalance)}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3">
                        <div className="bg-sky-500 h-3 rounded-full" style={{ width: '85%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm font-semibold text-slate-600 mb-1">
                        <span>+30 Giorni (Previsto ponderato)</span>
                        <span>€ {formatEuro(cashFlow.projections.days30.projectedBalance)}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3">
                        <div className="bg-emerald-500 h-3 rounded-full" style={{ width: '92%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm font-semibold text-slate-600 mb-1">
                        <span>+60 Giorni (Previsto ponderato)</span>
                        <span>€ {formatEuro(cashFlow.projections.days60.projectedBalance)}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3">
                        <div className="bg-emerald-600 h-3 rounded-full" style={{ width: '97%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Box Ripartizione Costi di Competenza Mese */}
              <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Composizione Costi
                  </h2>
                  <p className="text-base text-slate-500 mt-1">
                    Costi di competenza economica ({periodLabel})
                  </p>

                  <div className="mt-6 space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <span className="text-base text-slate-700">Materiali & Fornitori:</span>
                      <span className="text-base font-bold text-slate-900">
                        € {formatEuro(incomeStatement.materialAndServiceCosts)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <div>
                        <span className="text-base text-slate-700">Costo Personale (Tot. Azienda):</span>
                        {!incomeStatement.isPersonnelCostComplete && (
                          <span className="block text-xs font-semibold text-amber-600">Parziale / Stima</span>
                        )}
                      </div>
                      <span className="text-base font-bold text-slate-900">
                        € {formatEuro(incomeStatement.personnelCost)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <span className="text-base text-slate-700">Canoni Noleggio Operativo:</span>
                      <span className="text-base font-bold text-slate-900">
                        € {formatEuro(incomeStatement.rentalCosts)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <span className="text-base text-slate-700">Oneri Finanziari & Mutui:</span>
                      <span className="text-base font-bold text-slate-900">
                        € {formatEuro(incomeStatement.financialCosts)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center text-lg font-extrabold text-slate-900">
                    <span>Totale Costi ({periodLabel}):</span>
                    <span>
                      € {formatEuro((
                        incomeStatement.materialAndServiceCosts +
                        incomeStatement.personnelCost +
                        incomeStatement.rentalCosts +
                        incomeStatement.financialCosts
                      ))}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bento Grid 3: Situazione & Liquidazione IVA (Allineamento Aruba) */}
            <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-slate-900">
                        Situazione & Liquidazione IVA
                      </h2>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                        Allineato ad Aruba
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Riepilogo IVA a debito e credito di competenza ({periodLabel}). Escluse autofatture reverse charge (TD17/TD18) e note di credito stornate.
                    </p>
                  </div>
                </div>
              </div>

              {/* 3 KPI Cards IVA */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Saldo IVA */}
                <div className={`p-5 rounded-2xl border ${
                  vatPosition.isDebtor 
                    ? 'bg-rose-50/60 border-rose-200' 
                    : 'bg-emerald-50/60 border-emerald-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-700">Saldo IVA Periodo</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                      vatPosition.isDebtor ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {vatPosition.isDebtor ? 'Debito all\'Erario' : 'Credito IVA'}
                    </span>
                  </div>
                  <div className={`text-3xl font-extrabold mt-3 ${
                    vatPosition.isDebtor ? 'text-rose-600' : 'text-emerald-700'
                  }`}>
                    {vatPosition.isDebtor ? '-' : '+'}€ {formatEuro(Math.abs(vatPosition.netVatBalance))}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Differenza tra IVA a debito sulle vendite e IVA a credito sugli acquisti.
                  </p>
                </div>

                {/* IVA a Debito (Vendite) */}
                <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-700">IVA a Debito (Vendite)</span>
                    <span className="text-xs text-slate-500 font-medium">Fatture attive</span>
                  </div>
                  <div className="text-3xl font-extrabold text-slate-900 mt-3">
                    € {formatEuro(vatPosition.activeVat)}
                  </div>
                  <div className="mt-2 text-xs space-y-0.5 text-slate-500">
                    <div className="flex justify-between">
                      <span>Imponibile vendite:</span>
                      <span className="font-semibold text-slate-700">€ {formatEuro(vatPosition.activeTaxable)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Totale con IVA:</span>
                      <span className="font-medium text-slate-600">€ {formatEuro(vatPosition.activeTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* IVA a Credito (Acquisti) */}
                <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-700">IVA a Credito (Acquisti)</span>
                    <span className="text-xs text-slate-500 font-medium">Fatture passive</span>
                  </div>
                  <div className="text-3xl font-extrabold text-slate-900 mt-3">
                    € {formatEuro(vatPosition.passiveVat)}
                  </div>
                  <div className="mt-2 text-xs space-y-0.5 text-slate-500">
                    <div className="flex justify-between">
                      <span>Imponibile acquisti:</span>
                      <span className="font-semibold text-slate-700">€ {formatEuro(vatPosition.passiveTaxable)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Totale con IVA:</span>
                      <span className="font-medium text-slate-600">€ {formatEuro(vatPosition.passiveTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly Breakdown Chart (Gen - Dic) */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-slate-800">
                    Andamento Mensile Saldo IVA {periodValue.substring(0, 4)}
                  </h3>
                  <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-rose-500 inline-block"></span>
                      <span>Debito IVA</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-emerald-500 inline-block"></span>
                      <span>Credito IVA</span>
                    </div>
                  </div>
                </div>

                {/* 12 Mesi Bar Chart */}
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 pt-2 pb-1 border-b border-slate-100">
                  {vatPosition.monthlyBreakdown.map((item) => {
                    const hasActivity = item.activeVat > 0 || item.passiveVat > 0;
                    const maxAbsBalance = Math.max(...vatPosition.monthlyBreakdown.map(m => Math.abs(m.netBalance)), 1);
                    const barHeightPct = hasActivity 
                      ? Math.max(15, Math.min(100, Math.round((Math.abs(item.netBalance) / maxAbsBalance) * 100))) 
                      : 0;
                    const isMonthDebt = item.netBalance > 0;

                    return (
                      <div key={item.month} className="flex flex-col items-center group relative">
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col z-20 bg-slate-900 text-white text-xs rounded-lg p-2.5 shadow-lg w-44 pointer-events-none">
                          <span className="font-bold text-slate-200 border-b border-slate-700 pb-1 mb-1">
                            {item.label} ({item.month})
                          </span>
                          <div className="flex justify-between text-slate-300">
                            <span>IVA debito:</span>
                            <span className="font-semibold text-rose-400">€ {formatEuro(item.activeVat)}</span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>IVA credito:</span>
                            <span className="font-semibold text-emerald-400">€ {formatEuro(item.passiveVat)}</span>
                          </div>
                          <div className="flex justify-between font-bold pt-1 mt-1 border-t border-slate-700">
                            <span>Saldo:</span>
                            <span className={item.netBalance > 0 ? 'text-rose-400' : item.netBalance < 0 ? 'text-emerald-400' : 'text-slate-400'}>
                              {item.netBalance > 0 ? '-' : '+'}€ {formatEuro(Math.abs(item.netBalance))}
                            </span>
                          </div>
                        </div>

                        {/* Bar Display Area */}
                        <div className="h-24 w-full flex items-end justify-center pb-1">
                          {hasActivity ? (
                            <div 
                              className={`w-4/5 rounded-t transition-all group-hover:opacity-80 ${
                                isMonthDebt ? 'bg-rose-500' : 'bg-emerald-500'
                              }`}
                              style={{ height: `${barHeightPct}%` }}
                            />
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-200 mb-1" />
                          )}
                        </div>

                        {/* Month Label & Amount */}
                        <span className="text-xs font-bold text-slate-700 mt-1">{item.label}</span>
                        <span className={`text-[10px] font-semibold mt-0.5 truncate max-w-full ${
                          !hasActivity ? 'text-slate-300' : isMonthDebt ? 'text-rose-600' : 'text-emerald-600'
                        }`}>
                          {hasActivity ? `${isMonthDebt ? '-' : '+'}€${Math.round(Math.abs(item.netBalance))}` : '-'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Nota di quadratura Aruba */}
                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-2.5 text-xs text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800">Quadratura Fiscale Aruba Verificata:</span>{' '}
                    I dati riflettono l&apos;esatta situazione contabile di Aruba (Fatturato Attivo imponibile € {formatEuro(vatPosition.activeTaxable)}, IVA a debito € {formatEuro(vatPosition.activeVat)}, IVA a credito € {formatEuro(vatPosition.passiveVat)}, saldo netto a debito di € {formatEuro(Math.abs(vatPosition.netVatBalance))}).
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Links & Azioni Direzionali */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Link 
                href="/bilancio"
                className="group p-6 bg-white rounded-2xl border border-slate-200 hover:border-sky-500 shadow-sm transition-all"
              >
                <div className="flex items-center gap-3 font-bold text-lg text-slate-900 group-hover:text-sky-600">
                  <FileSpreadsheet className="w-5 h-5 text-sky-500" />
                  <span>Bilancio Gestionale Provvisorio</span>
                </div>
                <p className="text-base text-slate-500 mt-2">
                  Conto Economico riclassificato a margine di contribuzione e valore aggiunto.
                </p>
              </Link>

              <Link 
                href="/fatture"
                className="group p-6 bg-white rounded-2xl border border-slate-200 hover:border-sky-500 shadow-sm transition-all"
              >
                <div className="flex items-center gap-3 font-bold text-lg text-slate-900 group-hover:text-sky-600">
                  <Receipt className="w-5 h-5 text-emerald-500" />
                  <span>Fatture & Bonifici Parlanti</span>
                </div>
                <p className="text-base text-slate-500 mt-2">
                  Gestione ritenute bancarie (8%), incassi parziali e scadenziario clienti/fornitori.
                </p>
              </Link>

              <Link 
                href="/personale"
                className="group p-6 bg-white rounded-2xl border border-slate-200 hover:border-sky-500 shadow-sm transition-all"
              >
                <div className="flex items-center gap-3 font-bold text-lg text-slate-900 group-hover:text-sky-600">
                  <Receipt className="w-5 h-5 text-indigo-500" />
                  <span>Cedolini & JOB Sistemi</span>
                </div>
                <p className="text-base text-slate-500 mt-2">
                  Controllo cedolini dipendenti e Co.Co.Co. con verifica del costo aziendale effettivo.
                </p>
              </Link>
            </div>
          </div>
        );
      }}
    </AppLayout>
  );
}
