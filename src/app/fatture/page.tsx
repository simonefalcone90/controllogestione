'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';
import { calculateWithholdingSettlement, normalizeCounterpartName, syncEntitiesFromInvoices } from '@/financial-engine/calculations';
import { Invoice } from '@/financial-engine/types';
import { addAuditLog, AppState } from '@/lib/store';
import { Receipt, Plus, Upload, CheckCircle2, AlertCircle, ArrowUpRight, ArrowDownRight, DollarSign, Trash2, CheckCheck, Search } from 'lucide-react';
import { formatEuro, formatPercent } from '@/lib/format';

export default function FatturePage() {
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'passive'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState<Invoice | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState('all');

  // Form Nuovo Documento
  const [docNumber, setDocNumber] = useState('');
  const [docType, setDocType] = useState<'active' | 'passive'>('active');
  const [counterpartName, setCounterpartName] = useState('');
  const [taxableAmount, setTaxableAmount] = useState('');
  const [vatRate, setVatRate] = useState('22');
  const [competenceMonth, setCompetenceMonth] = useState('2026-09');
  const [dueDate, setDueDate] = useState('2026-10-31');
  const [category, setCategory] = useState('Impianti Termoidraulici');
  const [isWithholding, setIsWithholding] = useState(false);

  // Form Registrazione Incasso/Pagamento
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentWithholding, setPaymentWithholding] = useState(false);

  return (
    <AppLayout>
      {({ state, updateState, currentRole }) => {
        // Rileva tutti gli anni presenti nelle fatture
        const availableYears = Array.from(
          new Set(state.invoices.map(i => i.issueDate ? i.issueDate.substring(0, 4) : '2026'))
        ).sort().reverse();

        const filteredInvoices = state.invoices.filter(inv => {
          if (!inv.isActive) return false;
          if (activeTab === 'active' && inv.type !== 'active') return false;
          if (activeTab === 'passive' && inv.type !== 'passive') return false;
          
          if (selectedYear !== 'all') {
            const invYear = inv.issueDate ? inv.issueDate.substring(0, 4) : '';
            if (invYear !== selectedYear) return false;
          }

          if (searchTerm.trim()) {
            const query = searchTerm.toLowerCase();
            const matchNumber = inv.number.toLowerCase().includes(query);
            const matchParty = inv.counterpartName.toLowerCase().includes(query);
            const matchCat = (inv.category || '').toLowerCase().includes(query);
            if (!matchNumber && !matchParty && !matchCat) return false;
          }

          return true;
        });

        const handleCreateInvoice = (e: React.FormEvent) => {
          e.preventDefault();
          if (currentRole !== 'amministrazione') {
            alert('Solo il ruolo Amministrazione può inserire fatture.');
            return;
          }

          // Controllo duplicati
          const isDuplicate = state.invoices.some(
            inv => inv.number.trim().toLowerCase() === docNumber.trim().toLowerCase() && inv.type === docType
          );
          if (isDuplicate) {
            alert(`Errore Controllo Duplicati: Esiste già una fattura con numero "${docNumber}" per questo tipo.`);
            return;
          }

          const taxable = parseFloat(taxableAmount) || 0;
          const rate = parseFloat(vatRate) / 100;
          const vat = Number((taxable * rate).toFixed(2));
          const total = Number((taxable + vat).toFixed(2));

          const newInv: Invoice = {
            id: `inv-${Date.now()}`,
            number: docNumber,
            type: docType,
            counterpartId: 'custom-cp',
            counterpartName,
            issueDate: new Date().toISOString().split('T')[0],
            economicCompetenceMonth: competenceMonth,
            dueDate,
            taxableAmount: taxable,
            vatAmount: vat,
            totalAmount: total,
            category,
            status: 'issued',
            isWithholdingApplicable: isWithholding,
            withholdingRate: isWithholding ? 0.11 : 0,
            withholdingAmount: 0,
            amountCreditedByBank: 0,
            amountPaidByClient: 0,
            outstandingAmount: total,
            isActive: true
          };

          // Sincronizza automaticamente la controparte nelle anagrafiche (Fornitore per passive, Cliente per attive)
          const allInvoices = [newInv, ...state.invoices];
          const entitySync = syncEntitiesFromInvoices(state.entities, allInvoices);

          let updatedState = {
            ...state,
            invoices: allInvoices,
            entities: entitySync.updatedEntities
          };

          updatedState = addAuditLog(updatedState, {
            entityType: 'INVOICE',
            entityId: newInv.id,
            action: 'CREATE',
            newValue: newInv,
            details: `Inserimento fattura ${newInv.type === 'active' ? 'emessa' : 'ricevuta'} N. ${newInv.number} (${newInv.counterpartName}) per € ${newInv.totalAmount}.${entitySync.createdCount > 0 ? ` Censita automaticamente nuova anagrafica ${newInv.type === 'active' ? 'cliente' : 'fornitore'}.` : ''}`
          });

          updateState(updatedState);
          setShowAddModal(false);
          setDocNumber('');
          setCounterpartName('');
          setTaxableAmount('');
        };

        const handleProcessPayment = (e: React.FormEvent) => {
          e.preventDefault();
          if (!showPaymentModal) return;
          if (currentRole !== 'amministrazione') {
            alert('Solo il ruolo Amministrazione può registrare pagamenti.');
            return;
          }

          const amountPaid = parseFloat(paymentAmount) || 0;
          const previousInv = { ...showPaymentModal };

          const settlement = calculateWithholdingSettlement({
            totalAmount: showPaymentModal.totalAmount,
            isWithholdingApplicable: paymentWithholding,
            withholdingRate: 0.11,
            applyVatDescorporation: true,
            clientPaidAmount: (showPaymentModal.amountPaidByClient || 0) + amountPaid
          });

          const updatedInvoices = state.invoices.map(inv => {
            if (inv.id === showPaymentModal.id) {
              return {
                ...inv,
                status: settlement.status,
                isWithholdingApplicable: paymentWithholding,
                withholdingAmount: settlement.withholdingAmount,
                amountCreditedByBank: settlement.bankCreditedAmount,
                amountPaidByClient: settlement.clientPaid,
                outstandingAmount: settlement.outstandingAmount
              };
            }
            return inv;
          });

          let updatedState = {
            ...state,
            invoices: updatedInvoices
          };

          updatedState = addAuditLog(updatedState, {
            entityType: 'INVOICE',
            entityId: showPaymentModal.id,
            action: 'UPDATE',
            previousValue: previousInv,
            newValue: updatedInvoices.find(i => i.id === showPaymentModal.id),
            details: `Registrato ${showPaymentModal.type === 'active' ? 'incasso' : 'pagamento'} di € ${amountPaid} (Bonifico parlante: ${paymentWithholding ? 'Sì, ritenuta 8%' : 'No'}). Residuo da saldare: € ${settlement.outstandingAmount}`
          });

          updateState(updatedState);
          setShowPaymentModal(null);
          setPaymentAmount('');
        };

        const handleClearAllInvoices = () => {
          if (currentRole !== 'amministrazione') return;
          if (!confirm(`Sei sicuro di voler eliminare tutte le ${state.invoices.length} fatture presenti a sistema?\nQuesta azione rimuoverà i dati fittizi/di prova per consentire il caricamento pulito delle fatture reali da Aruba.`)) {
            return;
          }

          const previousCount = state.invoices.length;
          // Rimuove anche le voci di previsione cassa collegate alle fatture
          const updatedForecast = state.forecastItems.filter(
            item => item.sourceType !== 'invoice_client' && item.sourceType !== 'invoice_supplier'
          );

          let updatedState: AppState = {
            ...state,
            invoices: [] as Invoice[],
            forecastItems: updatedForecast
          };

          updatedState = addAuditLog(updatedState, {
            entityType: 'INVOICE',
            entityId: 'ALL',
            action: 'DELETE',
            details: `Azzeramento completo archivio fatture: rimosse ${previousCount} fatture fittizie/di prova e relative voci di previsione cassa per importazione dati reali.`
          });

          updateState(updatedState);
        };

        const handleMarkAllAsPaid = () => {
          if (currentRole !== 'amministrazione') return;
          if (!confirm(`Vuoi dichiarare SALDATE tutte le ${state.invoices.length} fatture presenti a sistema?\nQuesta azione imposterà lo stato a "Saldata", azzerando i residui da pagare e da incassare per partire da una situazione pulita (punto 0).`)) {
            return;
          }

          const updatedInvoices: Invoice[] = state.invoices.map(inv => ({
            ...inv,
            status: 'paid' as const,
            outstandingAmount: 0,
            amountPaidByClient: inv.totalAmount,
            amountCreditedByBank: inv.totalAmount - (inv.withholdingAmount || 0)
          }));

          // Rimuove anche le voci di previsione cassa collegate a queste fatture poiché già saldate
          const updatedForecast = state.forecastItems.filter(
            item => item.sourceType !== 'invoice_client' && item.sourceType !== 'invoice_supplier'
          );

          let updatedState: AppState = {
            ...state,
            invoices: updatedInvoices,
            forecastItems: updatedForecast
          };

          updatedState = addAuditLog(updatedState, {
            entityType: 'INVOICE',
            entityId: 'ALL',
            action: 'UPDATE',
            details: `Allineamento punto 0: dichiarate saldate tutte le ${updatedInvoices.length} fatture (azzerati crediti/debiti residui e scadenziario).`
          });

          updateState(updatedState);
        };

        return (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                  <Receipt className="w-8 h-8 text-sky-600" />
                  Ciclo Attivo & Passivo (Fatture e Incassi)
                </h1>
                <p className="text-base text-slate-500 mt-1">
                  Gestione fatture clienti, bonifici parlanti con ritenuta 8% e pagamenti fornitori
                </p>
              </div>

              {currentRole === 'amministrazione' && (
                <div className="flex items-center gap-3">
                  {state.invoices.length > 0 && (
                    <>
                      <Link
                        href="/allineamento"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-semibold rounded-xl text-sm transition-all shadow-sm"
                        title="Importa fatture in PDF, XML o ZIP per l'allineamento con la banca"
                      >
                        <Upload className="w-4 h-4 text-purple-600" />
                        Carica Fatture (PDF / XML / ZIP)
                      </Link>
                      <button
                        onClick={handleMarkAllAsPaid}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold rounded-xl text-sm transition-all shadow-sm"
                        title="Dichiara saldate tutte le fatture (imposta punto 0)"
                      >
                        <CheckCheck className="w-4 h-4 text-emerald-600" />
                        Dichiara Tutte Saldate (Punto 0)
                      </button>
                      <button
                        onClick={handleClearAllInvoices}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold rounded-xl text-sm transition-all"
                        title="Elimina tutte le fatture presenti per caricare quelle reali"
                      >
                        <Trash2 className="w-4 h-4 text-rose-600" />
                        Svuota Fatture ({state.invoices.length})
                      </button>
                    </>
                  )}
                  {state.invoices.length === 0 && (
                    <Link
                      href="/allineamento"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-semibold rounded-xl text-sm transition-all shadow-sm"
                    >
                      <Upload className="w-4 h-4 text-purple-600" />
                      Carica Fatture (PDF / XML / ZIP)
                    </Link>
                  )}
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl shadow-sm transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    Nuova Fattura
                  </button>
                </div>
              )}
            </div>

            {/* Filtri Tipo Documento, Anno e Ricerca */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-4 py-2 rounded-xl text-base font-semibold transition-all ${
                    activeTab === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Tutti i Documenti ({state.invoices.length})
                </button>
                <button
                  onClick={() => setActiveTab('active')}
                  className={`px-4 py-2 rounded-xl text-base font-semibold transition-all ${
                    activeTab === 'active'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Fatture Emesse / Clienti ({state.invoices.filter(i => i.type === 'active').length})
                </button>
                <button
                  onClick={() => setActiveTab('passive')}
                  className={`px-4 py-2 rounded-xl text-base font-semibold transition-all ${
                    activeTab === 'passive'
                      ? 'bg-rose-700 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Fatture Acquisto / Fornitori ({state.invoices.filter(i => i.type === 'passive').length})
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cerca numero o cliente..."
                    className="pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium shadow-sm focus:ring-2 focus:ring-sky-500 w-52"
                  />
                </div>

                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold shadow-sm focus:ring-2 focus:ring-sky-500 text-slate-700"
                >
                  <option value="all">Tutti gli Anni</option>
                  {availableYears.map(yr => (
                    <option key={yr} value={yr}>Anno {yr}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tabella Fatture */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-4 px-6">Doc & Data</th>
                      <th className="py-4 px-6">Controparte</th>
                      <th className="py-4 px-6">Categoria & Competenza</th>
                      <th className="py-4 px-6 text-right">Totale Fattura</th>
                      <th className="py-4 px-6 text-right">Accreditato / Ritenuta</th>
                      <th className="py-4 px-6 text-right">Residuo da Saldare</th>
                      <th className="py-4 px-6 text-center">Stato</th>
                      <th className="py-4 px-6 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-base">
                    {filteredInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-900">{inv.number}</div>
                          <div className="text-xs text-slate-500">Scadenza: {inv.dueDate}</div>
                        </td>
                        <td className="py-4 px-6 font-medium text-slate-800">
                          {inv.counterpartName}
                        </td>
                        <td className="py-4 px-6">
                          <div className="text-sm font-semibold text-slate-700">{inv.category}</div>
                          <div className="text-xs text-sky-600 font-medium">Competenza: {inv.economicCompetenceMonth}</div>
                        </td>
                        <td className="py-4 px-6 text-right font-bold text-slate-900">
                          € {formatEuro(inv.totalAmount)}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="text-sm font-semibold text-emerald-700">
                            € {formatEuro((inv.amountCreditedByBank || 0))}
                          </div>
                          {(inv.withholdingAmount || 0) > 0 && (
                            <div className="text-xs text-amber-700 font-medium">
                              Ritenuta 11%: € {formatEuro(inv.withholdingAmount || 0)}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className={`font-black ${inv.outstandingAmount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            € {formatEuro(inv.outstandingAmount)}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          {inv.status === 'paid' && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Saldata
                            </span>
                          )}
                          {inv.status === 'partially_paid' && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                              Parziale
                            </span>
                          )}
                          {inv.status === 'issued' && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                              Aperta
                            </span>
                          )}
                          {inv.bankTransactionId && (
                            <span className="block text-[11px] font-semibold text-sky-600 mt-1">
                              ✓ Riconciliata Banca
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          {inv.outstandingAmount > 0 && currentRole === 'amministrazione' && (
                            <button
                              onClick={() => {
                                setShowPaymentModal(inv);
                                setPaymentAmount(inv.outstandingAmount.toString());
                                setPaymentWithholding(inv.isWithholdingApplicable || false);
                              }}
                              className="px-3 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg text-sm font-semibold border border-sky-200"
                            >
                              {inv.type === 'active' ? 'Registra Incasso' : 'Registra Pagamento'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Creazione Fattura */}
            {showAddModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl p-7 max-w-lg w-full shadow-2xl space-y-5">
                  <h3 className="text-xl font-bold text-slate-900">Registra Fattura</h3>
                  <form onSubmit={handleCreateInvoice} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Tipo Documento</label>
                        <select
                          value={docType}
                          onChange={(e) => setDocType(e.target.value as any)}
                          className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base font-medium"
                        >
                          <option value="active">Attiva (Emessa a Cliente)</option>
                          <option value="passive">Passiva (Ricevuta Fornitore)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Numero Documento</label>
                        <input
                          type="text"
                          required
                          value={docNumber}
                          onChange={(e) => setDocNumber(e.target.value)}
                          placeholder="es. FATT-2026/105"
                          className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        Controparte ({docType === 'active' ? 'Cliente' : 'Fornitore'})
                      </label>
                      <input
                        type="text"
                        required
                        list="counterparts-datalist"
                        value={counterpartName}
                        onChange={(e) => setCounterpartName(e.target.value)}
                        placeholder={docType === 'active' ? 'Seleziona o digita nome cliente' : 'Seleziona o digita nome fornitore'}
                        className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base"
                      />
                      <datalist id="counterparts-datalist">
                        {state.entities
                          .filter(e => e.isActive && (docType === 'active' ? (e.type === 'client' || e.type === 'both') : (e.type === 'supplier' || e.type === 'both')))
                          .map(e => (
                            <option key={e.id} value={e.name}>
                              {e.vatNumber ? `P.IVA: ${e.vatNumber}` : e.taxCode ? `CF: ${e.taxCode}` : ''}
                            </option>
                          ))
                        }
                      </datalist>
                      <span className="text-xs text-slate-400 mt-1 block">
                        Se la controparte non è ancora in anagrafica, verrà censita automaticamente come {docType === 'active' ? 'Cliente' : 'Fornitore'}.
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Imponibile (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={taxableAmount}
                          onChange={(e) => setTaxableAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Aliquota IVA (%)</label>
                        <select
                          value={vatRate}
                          onChange={(e) => setVatRate(e.target.value)}
                          className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base font-medium"
                        >
                          <option value="22">22% Ordinaria</option>
                          <option value="10">10% Agevolata Edilizia</option>
                          <option value="4">4% Prima Casa</option>
                          <option value="0">0% Esente / Split</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Mese di Competenza</label>
                        <input
                          type="month"
                          required
                          value={competenceMonth}
                          onChange={(e) => setCompetenceMonth(e.target.value)}
                          className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Data Scadenza</label>
                        <input
                          type="date"
                          required
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base"
                        />
                      </div>
                    </div>

                    {docType === 'active' && (
                      <div className="p-3 bg-sky-50 rounded-xl border border-sky-100 flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="withholding"
                          checked={isWithholding}
                          onChange={(e) => setIsWithholding(e.target.checked)}
                          className="h-5 w-5 rounded text-sky-600"
                        />
                        <label htmlFor="withholding" className="text-sm font-medium text-sky-900 cursor-pointer">
                          Soggetto a Bonifico Parlante (Ritenuta Bancaria 8% alla fonte per ecobonus/ristrutturazioni)
                        </label>
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
                        Registra Documento
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal Registrazione Incasso */}
            {showPaymentModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl p-7 max-w-lg w-full shadow-2xl space-y-5">
                  <h3 className="text-xl font-bold text-slate-900">
                    Registra Incasso per {showPaymentModal.number}
                  </h3>
                  <div className="p-4 bg-slate-50 rounded-xl text-sm space-y-1">
                    <p className="text-slate-600">Cliente: <strong>{showPaymentModal.counterpartName}</strong></p>
                    <p className="text-slate-600">Totale Documento: <strong>€ {formatEuro(showPaymentModal.totalAmount)}</strong></p>
                    <p className="text-slate-600">Residuo attuale: <strong className="text-rose-600">€ {formatEuro(showPaymentModal.outstandingAmount)}</strong></p>
                  </div>

                  <form onSubmit={handleProcessPayment} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        Importo Disposto dal Cliente (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        max={showPaymentModal.outstandingAmount}
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-base"
                      />
                    </div>

                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="payWithholding"
                          checked={paymentWithholding}
                          onChange={(e) => setPaymentWithholding(e.target.checked)}
                          className="h-5 w-5 rounded text-amber-600"
                        />
                        <label htmlFor="payWithholding" className="text-sm font-bold text-amber-900 cursor-pointer">
                          Applica Ritenuta Bonifico Parlante (11% - L. 213/2023)
                        </label>
                      </div>
                      {paymentWithholding && (
                        <p className="text-xs text-amber-800 leading-relaxed">
                          La banca tratterrà l'11% (€ {formatEuro(parseFloat(paymentAmount || '0') * 0.11)}) e accrediterà il netto di € {formatEuro(parseFloat(paymentAmount || '0') * 0.89)}. 
                          <strong>La ritenuta non risulterà come insoluto</strong> ma come credito d'imposta aziendale (F24).
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end gap-3 pt-3">
                      <button
                        type="button"
                        onClick={() => setShowPaymentModal(null)}
                        className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl"
                      >
                        Annulla
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-sm"
                      >
                        Conferma Incasso
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
