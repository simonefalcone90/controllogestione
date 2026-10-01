'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { ShieldCheck, Plus, CheckCircle, Clock, AlertTriangle, ShieldAlert } from 'lucide-react';
import { TaxRule } from '@/financial-engine/types';
import { addAuditLog } from '@/lib/store';

export default function RegoleFiscaliPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Materiali');
  const [vatRate, setVatRate] = useState('100');
  const [taxRate, setTaxRate] = useState('100');

  return (
    <AppLayout>
      {({ state, updateState, currentRole }) => {
        const handleApproveRule = (rule: TaxRule) => {
          if (currentRole !== 'amministrazione') {
            alert('Solo il ruolo Amministrazione può approvare regole fiscali.');
            return;
          }

          if (!confirm(`Approvare formalmente la regola fiscale "${rule.code}"?\nVerrà registrata nel registro di audit.`)) return;

          const updatedRules = state.taxRules.map(r => {
            if (r.id === rule.id) {
              return {
                ...r,
                status: 'approved' as const,
                approvedBy: state.currentUser.name,
                approvedAt: new Date().toISOString().split('T')[0]
              };
            }
            return r;
          });

          let updatedState = {
            ...state,
            taxRules: updatedRules
          };

          updatedState = addAuditLog(updatedState, {
            entityType: 'TAX_RULE',
            entityId: rule.id,
            action: 'APPROVE',
            previousValue: { status: rule.status },
            newValue: { status: 'approved', approvedBy: state.currentUser.name },
            details: `Approvazione validata della regola fiscale ${rule.code} (% IVA: ${rule.vatDeductibleRate * 100}%, % Deducibile: ${rule.taxDeductibleRate * 100}%)`
          });

          updateState(updatedState);
        };

        const handleCreateRule = (e: React.FormEvent) => {
          e.preventDefault();
          if (currentRole !== 'amministrazione') {
            alert('Solo il ruolo Amministrazione può definire regole fiscali.');
            return;
          }

          const newRule: TaxRule = {
            id: `tax-${Date.now()}`,
            code,
            description,
            category,
            vatDeductibleRate: parseFloat(vatRate) / 100,
            taxDeductibleRate: parseFloat(taxRate) / 100,
            validFrom: new Date().toISOString().split('T')[0],
            status: 'draft',
            notes: 'Inserita da interfaccia in attesa di validazione'
          };

          let updatedState = {
            ...state,
            taxRules: [...state.taxRules, newRule]
          };

          updatedState = addAuditLog(updatedState, {
            entityType: 'TAX_RULE',
            entityId: newRule.id,
            action: 'CREATE',
            newValue: newRule,
            details: `Creazione bozza regola fiscale: ${newRule.code}`
          });

          updateState(updatedState);
          setShowAddModal(false);
          setCode('');
          setDescription('');
        };

        return (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                  <ShieldCheck className="w-8 h-8 text-sky-600" />
                  Regole Fiscali Versionate & Approvazioni
                </h1>
                <p className="text-base text-slate-500 mt-1">
                  Trasparenza normativa: nessuna percentuale fiscale arbitraria inserita nel codice
                </p>
              </div>

              {currentRole === 'amministrazione' && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl shadow-sm"
                >
                  <Plus className="w-5 h-5" />
                  Nuova Regola Fiscale
                </button>
              )}
            </div>

            {/* Note Vincolante Specifica */}
            <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-4">
              <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900 leading-relaxed">
                <strong>Presidio di Governance Fiscale:</strong> Tutte le detraibilità IVA e deducibilità IRES sono archiviate come regole parametriche versionate con data di validità. Le regole in stato <strong>Bozza</strong> richiedono approvazione esplicita prima di essere applicate ai calcoli dei costi. Nessun modulo automatico o intelligenza artificiale può approvare regole senza supervisione umana.
              </div>
            </div>

            {/* Tabella Regole */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-900">Archivio Regole Fiscali Applicabili</h2>
                <span className="text-sm text-slate-500">{state.taxRules.length} regole configurate</span>
              </div>

              <div className="divide-y divide-slate-100">
                {state.taxRules.map((rule) => (
                  <div key={rule.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-slate-900">{rule.code}</span>
                        {rule.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            <CheckCircle className="w-3.5 h-3.5" /> Approvata
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            <Clock className="w-3.5 h-3.5" /> Bozza (Non ancora attiva)
                          </span>
                        )}
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                          {rule.category}
                        </span>
                      </div>
                      <p className="text-base text-slate-700">{rule.description}</p>
                      <div className="text-xs text-slate-400">
                        Valida dal: {rule.validFrom} {rule.approvedBy && `• Approvata da: ${rule.approvedBy} (${rule.approvedAt})`}
                      </div>
                      {rule.notes && <p className="text-xs text-amber-800 italic mt-1">{rule.notes}</p>}
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-base font-bold text-slate-900">
                          IVA Detraibile: {Math.round(rule.vatDeductibleRate * 100)}%
                        </div>
                        <div className="text-sm font-semibold text-slate-600">
                          Deducibilità IRES: {Math.round(rule.taxDeductibleRate * 100)}%
                        </div>
                      </div>

                      {rule.status === 'draft' && currentRole === 'amministrazione' && (
                        <button
                          onClick={() => handleApproveRule(rule)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm"
                        >
                          Valida & Approva
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Nuova Regola */}
            {showAddModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl p-7 max-w-lg w-full shadow-2xl space-y-5">
                  <h3 className="text-xl font-bold text-slate-900">Definisci Nuova Regola Fiscale</h3>
                  <form onSubmit={handleCreateRule} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Codice Identificativo</label>
                      <input
                        type="text"
                        required
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="es. UTENZE-ENERGIA-SEDE"
                        className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base font-mono uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Descrizione & Campo d'Applicazione</label>
                      <input
                        type="text"
                        required
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="es. Energia elettrica magazzino e sede operativa"
                        className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">IVA Detraibile (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          required
                          value={vatRate}
                          onChange={(e) => setVatRate(e.target.value)}
                          className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Deducibilità IRES (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          required
                          value={taxRate}
                          onChange={(e) => setTaxRate(e.target.value)}
                          className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base"
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
                        Salva come Bozza
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
