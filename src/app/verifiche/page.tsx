'use client';

import React from 'react';
import { AppLayout } from '@/components/AppLayout';
import { FileCheck2, AlertTriangle, CheckCircle2, History, ShieldAlert, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function VerificheAuditPage() {
  return (
    <AppLayout>
      {({ state }) => {
        // Rilevazione automatica anomalie e controlli
        const overdueInvoices = state.invoices.filter(i => {
          if (!i.isActive || i.status === 'paid') return false;
          return i.dueDate < '2026-09-25'; // Data attuale
        });

        const incompletePayroll = state.payrollRecords.filter(p => !p.isCompanyCostConfirmed);

        // Controllo duplicati potenziali
        const duplicateInvoiceGroups: Record<string, typeof state.invoices> = {};
        state.invoices.forEach(inv => {
          const key = `${inv.type}_${inv.number.trim().toLowerCase()}`;
          duplicateInvoiceGroups[key] = duplicateInvoiceGroups[key] || [];
          duplicateInvoiceGroups[key].push(inv);
        });
        const duplicatesFound = Object.values(duplicateInvoiceGroups).filter(g => g.length > 1);

        const draftTaxRules = state.taxRules.filter(r => r.status === 'draft');

        return (
          <div className="space-y-8">
            <div className="pb-4 border-b border-slate-200">
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                <FileCheck2 className="w-8 h-8 text-sky-600" />
                Centro Verifiche, Anomalie & Registro di Audit
              </h1>
              <p className="text-base text-slate-500 mt-1">
                Monitoraggio proattivo delle incongruenze e tracciamento immutabile di tutte le modifiche sensibili
              </p>
            </div>

            {/* Cruscotto Anomalie Rilevate */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Segnalazioni di Controllo Attive</h2>

              {duplicatesFound.length === 0 && overdueInvoices.length === 0 && incompletePayroll.length === 0 && draftTaxRules.length === 0 ? (
                <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-4 text-emerald-900">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
                  <div>
                    <h3 className="text-lg font-bold">Nessuna anomalia critica rilevata</h3>
                    <p className="text-base text-emerald-800">Tutti i controlli su fatture, cedolini e riconciliazioni risultano coerenti.</p>
                  </div>
                </div>
              ) : null}

              {/* Anomalia 1: Cedolini con costo incompleto */}
              {incompletePayroll.map((p) => (
                <div key={p.id} className="p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-base font-bold text-amber-900">
                        Costo del Personale Incompleto: {p.employeeName} ({p.month})
                      </h4>
                      <p className="text-sm text-amber-800 mt-0.5">
                        Mancano i prospetti riepilogativi degli oneri a carico azienda e quota TFR da parte del consulente del lavoro (JOB Sistemi).
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/personale"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl shadow-sm shrink-0"
                  >
                    Verifica in Personale <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}

              {/* Anomalia 2: Regole fiscali in bozza */}
              {draftTaxRules.map((r) => (
                <div key={r.id} className="p-5 bg-sky-50 border border-sky-200 rounded-2xl flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="w-6 h-6 text-sky-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-base font-bold text-sky-900">
                        Regola Fiscale in Attesa di Validazione: {r.code}
                      </h4>
                      <p className="text-sm text-sky-800 mt-0.5">
                        {r.description} • La regola non verrà applicata ai costi finché non sarà approvata.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/regole-fiscali"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-xl shadow-sm shrink-0"
                  >
                    Approva Regola <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>

            {/* Registro Storico di Audit Trail */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Registro delle Modifiche (Audit Trail)</h2>
                  <p className="text-sm text-slate-500">Tracciamento di ogni operazione su dati sensibili (chi, cosa, quando)</p>
                </div>
                <span className="text-sm font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                  {state.auditLogs.length} eventi registrati
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {state.auditLogs.map((log) => (
                  <div key={log.id} className="p-6 space-y-2 hover:bg-slate-50/50">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono text-slate-400">{log.timestamp}</span>
                        <span className="text-xs uppercase font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                          {log.action}
                        </span>
                        <span className="text-sm font-bold text-sky-700">{log.entityType}</span>
                        <span className="text-xs text-slate-500">ID: {log.entityId}</span>
                      </div>
                      <div className="text-sm font-medium text-slate-600">
                        Eseguito da: <strong className="text-slate-900">{log.userName}</strong> ({log.userRole})
                      </div>
                    </div>
                    {log.details && (
                      <p className="text-base text-slate-800 font-medium pl-2 border-l-2 border-sky-400">
                        {log.details}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      }}
    </AppLayout>
  );
}
