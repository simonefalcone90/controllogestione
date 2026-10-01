'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';
import { 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  Calendar, 
  TrendingUp, 
  BarChart3, 
  RotateCcw,
  Sparkles,
  ArrowUpRight,
  UploadCloud
} from 'lucide-react';
import { PayrollRecord } from '@/financial-engine/types';
import { addAuditLog } from '@/lib/store';
import { formatEuro, formatPercent } from '@/lib/format';

const ITALIAN_MONTHS: Record<string, string> = {
  '01': 'Gennaio',
  '02': 'Febbraio',
  '03': 'Marzo',
  '04': 'Aprile',
  '05': 'Maggio',
  '06': 'Giugno',
  '07': 'Luglio',
  '08': 'Agosto',
  '09': 'Settembre',
  '10': 'Ottobre',
  '11': 'Novembre',
  '12': 'Dicembre'
};

const SHORT_MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

function formatMonthLabel(ym: string) {
  const [year, month] = ym.split('-');
  return `${ITALIAN_MONTHS[month] || month} ${year}`;
}

export default function PersonalePage() {
  const [viewMode, setViewMode] = useState<'month' | 'year'>('year');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedMonth, setSelectedMonth] = useState('2026-08');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  // Modale conferma
  const [showConfirmModal, setShowConfirmModal] = useState<PayrollRecord | null>(null);
  const [employerContrib, setEmployerContrib] = useState('');
  const [tfrAccrual, setTfrAccrual] = useState('');
  const [cassaEdile, setCassaEdile] = useState('');

  return (
    <AppLayout>
      {({ state, updateState, currentRole }) => {
        // Rileva tutti gli anni disponibili dai cedolini
        const detectedYears = new Set<string>();
        detectedYears.add('2026');
        state.payrollRecords.forEach(p => {
          if (p.month) detectedYears.add(p.month.substring(0, 4));
        });
        const sortedYears = Array.from(detectedYears).sort().reverse();
        const activeYear = sortedYears.includes(selectedYear) ? selectedYear : sortedYears[0];

        // Mesi disponibili per l'anno selezionato con dati presenti
        const monthsWithData = new Set<string>();
        state.payrollRecords.forEach(p => {
          if (p.month && p.month.startsWith(activeYear)) {
            monthsWithData.add(p.month);
          }
        });
        const sortedMonthsWithData = Array.from(monthsWithData).sort().reverse();

        // Se il mese selezionato non appartiene all'anno o non ha dati, imposta l'ultimo disponibile
        const activeMonth = sortedMonthsWithData.includes(selectedMonth)
          ? selectedMonth
          : sortedMonthsWithData[0] || `${activeYear}-08`;

        // Calcolo aggregato dei 12 mesi dell'anno per l'istogramma
        const monthlyStats = Array.from({ length: 12 }, (_, i) => {
          const mNum = String(i + 1).padStart(2, '0');
          const ym = `${activeYear}-${mNum}`;
          const recordsForMonth = state.payrollRecords.filter(p => p.month === ym);
          const totalCost = recordsForMonth.reduce((s, p) => s + p.totalCompanyCost, 0);
          const totalGross = recordsForMonth.reduce((s, p) => s + p.grossSalary, 0);
          const totalNet = recordsForMonth.reduce((s, p) => s + p.netPaid, 0);
          const activeHeadcount = recordsForMonth.length;
          const hasData = recordsForMonth.length > 0;

          return {
            monthIndex: i,
            monthNum: mNum,
            yearMonth: ym,
            shortName: SHORT_MONTHS[i],
            fullName: ITALIAN_MONTHS[mNum],
            totalCost,
            totalGross,
            totalNet,
            activeHeadcount,
            hasData
          };
        });

        // Trova il costo massimo tra tutti i mesi per rapportare l'asse Y
        const maxMonthCost = Math.max(...monthlyStats.map(m => m.totalCost), 1);
        const peakMonth = monthlyStats.reduce((max, cur) => cur.totalCost > max.totalCost ? cur : max, monthlyStats[0]);

        // Calcolo KPI Annuali
        const yearRecords = state.payrollRecords.filter(p => p.month && p.month.startsWith(activeYear));
        const yearTotalGross = yearRecords.reduce((s, p) => s + p.grossSalary, 0);
        const yearTotalNet = yearRecords.reduce((s, p) => s + p.netPaid, 0);
        const yearTotalCost = yearRecords.reduce((s, p) => s + p.totalCompanyCost, 0);
        const yearTotalTfr = yearRecords.reduce((s, p) => s + p.severancePayAccrual, 0);
        const yearTotalEmployerContrib = yearRecords.reduce((s, p) => s + p.employerContributions + p.otherCompanyCosts, 0);
        const monthsCountWithData = monthlyStats.filter(m => m.hasData).length || 1;
        const avgMonthlyCost = yearTotalCost / monthsCountWithData;

        // Dati da mostrare in base alla modalità
        const isAllMonthsForEmp = selectedEmployeeId !== 'all';
        const displayedMonthRecords = isAllMonthsForEmp
          ? yearRecords
              .filter(p => p.employeeId === selectedEmployeeId)
              .sort((a, b) => a.month.localeCompare(b.month))
          : state.payrollRecords.filter(p => p.month === activeMonth);

        // Calcolo totali per la vista mese
        const monthTotalGross = displayedMonthRecords.reduce((sum, p) => sum + p.grossSalary, 0);
        const monthTotalNet = displayedMonthRecords.reduce((sum, p) => sum + p.netPaid, 0);
        const monthTotalCost = displayedMonthRecords.reduce((sum, p) => sum + p.totalCompanyCost, 0);
        const monthHasIncomplete = displayedMonthRecords.some(p => !p.isCompanyCostConfirmed);

        // Aggregazione per singolo dipendente su tutto l'anno
        const employeeYearlySummary = state.employees.map(emp => {
          const empRecords = yearRecords.filter(p => p.employeeId === emp.id || p.employeeName.toLowerCase().trim() === emp.fullName.toLowerCase().trim());
          const totalGross = empRecords.reduce((s, p) => s + p.grossSalary, 0);
          const totalNet = empRecords.reduce((s, p) => s + p.netPaid, 0);
          const totalEmployer = empRecords.reduce((s, p) => s + p.employerContributions + p.otherCompanyCosts, 0);
          const totalTfr = empRecords.reduce((s, p) => s + p.severancePayAccrual, 0);
          const totalCost = empRecords.reduce((s, p) => s + p.totalCompanyCost, 0);
          const monthsWorked = empRecords.length;

          return {
            employee: emp,
            totalGross,
            totalNet,
            totalEmployer,
            totalTfr,
            totalCost,
            monthsWorked,
            hasData: monthsWorked > 0
          };
        }).filter(item => item.hasData || item.employee.isActive);

        const handleConfirmCosts = (e: React.FormEvent) => {
          e.preventDefault();
          if (!showConfirmModal) return;
          if (currentRole !== 'amministrazione') {
            alert('Solo il ruolo Amministrazione può confermare i costi aziendali.');
            return;
          }

          const oneri = parseFloat(employerContrib) || 0;
          const tfr = parseFloat(tfrAccrual) || 0;
          const cassa = parseFloat(cassaEdile) || 0;
          const newTotalCost = Number((showConfirmModal.grossSalary + oneri + tfr + cassa).toFixed(2));

          const updatedRecords = state.payrollRecords.map(rec => {
            if (rec.id === showConfirmModal.id) {
              return {
                ...rec,
                employerContributions: oneri,
                severancePayAccrual: tfr,
                otherCompanyCosts: cassa,
                totalCompanyCost: newTotalCost,
                isCompanyCostConfirmed: true,
                status: 'verified' as const
              };
            }
            return rec;
          });

          let updatedState = {
            ...state,
            payrollRecords: updatedRecords
          };

          updatedState = addAuditLog(updatedState, {
            entityType: 'PAYROLL',
            entityId: showConfirmModal.id,
            action: 'UPDATE',
            previousValue: showConfirmModal,
            newValue: updatedRecords.find(r => r.id === showConfirmModal.id),
            details: `Confermato costo complessivo aziendale per ${showConfirmModal.employeeName} (${showConfirmModal.month}): € ${newTotalCost}`
          });

          updateState(updatedState);
          setShowConfirmModal(null);
        };

        return (
          <div className="space-y-8 pb-12">
            {/* Header & View Mode Switcher */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                  <Users className="w-8 h-8 text-sky-600" />
                  Personale & Costo del Lavoro
                </h1>
                <p className="text-base text-slate-500 mt-1">
                  Organico certificato JOB Sistemi • Analisi mensile, trend annuale e incidenza costi riflessi
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Switcher Vista Mese / Vista Anno */}
                <div className="flex p-1 bg-slate-200/80 rounded-xl shadow-inner border border-slate-300">
                  <button
                    onClick={() => setViewMode('year')}
                    className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      viewMode === 'year'
                        ? 'bg-white text-sky-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    Vista Anno
                  </button>
                  <button
                    onClick={() => setViewMode('month')}
                    className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      viewMode === 'month'
                        ? 'bg-white text-sky-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Vista Mese
                  </button>
                </div>

                {/* Filtro Anno */}
                <div className="flex items-center gap-1.5">
                  <select
                    value={activeYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-sm font-semibold shadow-sm focus:ring-2 focus:ring-sky-500 text-slate-800"
                  >
                    {sortedYears.map(yr => (
                      <option key={yr} value={yr}>Anno {yr}</option>
                    ))}
                  </select>
                </div>

                {/* Filtro Mese (attivo solo in Vista Mese) */}
                {viewMode === 'month' && !isAllMonthsForEmp && (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={activeMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-sm font-semibold shadow-sm focus:ring-2 focus:ring-sky-500 text-slate-800"
                    >
                      {sortedMonthsWithData.map(m => (
                        <option key={m} value={m}>
                          {formatMonthLabel(m)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Filtro Dipendente */}
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-sm font-medium shadow-sm focus:ring-2 focus:ring-sky-500 text-slate-800"
                  >
                    <option value="all">Tutto l'organico</option>
                    {state.employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                    ))}
                  </select>
                </div>

                <Link
                  href="/allineamento"
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-all shadow-sm"
                  title="Carica file PDF dei cedolini mensili e allinea con uscite bancarie"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-emerald-600" />
                  Carica Buste Paga PDF
                </Link>
              </div>
            </div>

            {/* SEZIONE ISTOGRAMMA MENSILE (Visibile in Vista Anno o come riferimento rapido) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-sky-600" />
                    Istogramma Costo del Lavoro - Anno {activeYear}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Rapportato al mese più costoso (100% = {peakMonth.fullName} {activeYear} con € {formatEuro(peakMonth.totalCost)})
                  </p>
                </div>

                {peakMonth.totalCost > 0 && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-900">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Mese di picco spesa: <strong>{peakMonth.fullName} (€ {formatEuro(peakMonth.totalCost)})</strong></span>
                  </div>
                )}
              </div>

              {/* Grafico a barre */}
              <div className="pt-8 pb-4">
                <div className="grid grid-cols-12 gap-2 sm:gap-3 items-end h-56 px-2 sm:px-4 border-b border-slate-200">
                  {monthlyStats.map((stat, idx) => {
                    const percentage = maxMonthCost > 0 ? (stat.totalCost / maxMonthCost) * 100 : 0;
                    const isPeak = stat.monthIndex === peakMonth.monthIndex && stat.totalCost > 0;
                    const isHovered = hoveredMonth === idx;
                    const isSelected = viewMode === 'month' && activeMonth === stat.yearMonth;

                    return (
                      <div
                        key={stat.monthNum}
                        className="relative flex flex-col items-center h-full justify-end group cursor-pointer"
                        onMouseEnter={() => setHoveredMonth(idx)}
                        onMouseLeave={() => setHoveredMonth(null)}
                        onClick={() => {
                          if (stat.hasData) {
                            setSelectedMonth(stat.yearMonth);
                            setViewMode('month');
                          }
                        }}
                      >
                        {/* Tooltip flottante sopra la barra */}
                        {(isHovered || isSelected) && stat.hasData && (
                          <div className="absolute -top-20 z-20 bg-slate-900 text-white text-xs rounded-xl py-2 px-3 shadow-xl whitespace-nowrap pointer-events-none transform -translate-x-1/2 left-1/2 animate-in fade-in zoom-in-95 duration-150">
                            <div className="font-bold text-sky-300">{stat.fullName} {activeYear}</div>
                            <div className="font-extrabold text-sm mt-0.5">€ {formatEuro(stat.totalCost)}</div>
                            <div className="text-2xs text-slate-300 flex justify-between gap-3 mt-1 pt-1 border-t border-slate-700">
                              <span>Netto: € {formatEuro(stat.totalNet)}</span>
                              <span>• {stat.activeHeadcount} cedolini</span>
                            </div>
                            <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-900" />
                          </div>
                        )}

                        {/* Importo abbreviato sopra le barre più alte */}
                        {stat.hasData && percentage > 35 && (
                          <div className={`text-2xs font-extrabold mb-1.5 transition-all ${
                            isPeak ? 'text-amber-600 scale-105' : isSelected ? 'text-sky-600' : 'text-slate-500'
                          }`}>
                            €{(stat.totalCost / 1000).toFixed(1).replace('.', ',')}k
                          </div>
                        )}

                        {/* Barra dell'istogramma */}
                        <div className="w-full max-w-[42px] bg-slate-100 rounded-t-xl overflow-hidden flex flex-col justify-end h-full">
                          {stat.hasData ? (
                            <div
                              style={{ height: `${Math.max(percentage, 6)}%` }}
                              className={`w-full rounded-t-xl transition-all duration-300 ${
                                isPeak
                                  ? 'bg-gradient-to-t from-amber-600 to-amber-400 group-hover:from-amber-700 group-hover:to-amber-500 shadow-md shadow-amber-500/20'
                                  : isSelected
                                  ? 'bg-gradient-to-t from-sky-600 to-sky-400 ring-2 ring-sky-500 ring-offset-1'
                                  : 'bg-gradient-to-t from-sky-500 to-cyan-400 group-hover:from-sky-600 group-hover:to-cyan-500'
                              }`}
                            />
                          ) : (
                            <div className="h-1.5 w-full bg-slate-200 rounded-t-sm" />
                          )}
                        </div>

                        {/* Etichetta Mese Asse X */}
                        <div className="mt-2 text-center">
                          <span className={`text-xs font-bold block ${
                            isPeak
                              ? 'text-amber-700 font-black'
                              : isSelected
                              ? 'text-sky-600 font-black'
                              : stat.hasData
                              ? 'text-slate-700'
                              : 'text-slate-400'
                          }`}>
                            {stat.shortName}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Didascalia e legenda interattiva */}
                <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 mt-3 px-2">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-sky-500 inline-block" /> Mese consuntivato
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-amber-500 inline-block" /> Mese di costo picco
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-slate-200 inline-block" /> Mesi non ancora consuntivati
                    </span>
                  </div>
                  <div className="italic text-2xs text-slate-400">
                    💡 Clicca su un mese per visualizzarne immediatamente i cedolini di dettaglio
                  </div>
                </div>
              </div>
            </div>

            {/* SEZIONE KPI CARD */}
            {viewMode === 'year' ? (
              /* KPI ANNO */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Costo Lavoro Totale {activeYear} (YTD)
                  </span>
                  <div className="text-3xl font-black text-slate-900 mt-2">
                    € {formatEuro(yearTotalCost)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Costo complessivo a C.E. su {monthsCountWithData} mesi consuntivati
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Media Costo Mensile
                  </span>
                  <div className="text-3xl font-black text-sky-600 mt-2">
                    € {formatEuro(avgMonthlyCost)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Spesa media calcolata sui mesi attivi
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Netto Totale Erogato (Cassa)
                  </span>
                  <div className="text-3xl font-black text-emerald-700 mt-2">
                    € {formatEuro(yearTotalNet)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Uscita liquida effettiva per stipendi
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Oneri Riflessi & Rateo TFR
                  </span>
                  <div className="text-3xl font-black text-slate-800 mt-2">
                    € {formatEuro((yearTotalEmployerContrib + yearTotalTfr))}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Oneri c/ditta (€ {formatEuro(yearTotalEmployerContrib)}) + TFR (€ {formatEuro(yearTotalTfr)})
                  </div>
                </div>
              </div>
            ) : (
              /* KPI MESE */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-sm font-semibold uppercase text-slate-500">
                    {isAllMonthsForEmp ? 'Netto Totale Cumulato Pagato' : `Netto in Busta (${formatMonthLabel(activeMonth)})`}
                  </span>
                  <div className="text-3xl font-black text-slate-900 mt-2">
                    € {formatEuro(monthTotalNet)}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Impatto diretto su cassa/bonifici stipendi</div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-sm font-semibold uppercase text-slate-500">
                    {isAllMonthsForEmp ? 'Retribuzione Lorda Cumulata YTD' : `Lordo Totale (${formatMonthLabel(activeMonth)})`}
                  </span>
                  <div className="text-3xl font-black text-slate-900 mt-2">
                    € {formatEuro(monthTotalGross)}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Imponibile previdenziale e fiscale</div>
                </div>

                <div className={`p-6 rounded-2xl border shadow-sm ${monthHasIncomplete ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200'}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold uppercase text-slate-700">
                      {isAllMonthsForEmp ? 'Costo Aziendale Cumulato YTD' : `Costo Aziendale Reale (${formatMonthLabel(activeMonth)})`}
                    </span>
                    {monthHasIncomplete ? (
                      <span className="text-xs font-bold text-amber-700 px-2 py-0.5 bg-amber-100 rounded-full">
                        Costo Incompleto
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-emerald-700 px-2 py-0.5 bg-emerald-100 rounded-full">
                        Confermato
                      </span>
                    )}
                  </div>
                  <div className="text-3xl font-black text-slate-900 mt-2">
                    € {formatEuro(monthTotalCost)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Include oneri a carico azienda e rateo TFR</div>
                </div>
              </div>
            )}

            {/* TABELLA DATI: ANNUALE vs MENSILE */}
            {viewMode === 'year' ? (
              /* TABELLA CONSOLIDATA ANNUALE PER DIPENDENTE */
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Riepilogo Costo Annuo per Collaboratore - Anno {activeYear}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Consuntivo da cedolini ufficiali elaborati ({monthsCountWithData} mesi: Gennaio - Agosto)
                    </p>
                  </div>
                  <span className="text-sm font-medium text-slate-500">
                    {employeeYearlySummary.length} risorse in organico
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-600 uppercase tracking-wider">
                        <th className="py-4 px-6">Collaboratore / Ruolo</th>
                        <th className="py-4 px-6 text-center">Mesi Lavorati</th>
                        <th className="py-4 px-6 text-right">Lordo Totale</th>
                        <th className="py-4 px-6 text-right">Netto Percepito</th>
                        <th className="py-4 px-6 text-right">Oneri c/Ditta</th>
                        <th className="py-4 px-6 text-right">TFR Maturato</th>
                        <th className="py-4 px-6 text-right">Costo Annuo Azienda</th>
                        <th className="py-4 px-6 text-right">Incidenza</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-base">
                      {employeeYearlySummary.map((item) => {
                        const incidence = yearTotalCost > 0 ? (item.totalCost / yearTotalCost) * 100 : 0;
                        return (
                          <tr key={item.employee.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-4 px-6">
                              <div className="font-bold text-slate-900">{item.employee.fullName}</div>
                              <div className="text-xs text-slate-500">
                                {item.employee.contractType === 'cococo' ? 'Co.Co.Co. (Gestione Separata)' : 'Dipendente Subordinato'} • {item.employee.role}
                              </div>
                            </td>
                            <td className="py-4 px-6 text-center">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                                {item.monthsWorked} / {monthsCountWithData} mesi
                              </span>
                            </td>
                            <td className="py-4 px-6 text-right font-semibold text-slate-800">
                              € {formatEuro(item.totalGross)}
                            </td>
                            <td className="py-4 px-6 text-right font-bold text-emerald-700">
                              € {formatEuro(item.totalNet)}
                            </td>
                            <td className="py-4 px-6 text-right text-sm text-slate-600">
                              € {item.totalEmployer}
                            </td>
                            <td className="py-4 px-6 text-right text-sm text-slate-600">
                              € {item.totalTfr}
                            </td>
                            <td className="py-4 px-6 text-right font-black text-slate-900">
                              € {formatEuro(item.totalCost)}
                            </td>
                            <td className="py-4 px-6 text-right font-bold text-sky-600 text-sm">
                              {incidence.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100/80 border-t-2 border-slate-300 font-black text-slate-900 text-base">
                        <td className="py-4 px-6">TOTALE GENERALE ANNUO</td>
                        <td className="py-4 px-6 text-center">-</td>
                        <td className="py-4 px-6 text-right">€ {formatEuro(yearTotalGross)}</td>
                        <td className="py-4 px-6 text-right text-emerald-700">€ {formatEuro(yearTotalNet)}</td>
                        <td className="py-4 px-6 text-right">€ {formatEuro(yearTotalEmployerContrib)}</td>
                        <td className="py-4 px-6 text-right">€ {formatEuro(yearTotalTfr)}</td>
                        <td className="py-4 px-6 text-right text-sky-900 text-lg">€ {formatEuro(yearTotalCost)}</td>
                        <td className="py-4 px-6 text-right">100.0%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : (
              /* TABELLA DETTAGLIATA MENSILE */
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                  <h2 className="text-xl font-bold text-slate-900">
                    {isAllMonthsForEmp
                      ? `Storico Cedolini ${activeYear}: ${state.employees.find(e => e.id === selectedEmployeeId)?.fullName || 'Collaboratore'}`
                      : `Dettaglio Cedolini & Collaboratori (${formatMonthLabel(activeMonth)})`}
                  </h2>
                  <span className="text-sm font-medium text-slate-500">{displayedMonthRecords.length} cedolini</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-600 uppercase tracking-wider">
                        {isAllMonthsForEmp && <th className="py-4 px-6">Mese</th>}
                        <th className="py-4 px-6">Collaboratore / Inquadramento</th>
                        <th className="py-4 px-6 text-right">Lordo (Competenze)</th>
                        <th className="py-4 px-6 text-right">Trattenute (INPS/IRPEF)</th>
                        <th className="py-4 px-6 text-right">Netto in Busta</th>
                        <th className="py-4 px-6 text-right">Oneri c/Azienda</th>
                        <th className="py-4 px-6 text-right">Costo Totale Azienda</th>
                        <th className="py-4 px-6 text-center">Stato Costo</th>
                        <th className="py-4 px-6 text-right">Azioni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-base">
                      {displayedMonthRecords.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-50/60">
                          {isAllMonthsForEmp && (
                            <td className="py-4 px-6 font-bold text-slate-800 whitespace-nowrap">
                              {formatMonthLabel(rec.month)}
                            </td>
                          )}
                          <td className="py-4 px-6">
                            <div className="font-bold text-slate-900">{rec.employeeName}</div>
                            <div className="text-xs text-slate-500">
                              {rec.contractType === 'cococo' ? 'Co.Co.Co. (Gestione Separata)' : 'Dipendente Subordinato'} • Origine: {rec.source}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right font-semibold text-slate-800">
                            € {formatEuro(rec.grossSalary)}
                          </td>
                          <td className="py-4 px-6 text-right text-sm text-slate-600">
                            € {formatEuro((rec.employeeContributions + rec.employeeTaxWithheld))}
                          </td>
                          <td className="py-4 px-6 text-right font-bold text-emerald-700">
                            € {formatEuro(rec.netPaid)}
                          </td>
                          <td className="py-4 px-6 text-right text-sm text-slate-600">
                            € {formatEuro((rec.employerContributions + rec.severancePayAccrual + rec.otherCompanyCosts))}
                          </td>
                          <td className="py-4 px-6 text-right font-extrabold text-slate-900">
                            € {formatEuro(rec.totalCompanyCost)}
                          </td>
                          <td className="py-4 px-6 text-center">
                            {rec.isCompanyCostConfirmed ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Confermato
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                                <AlertTriangle className="w-3.5 h-3.5" /> Costo Incompleto
                              </span>
                            )}
                            {rec.status === 'paid' || rec.bankTransactionId ? (
                              <span className="block text-[11px] font-semibold text-emerald-700 mt-1">
                                ✓ Bonificato
                              </span>
                            ) : (
                              <span className="block text-[10px] text-slate-400 mt-1">
                                Da liquidare
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right">
                            {!rec.isCompanyCostConfirmed && currentRole === 'amministrazione' && (
                              <button
                                onClick={() => {
                                  setShowConfirmModal(rec);
                                  setEmployerContrib('645.00');
                                  setTfrAccrual('155.00');
                                  setCassaEdile('50.00');
                                }}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold shadow-sm"
                              >
                                Verifica & Conferma
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modal Conferma Costo Aziendale */}
            {showConfirmModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl p-7 max-w-lg w-full shadow-2xl space-y-5">
                  <h3 className="text-xl font-bold text-slate-900">
                    Conferma Oneri e Costo Aziendale per {showConfirmModal.employeeName}
                  </h3>
                  <p className="text-sm text-slate-600">
                    Retribuzione lorda da cedolino: <strong>€ {formatEuro(showConfirmModal.grossSalary)}</strong>.
                    Inserisci o conferma i dati estratti dal prospetto riepilogativo del consulente (JOB Sistemi).
                  </p>

                  <form onSubmit={handleConfirmCosts} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        Oneri Previdenziali/Assicurativi a carico Società (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={employerContrib}
                        onChange={(e) => setEmployerContrib(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        Rateo Trattamento Fine Rapporto (TFR) maturato (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={tfrAccrual}
                        onChange={(e) => setTfrAccrual(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        Altri Oneri (Cassa Edile / Fondi Assistenza) (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={cassaEdile}
                        onChange={(e) => setCassaEdile(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-3">
                      <button
                        type="button"
                        onClick={() => setShowConfirmModal(null)}
                        className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl"
                      >
                        Annulla
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl shadow-sm"
                      >
                        Salva e Rendi Confermato
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
