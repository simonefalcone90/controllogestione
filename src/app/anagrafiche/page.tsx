'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Settings, Users, Building, Plus, CheckCircle, PowerOff, RefreshCw, ShoppingCart, UserCheck, Layers, FileText, Pencil, Trash2 } from 'lucide-react';
import { EntityCounterpart, Employee } from '@/financial-engine/types';
import { syncEntitiesFromInvoices, normalizeCounterpartName } from '@/financial-engine/calculations';
import { addAuditLog } from '@/lib/store';
import { formatEuro, formatPercent } from '@/lib/format';

export default function AnagrafichePage() {
  const [activeTab, setActiveTab] = useState<'entities' | 'employees'>('entities');
  const [entityFilter, setEntityFilter] = useState<'all' | 'client' | 'supplier' | 'both'>('all');
  const [showAddEntity, setShowAddEntity] = useState(false);
  const [showAddEmp, setShowAddEmp] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Form Controparte
  const [entityName, setEntityName] = useState('');
  const [entityType, setEntityType] = useState<'client' | 'supplier' | 'both'>('client');
  const [vat, setVat] = useState('');
  const [email, setEmail] = useState('');

  // Form Dipendente (Nuovo / Modifica)
  const [empName, setEmpName] = useState('');
  const [empTaxCode, setEmpTaxCode] = useState('');
  const [empRole, setEmpRole] = useState('');
  const [empType, setEmpType] = useState<'subordinate' | 'cococo'>('subordinate');
  const [empSalary, setEmpSalary] = useState('');
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteConfirmEmp, setDeleteConfirmEmp] = useState<Employee | null>(null);

  return (
    <AppLayout>
      {({ state, updateState, currentRole }) => {
        const handleCreateEntity = (e: React.FormEvent) => {
          e.preventDefault();
          if (currentRole !== 'amministrazione') {
            alert('Solo il ruolo Amministrazione può censire anagrafiche.');
            return;
          }

          const newEnt: EntityCounterpart = {
            id: `ent-${Date.now()}`,
            name: entityName,
            type: entityType,
            vatNumber: vat,
            email,
            isActive: true
          };

          let updatedState = {
            ...state,
            entities: [...state.entities, newEnt]
          };

          updatedState = addAuditLog(updatedState, {
            entityType: 'ENTITY',
            entityId: newEnt.id,
            action: 'CREATE',
            newValue: newEnt,
            details: `Censita nuova controparte: ${newEnt.name} (${newEnt.type})`
          });

          updateState(updatedState);
          setShowAddEntity(false);
          setEntityName('');
          setVat('');
          setEmail('');
        };

        const handleOpenAddEmp = () => {
          setEditingEmployee(null);
          setEmpName('');
          setEmpTaxCode('');
          setEmpRole('');
          setEmpType('subordinate');
          setEmpSalary('');
          setShowAddEmp(true);
        };

        const handleOpenEditEmp = (emp: Employee) => {
          setEditingEmployee(emp);
          setEmpName(emp.fullName);
          setEmpTaxCode(emp.taxCode);
          setEmpRole(emp.role);
          setEmpType(emp.contractType);
          setEmpSalary(emp.standardGrossSalary ? emp.standardGrossSalary.toString() : '');
          setShowAddEmp(true);
        };

        const handleSaveEmployee = (e: React.FormEvent) => {
          e.preventDefault();
          if (currentRole !== 'amministrazione') {
            alert('Solo il ruolo Amministrazione può modificare o censire collaboratori.');
            return;
          }

          if (editingEmployee) {
            // Modifica collaboratore esistente
            const updatedEmp: Employee = {
              ...editingEmployee,
              fullName: empName,
              taxCode: empTaxCode.trim().toUpperCase(),
              role: empRole,
              contractType: empType,
              standardGrossSalary: parseFloat(empSalary) || 0
            };

            const updatedEmployees = state.employees.map(emp => 
              emp.id === editingEmployee.id ? updatedEmp : emp
            );

            // Sincronizza anche il nome e inquadramento nei record cedolini collegati
            const updatedPayroll = state.payrollRecords.map(pr => {
              if (pr.employeeId === editingEmployee.id) {
                return {
                  ...pr,
                  employeeName: updatedEmp.fullName,
                  contractType: updatedEmp.contractType
                };
              }
              return pr;
            });

            let updatedState = {
              ...state,
              employees: updatedEmployees,
              payrollRecords: updatedPayroll
            };

            updatedState = addAuditLog(updatedState, {
              entityType: 'EMPLOYEE',
              entityId: updatedEmp.id,
              action: 'UPDATE',
              previousValue: editingEmployee,
              newValue: updatedEmp,
              details: `Modificata anagrafica collaboratore: ${updatedEmp.fullName} (${updatedEmp.role})`
            });

            updateState(updatedState);
            setShowAddEmp(false);
            setEditingEmployee(null);
          } else {
            // Nuovo collaboratore
            const newEmp: Employee = {
              id: `emp-${Date.now()}`,
              fullName: empName,
              taxCode: empTaxCode.trim().toUpperCase(),
              role: empRole,
              contractType: empType,
              isActive: true,
              standardGrossSalary: parseFloat(empSalary) || 0
            };

            let updatedState = {
              ...state,
              employees: [...state.employees, newEmp]
            };

            updatedState = addAuditLog(updatedState, {
              entityType: 'EMPLOYEE',
              entityId: newEmp.id,
              action: 'CREATE',
              newValue: newEmp,
              details: `Censito nuovo collaboratore: ${newEmp.fullName} (${newEmp.role})`
            });

            updateState(updatedState);
            setShowAddEmp(false);
          }

          setEmpName('');
          setEmpTaxCode('');
          setEmpRole('');
          setEmpSalary('');
        };

        const handleDeleteEmployee = (empToDelete: Employee) => {
          if (currentRole !== 'amministrazione') {
            alert('Solo il ruolo Amministrazione può eliminare collaboratori.');
            return;
          }

          // Rimuovi dai collaboratori
          const updatedEmployees = state.employees.filter(emp => emp.id !== empToDelete.id);

          let updatedState = {
            ...state,
            employees: updatedEmployees
          };

          updatedState = addAuditLog(updatedState, {
            entityType: 'EMPLOYEE',
            entityId: empToDelete.id,
            action: 'DELETE',
            previousValue: empToDelete,
            details: `Eliminato collaboratore dall'organico: ${empToDelete.fullName} (${empToDelete.role})`
          });

          updateState(updatedState);
          setDeleteConfirmEmp(null);
        };

        // Calcolo controparti presenti nelle fatture ma non ancora censite nelle anagrafiche
        const existingEntityNames = new Set(
          state.entities.map(e => normalizeCounterpartName(e.name))
        );

        const uncensoredCounterparts = new Set<string>();
        state.invoices.forEach(inv => {
          if (inv.counterpartName) {
            const key = normalizeCounterpartName(inv.counterpartName);
            if (key && !existingEntityNames.has(key)) {
              uncensoredCounterparts.add(inv.counterpartName.trim());
            }
          }
        });

        // Conteggio fatture collegate per ogni controparte
        const invoiceCountByEntity = new Map<string, { active: number; passive: number }>();
        state.invoices.forEach(inv => {
          if (inv.counterpartName) {
            const key = normalizeCounterpartName(inv.counterpartName);
            const current = invoiceCountByEntity.get(key) || { active: 0, passive: 0 };
            if (inv.type === 'active') current.active++;
            else if (inv.type === 'passive') current.passive++;
            invoiceCountByEntity.set(key, current);
          }
        });

        const handleSyncFromInvoices = () => {
          if (currentRole !== 'amministrazione') {
            alert('Solo il ruolo Amministrazione può sincronizzare le anagrafiche.');
            return;
          }

          const syncResult = syncEntitiesFromInvoices(state.entities, state.invoices);
          
          if (syncResult.createdCount === 0 && syncResult.updatedCount === 0) {
            setSyncFeedback('Tutte le controparti delle fatture sono già censite correttamente in anagrafica!');
            setTimeout(() => setSyncFeedback(null), 5000);
            return;
          }

          let updatedState = {
            ...state,
            entities: syncResult.updatedEntities
          };

          updatedState = addAuditLog(updatedState, {
            entityType: 'ENTITY',
            entityId: 'SYNC_ALL',
            action: 'CREATE',
            newValue: syncResult.newEntities,
            details: `Sincronizzazione anagrafiche da fatture: create ${syncResult.createdCount} nuove anagrafiche (${syncResult.newEntities.map(e => e.name).join(', ')}), aggiornate ${syncResult.updatedCount}.`
          });

          updateState(updatedState);
          setSyncFeedback(`Sincronizzazione completata: create ${syncResult.createdCount} nuove anagrafiche e aggiornate ${syncResult.updatedCount}.`);
          setTimeout(() => setSyncFeedback(null), 6000);
        };

        const filteredEntities = state.entities.filter(ent => {
          if (!ent.isActive) return false;
          if (entityFilter === 'client') return ent.type === 'client' || ent.type === 'both';
          if (entityFilter === 'supplier') return ent.type === 'supplier' || ent.type === 'both';
          if (entityFilter === 'both') return ent.type === 'both';
          return true;
        });

        const clientsCount = state.entities.filter(e => e.isActive && (e.type === 'client' || e.type === 'both')).length;
        const suppliersCount = state.entities.filter(e => e.isActive && (e.type === 'supplier' || e.type === 'both')).length;

        return (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                  <Settings className="w-8 h-8 text-sky-600" />
                  Anagrafiche Clienti, Fornitori & Organico
                </h1>
                <p className="text-base text-slate-500 mt-1">
                  Gestione anagrafica centrale: sincronizzazione automatica da fatture attive e passive
                </p>
              </div>

              {currentRole === 'amministrazione' && (
                <div className="flex items-center gap-3">
                  {activeTab === 'entities' && (
                    <button
                      onClick={handleSyncFromInvoices}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-sm transition-all"
                      title="Estrae e censisce automaticamente tutti i fornitori (fatture passive) e clienti (fatture attive)"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Sincronizza da Fatture {uncensoredCounterparts.size > 0 && `(${uncensoredCounterparts.size} nuove)`}
                    </button>
                  )}
                  <button
                    onClick={() => activeTab === 'entities' ? setShowAddEntity(true) : handleOpenAddEmp()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl shadow-sm"
                  >
                    <Plus className="w-5 h-5" />
                    {activeTab === 'entities' ? 'Nuova Controparte' : 'Nuovo Collaboratore'}
                  </button>
                </div>
              )}
            </div>

            {/* Messaggio Feedback Sincronizzazione */}
            {syncFeedback && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-semibold flex items-center gap-2 shadow-sm animate-in fade-in duration-300">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{syncFeedback}</span>
              </div>
            )}

            {/* Banner Controparti da sincronizzare */}
            {uncensoredCounterparts.size > 0 && activeTab === 'entities' && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-amber-900 text-base flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-amber-700 animate-spin" />
                    Rilevate {uncensoredCounterparts.size} controparti non ancora censite nelle fatture
                  </h3>
                  <p className="text-sm text-amber-800 mt-0.5">
                    Nelle fatture attive e passive sono presenti controparti senza scheda anagrafica: {Array.from(uncensoredCounterparts).slice(0, 3).join(', ')}{uncensoredCounterparts.size > 3 ? '...' : ''}
                  </p>
                </div>
                {currentRole === 'amministrazione' && (
                  <button
                    onClick={handleSyncFromInvoices}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-sm whitespace-nowrap transition-all shadow-sm"
                  >
                    Censisci Tutte Ora
                  </button>
                )}
              </div>
            )}

            {/* Tab switch */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('entities')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-bold transition-all ${
                  activeTab === 'entities'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Building className="w-5 h-5" />
                Clienti & Fornitori ({state.entities.length})
              </button>
              <button
                onClick={() => setActiveTab('employees')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-bold transition-all ${
                  activeTab === 'employees'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Users className="w-5 h-5" />
                Organico, Soci & Dipendenti ({state.employees.length})
              </button>
            </div>

            {/* Elenco Controparti */}
            {activeTab === 'entities' && (
              <div className="space-y-4">
                {/* Filtro Tipologia Controparte */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setEntityFilter('all')}
                    className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                      entityFilter === 'all'
                        ? 'bg-slate-800 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Tutte ({state.entities.length})
                  </button>
                  <button
                    onClick={() => setEntityFilter('client')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                      entityFilter === 'client'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Clienti ({clientsCount})
                  </button>
                  <button
                    onClick={() => setEntityFilter('supplier')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                      entityFilter === 'supplier'
                        ? 'bg-rose-700 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    Fornitori ({suppliersCount})
                  </button>
                  <button
                    onClick={() => setEntityFilter('both')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                      entityFilter === 'both'
                        ? 'bg-indigo-700 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Clienti & Fornitori ({state.entities.filter(e => e.isActive && e.type === 'both').length})
                  </button>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-900">Anagrafica Clienti e Fornitori</h2>
                    <span className="text-sm font-semibold text-slate-500">
                      Visualizzati: {filteredEntities.length} di {state.entities.length}
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {filteredEntities.length === 0 ? (
                      <div className="p-12 text-center text-slate-500">
                        Nessuna anagrafica corrisponde al filtro selezionato.
                      </div>
                    ) : (
                      filteredEntities.map((ent) => {
                        const counts = invoiceCountByEntity.get(normalizeCounterpartName(ent.name)) || { active: 0, passive: 0 };
                        return (
                          <div key={ent.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-3">
                                <span className="text-lg font-bold text-slate-900">{ent.name}</span>
                                <span className={`text-xs uppercase font-bold px-2.5 py-0.5 rounded-full ${
                                  ent.type === 'client' 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : ent.type === 'supplier' 
                                    ? 'bg-rose-100 text-rose-800' 
                                    : 'bg-indigo-100 text-indigo-800'
                                }`}>
                                  {ent.type === 'client' ? 'Cliente' : ent.type === 'supplier' ? 'Fornitore' : 'Cliente & Fornitore'}
                                </span>
                              </div>
                              <p className="text-sm text-slate-500">
                                P.IVA / CF: <strong>{ent.vatNumber || ent.taxCode || 'N/A'}</strong> {ent.email && `• ${ent.email}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-500">
                              {(counts.active > 0 || counts.passive > 0) && (
                                <div className="flex items-center gap-2">
                                  {counts.active > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-semibold">
                                      <FileText className="w-3 h-3" /> {counts.active} emesse
                                    </span>
                                  )}
                                  {counts.passive > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-rose-50 text-rose-700 text-xs font-semibold">
                                      <FileText className="w-3 h-3" /> {counts.passive} ricevute
                                    </span>
                                  )}
                                </div>
                              )}
                              <div>
                                Termini pagamento: <strong>{ent.standardPaymentTermsDays || 30} giorni</strong>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Elenco Dipendenti e Soci */}
            {activeTab === 'employees' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                  <h2 className="text-xl font-bold text-slate-900">
                    Organico Aziendale ({state.employees.length} {state.employees.length === 1 ? 'Collaboratore' : 'Collaboratori'})
                  </h2>
                  <span className="text-sm font-semibold text-slate-500">
                    {state.employees.filter(e => e.contractType === 'subordinate').length} Subordinati • {state.employees.filter(e => e.contractType === 'cococo').length} Co.Co.Co.
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {state.employees.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                      Nessun collaboratore censito nell&apos;organico. Clicca su &quot;Nuovo Collaboratore&quot; per aggiungerne uno.
                    </div>
                  ) : (
                    state.employees.map((emp) => (
                      <div key={emp.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-slate-900">{emp.fullName}</span>
                            <span className={`text-xs uppercase font-bold px-2.5 py-0.5 rounded-full ${
                              emp.contractType === 'cococo' ? 'bg-indigo-100 text-indigo-800' : 'bg-sky-100 text-sky-800'
                            }`}>
                              {emp.contractType === 'cococo' ? 'Co.Co.Co.' : 'Dipendente Subordinato'}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500">
                            Mansione: <strong>{emp.role}</strong> • CF: <span className="font-mono">{emp.taxCode}</span>
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-6 self-end md:self-center">
                          <div className="text-right">
                            <div className="text-xs text-slate-500 font-medium">Retribuzione Mensile Tabellare:</div>
                            <div className="text-lg font-extrabold text-slate-900">
                              € {formatEuro(emp.standardGrossSalary)}
                            </div>
                          </div>

                          {currentRole === 'amministrazione' && (
                            <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
                              <button
                                onClick={() => handleOpenEditEmp(emp)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-sky-50 hover:text-sky-700 rounded-xl transition-all"
                                title="Modifica dati collaboratore"
                              >
                                <Pencil className="w-4 h-4" />
                                <span>Modifica</span>
                              </button>
                              <button
                                onClick={() => setDeleteConfirmEmp(emp)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 hover:text-rose-700 rounded-xl transition-all"
                                title="Elimina collaboratore"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span>Elimina</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Modal Aggiungi Controparte */}
            {showAddEntity && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl p-7 max-w-lg w-full shadow-2xl space-y-5">
                  <h3 className="text-xl font-bold text-slate-900">Censisci Nuova Controparte</h3>
                  <form onSubmit={handleCreateEntity} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Ragione Sociale / Nome</label>
                      <input
                        type="text"
                        required
                        value={entityName}
                        onChange={(e) => setEntityName(e.target.value)}
                        placeholder="es. Clima Service SRL"
                        className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Ruolo</label>
                        <select
                          value={entityType}
                          onChange={(e) => setEntityType(e.target.value as any)}
                          className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base font-medium"
                        >
                          <option value="client">Cliente</option>
                          <option value="supplier">Fornitore</option>
                          <option value="both">Entrambi</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Partita IVA / Codice Fiscale</label>
                        <input
                          type="text"
                          required
                          value={vat}
                          onChange={(e) => setVat(e.target.value)}
                          placeholder="01234567890"
                          className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Email / PEC</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="amministrazione@azienda.it"
                        className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-3">
                      <button
                        type="button"
                        onClick={() => setShowAddEntity(false)}
                        className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl"
                      >
                        Annulla
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl shadow-sm"
                      >
                        Salva Anagrafica
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal Aggiungi / Modifica Collaboratore */}
            {showAddEmp && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl p-7 max-w-lg w-full shadow-2xl space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="text-xl font-bold text-slate-900">
                      {editingEmployee ? 'Modifica Anagrafica Collaboratore' : 'Censisci Nuovo Collaboratore'}
                    </h3>
                    <button
                      onClick={() => {
                        setShowAddEmp(false);
                        setEditingEmployee(null);
                      }}
                      className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleSaveEmployee} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Nome Completo</label>
                      <input
                        type="text"
                        required
                        value={empName}
                        onChange={(e) => setEmpName(e.target.value)}
                        placeholder="Nome Cognome"
                        className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base focus:ring-2 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Codice Fiscale</label>
                        <input
                          type="text"
                          required
                          value={empTaxCode}
                          onChange={(e) => setEmpTaxCode(e.target.value.toUpperCase())}
                          placeholder="RSSMRA..."
                          className="w-full font-mono uppercase border border-slate-300 rounded-xl px-4 py-2 text-base focus:ring-2 focus:ring-sky-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Tipologia Inquadramento</label>
                        <select
                          value={empType}
                          onChange={(e) => setEmpType(e.target.value as any)}
                          className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
                        >
                          <option value="subordinate">Dipendente Subordinato</option>
                          <option value="cococo">Co.Co.Co. (Gestione Separata)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Mansione / Ruolo Aziendale</label>
                      <input
                        type="text"
                        required
                        value={empRole}
                        onChange={(e) => setEmpRole(e.target.value)}
                        placeholder="es. Tecnico Frigorista Specializzato"
                        className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base focus:ring-2 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Retribuzione Mensile Lorda Base (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={empSalary}
                        onChange={(e) => setEmpSalary(e.target.value)}
                        placeholder="2200.00"
                        className="w-full border border-slate-300 rounded-xl px-4 py-2 text-base focus:ring-2 focus:ring-sky-500 focus:outline-none"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Utilizzata come base per le proiezioni di costo aziendale e calcolo cedolini.
                      </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddEmp(false);
                          setEditingEmployee(null);
                        }}
                        className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition-all"
                      >
                        Annulla
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl shadow-sm transition-all"
                      >
                        {editingEmployee ? 'Salva Modifiche' : 'Salva Collaboratore'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal Conferma Eliminazione Collaboratore */}
            {deleteConfirmEmp && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl p-7 max-w-md w-full shadow-2xl space-y-4">
                  <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-slate-900">Eliminare Collaboratore?</h3>
                    <p className="text-sm text-slate-600 mt-2">
                      Sei sicuro di voler rimuovere <strong className="text-slate-800">{deleteConfirmEmp.fullName}</strong> ({deleteConfirmEmp.role}) dall&apos;organico aziendale?
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Questa operazione aggiorna l&apos;organico e viene tracciata nel registro delle verifiche/audit log.
                    </p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmEmp(null)}
                      className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-all"
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteEmployee(deleteConfirmEmp)}
                      className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-sm transition-all shadow-sm"
                    >
                      Elimina Definitivamente
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
