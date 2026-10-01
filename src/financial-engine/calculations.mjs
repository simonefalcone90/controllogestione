/**
 * Calcolo per Bonifico Parlante & Ritenuta d'acconto bancaria
 * Risolve la specificità: la ritenuta bancaria applicata alla fonte non è un insoluto.
 * - Aliquota di legge: 11% a decorrere dal 1° marzo 2024 (L. 213/2023, art. 1 comma 88)
 * - Base imponibile: applicazione dello scorporo convenzionale IVA al 22% (Circolare AdE 40/E/2010)
 */
export function calculateWithholdingSettlement(params) {
    const { 
        totalAmount, 
        isWithholdingApplicable, 
        withholdingRate = 0.11, 
        clientPaidAmount,
        applyVatDescorporation = true
    } = params;
    const clientPaid = clientPaidAmount !== undefined ? clientPaidAmount : totalAmount;
    if (!isWithholdingApplicable) {
        const outstanding = Math.max(0, totalAmount - clientPaid);
        return {
            totalAmount,
            clientPaid,
            withholdingAmount: 0,
            bankCreditedAmount: clientPaid,
            outstandingAmount: Number(outstanding.toFixed(2)),
            isFullySettled: outstanding <= 0.01,
            status: outstanding <= 0.01 ? 'paid' : clientPaid > 0 ? 'partially_paid' : 'issued'
        };
    }
    // Bonifico parlante: la banca applica la ritenuta (11%) sulla base imponibile presunta (scorporando IVA 22%)
    const calculationBase = applyVatDescorporation ? (clientPaid / 1.22) : clientPaid;
    const withholdingAmount = Number((calculationBase * withholdingRate).toFixed(2));
    const bankCreditedAmount = Number((clientPaid - withholdingAmount).toFixed(2));
    // Il cliente ha pagato clientPaid: la somma di quanto accreditato + la ritenuta d'acconto copre il debito del cliente!
    const effectiveCoverage = clientPaid;
    const outstandingAmount = Number(Math.max(0, totalAmount - effectiveCoverage).toFixed(2));
    return {
        totalAmount,
        clientPaid,
        withholdingAmount,
        bankCreditedAmount,
        outstandingAmount,
        isFullySettled: outstandingAmount <= 0.01,
        status: outstandingAmount <= 0.01 ? 'paid' : clientPaid > 0 ? 'partially_paid' : 'issued'
    };
}
/**
 * Calcolo dell'impatto di una rata finanziaria/noleggio:
 * - Mutuo: Quota Capitale (Stato Patrimoniale) vs Quota Interessi (Conto Economico C.17)
 * - Noleggio Operativo: Intero canone a Conto Economico B.8 (Godimento beni di terzi)
 * - Leasing Finanziario:
 *   - Metodo Patrimoniale OIC (default S.r.l.): l'intero canone è costo di esercizio a CE (B.8)
 *   - Metodo Finanziario IAS/IFRS: quota interessi a CE e quota capitale a debito
 */
export function calculateContractInstallmentImpact(contract) {
    let cashOutflow = 0;
    let incomeStatementCost = 0; // Conto Economico
    let debtReduction = 0; // Stato Patrimoniale
    if (contract.type === 'loan') {
        cashOutflow = contract.installmentAmount;
        incomeStatementCost = contract.interestPortion;
        debtReduction = contract.principalPortion;
    }
    else if (contract.type === 'operating_rental') {
        // Nel noleggio operativo l'intero canone è costo di esercizio
        cashOutflow = contract.installmentAmount;
        incomeStatementCost = contract.installmentAmount;
        debtReduction = 0;
    }
    else {
        // Leasing
        const method = contract.accountingMethod || 'patrimonial_oic';
        cashOutflow = contract.installmentAmount;
        if (method === 'patrimonial_oic') {
            // Metodo Patrimoniale OIC: l'intero canone periodico è costo di esercizio (Voce B.8)
            incomeStatementCost = contract.installmentAmount;
            debtReduction = contract.principalPortion;
        } else {
            // Metodo Finanziario
            incomeStatementCost = contract.interestPortion;
            debtReduction = contract.principalPortion;
        }
    }
    return {
        cashOutflow,
        incomeStatementCost,
        debtReduction
    };
}
/**
 * Calcolo Liquidità Disponibile:
 * - Somma dei saldi dei soli conti ATTIVI
 * - I conti chiusi/disattivati conservano lo storico ma sono esclusi dalla liquidità attuale.
 */
export function calculateCurrentLiquidity(bankAccounts) {
    const activeAccounts = bankAccounts.filter(acc => acc.isActive);
    const totalBalance = activeAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0);
    const totalCreditLimit = activeAccounts.reduce((sum, acc) => sum + (acc.creditLimit || 0), 0);
    const totalAvailableLiquidity = totalBalance + totalCreditLimit;
    // Trova la data più recente tra i conti attivi
    let latestUpdate = '';
    activeAccounts.forEach(acc => {
        if (!latestUpdate || (acc.lastUpdated && acc.lastUpdated > latestUpdate)) {
            latestUpdate = acc.lastUpdated;
        }
    });
    return {
        activeAccountsCount: activeAccounts.length,
        totalBalance: Number(totalBalance.toFixed(2)),
        totalCreditLimit: Number(totalCreditLimit.toFixed(2)),
        totalAvailableLiquidity: Number(totalAvailableLiquidity.toFixed(2)),
        latestUpdateDate: latestUpdate || new Date().toISOString().split('T')[0],
        accounts: activeAccounts
    };
}
/**
 * Calcolo Controllo Economico e Margini a norma OIC 12 / Codice Civile:
 * - Valore della Produzione (Ricavi + Variazione SAL Cantieri A.3)
 * - Consumi effettivi di materie prime (Acquisti +/- Variazione Rimanenze B.11)
 * - Valore Aggiunto Industriale e Margine di Contribuzione
 * - Costo del Personale Complessivo (B.9)
 * - Canoni di noleggio/leasing (B.8)
 * - EBITDA (Margine Operativo Lordo)
 * - Ammortamenti beni materiali/immateriali (B.10.a/b) e Svalutazione crediti (B.10.d)
 * - EBIT (Risultato Operativo Netto)
 * - Oneri Finanziari (C.17)
 * - EBT (Risultato prima delle imposte)
 */
export function calculateManagementIncomeStatement(params) {
    const { month, invoices, payrollRecords, contracts, otherCosts = [], adjustments = {} } = params;
    const periodType = params.periodType || 'month';
    const periodValue = params.periodValue || month || '2026-09';

    const matchesPeriod = (itemMonth) => {
        if (!itemMonth) return false;
        if (periodType === 'year') {
            return itemMonth.startsWith(periodValue);
        }
        if (periodType === 'quarter') {
            const [year, q] = periodValue.split('-Q');
            if (!itemMonth.startsWith(year)) return false;
            const m = parseInt(itemMonth.substring(5, 7), 10);
            if (q === '1') return m >= 1 && m <= 3;
            if (q === '2') return m >= 4 && m <= 6;
            if (q === '3') return m >= 7 && m <= 9;
            if (q === '4') return m >= 10 && m <= 12;
            return false;
        }
        return itemMonth === periodValue;
    };

    const monthsInPeriodCount = periodType === 'year' ? 12 : periodType === 'quarter' ? 3 : 1;

    // 1. Ricavi di competenza (Fatture attive con competenza economica nel periodo)
    const activeInvoices = invoices.filter(inv => inv.isActive && inv.type === 'active' && matchesPeriod(inv.economicCompetenceMonth || inv.issueDate?.substring(0, 7)));
    const revenues = activeInvoices.reduce((sum, inv) => sum + inv.taxableAmount, 0);

    // Rettifica Variazione Lavori in Corso su Ordinazione (Voce A.3 C.C. - SAL Cantieri non ancora fatturati)
    const wipClosing = adjustments.workInProgressClosing || 0;
    const wipOpening = adjustments.workInProgressOpening || 0;
    const workInProgressVariation = wipClosing - wipOpening;
    const totalProductionValue = revenues + workInProgressVariation;

    // 2. Costi di acquisto / fornitori di competenza (Fatture passive)
    const passiveInvoices = invoices.filter(inv => inv.isActive && inv.type === 'passive' && matchesPeriod(inv.economicCompetenceMonth || inv.issueDate?.substring(0, 7)));
    const materialPurchases = passiveInvoices.reduce((sum, inv) => sum + inv.taxableAmount, 0);

    // Rettifica Variazione Rimanenze Materie Prime e Merci (Voce B.11 C.C.)
    const invClosing = adjustments.inventoryClosing || 0;
    const invOpening = adjustments.inventoryOpening || 0;
    const inventoryVariation = invClosing - invOpening;
    const adjustedMaterialCosts = Math.max(0, materialPurchases - inventoryVariation);

    // 3. Costo del Personale di competenza
    const periodPayroll = payrollRecords.filter(p => matchesPeriod(p.month));
    let totalPersonnelCost = 0;
    let isPersonnelCostComplete = true;
    let missingPersonnelDetails = [];
    if (periodPayroll.length === 0) {
        isPersonnelCostComplete = false;
        missingPersonnelDetails.push(`Nessun cedolino inserito per il periodo ${periodValue}`);
    }
    else {
        periodPayroll.forEach(p => {
            if (!p.isCompanyCostConfirmed) {
                isPersonnelCostComplete = false;
                missingPersonnelDetails.push(`Cedolino per ${p.employeeName}: costo aziendale non confermato (oneri mancanti o stimati)`);
                totalPersonnelCost += (p.totalCompanyCost || (p.grossSalary * 1.35));
            }
            else {
                totalPersonnelCost += p.totalCompanyCost;
            }
        });
    }

    // 4. Oneri finanziari e canoni di competenza dai contratti finanziari
    let financialCosts = 0;
    let rentalCosts = 0;
    contracts.filter(c => c.isActive).forEach(c => {
        const impact = calculateContractInstallmentImpact(c);
        if (c.type === 'operating_rental' || (c.type === 'leasing' && (c.accountingMethod || 'patrimonial_oic') === 'patrimonial_oic')) {
            rentalCosts += (impact.incomeStatementCost * monthsInPeriodCount);
        }
        else {
            financialCosts += (impact.incomeStatementCost * monthsInPeriodCount);
        }
    });

    // 5. Altre spese
    const otherCostsTotal = otherCosts.reduce((sum, c) => sum + c.amount, 0);

    // Totale Costi Operativi (per EBITDA)
    const operatingCosts = adjustedMaterialCosts + totalPersonnelCost + rentalCosts + otherCostsTotal;
    const grossMargin = totalProductionValue - adjustedMaterialCosts;
    const ebitda = totalProductionValue - operatingCosts;

    // 6. Ammortamenti e Accantonamenti
    const depTangible = adjustments.depreciationTangible || 0;
    const depIntangible = adjustments.depreciationIntangible || 0;
    const depreciationTotal = depTangible + depIntangible;
    const badDebtProvision = adjustments.badDebtProvision || 0;

    const ebit = ebitda - depreciationTotal - badDebtProvision;
    const ebt = ebit - financialCosts;

    return {
        month: periodValue,
        periodType,
        periodValue,
        revenues: Number(revenues.toFixed(2)),
        workInProgressVariation: Number(workInProgressVariation.toFixed(2)),
        totalProductionValue: Number(totalProductionValue.toFixed(2)),
        materialPurchases: Number(materialPurchases.toFixed(2)),
        inventoryVariation: Number(inventoryVariation.toFixed(2)),
        adjustedMaterialCosts: Number(adjustedMaterialCosts.toFixed(2)),
        materialAndServiceCosts: Number(adjustedMaterialCosts.toFixed(2)),
        grossMargin: Number(grossMargin.toFixed(2)),
        grossMarginPercent: totalProductionValue > 0 ? Number(((grossMargin / totalProductionValue) * 100).toFixed(1)) : 0,
        personnelCost: Number(totalPersonnelCost.toFixed(2)),
        isPersonnelCostComplete,
        missingPersonnelDetails,
        rentalCosts: Number(rentalCosts.toFixed(2)),
        otherCosts: Number(otherCostsTotal.toFixed(2)),
        ebitda: Number(ebitda.toFixed(2)),
        ebitdaPercent: totalProductionValue > 0 ? Number(((ebitda / totalProductionValue) * 100).toFixed(1)) : 0,
        depreciationTotal: Number(depreciationTotal.toFixed(2)),
        badDebtProvision: Number(badDebtProvision.toFixed(2)),
        ebit: Number(ebit.toFixed(2)),
        ebitPercent: totalProductionValue > 0 ? Number(((ebit / totalProductionValue) * 100).toFixed(1)) : 0,
        financialCosts: Number(financialCosts.toFixed(2)),
        ebt: Number(ebt.toFixed(2)),
        hasDataIncompleteness: !isPersonnelCostComplete || activeInvoices.length === 0,
        activeInvoicesCount: activeInvoices.length,
        passiveInvoicesCount: passiveInvoices.length
    };
}

/**
 * Calcolo della Previsione di Cassa a 30, 60, 90 giorni:
 * Ricostruibile voce per voce partendo dal saldo disponibile.
 */
export function calculateCashFlowProjection(params) {
    const { currentLiquidity, todayDate, forecastItems } = params;
    const today = new Date(todayDate);
    // Funzione per determinare i giorni di distanza
    const getDaysDiff = (targetDateStr) => {
        const target = new Date(targetDateStr);
        const diffTime = target.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };
    const p30Items = [];
    const p60Items = [];
    const p90Items = [];
    const beyond90Items = [];
    forecastItems.forEach(item => {
        const diff = getDaysDiff(item.date);
        if (diff <= 30) {
            p30Items.push({ ...item, horizonDays: 30 });
        }
        else if (diff <= 60) {
            p60Items.push({ ...item, horizonDays: 60 });
        }
        else if (diff <= 90) {
            p90Items.push({ ...item, horizonDays: 90 });
        }
        else {
            beyond90Items.push({ ...item, horizonDays: 120 });
        }
    });
    const sumFlows = (items) => {
        let inflows = 0;
        let outflows = 0;
        items.forEach(it => {
            const amount = it.weightedAmount;
            if (it.direction === 'inflow') {
                inflows += amount;
            }
            else {
                outflows += amount;
            }
        });
        return {
            inflows: Number(inflows.toFixed(2)),
            outflows: Number(outflows.toFixed(2)),
            net: Number((inflows - outflows).toFixed(2))
        };
    };
    const flow30 = sumFlows(p30Items);
    const balance30 = Number((currentLiquidity + flow30.net).toFixed(2));
    const flow60 = sumFlows(p60Items);
    const balance60 = Number((balance30 + flow60.net).toFixed(2));
    const flow90 = sumFlows(p90Items);
    const balance90 = Number((balance60 + flow90.net).toFixed(2));
    const hasNegativeBalance = balance30 < 0 || balance60 < 0 || balance90 < 0;
    return {
        initialLiquidity: currentLiquidity,
        projections: {
            days30: {
                horizonDays: 30,
                projectedBalance: balance30,
                inflows: flow30.inflows,
                outflows: flow30.outflows,
                netFlow: flow30.net,
                itemsCount: p30Items.length,
                items: p30Items,
                isNegative: balance30 < 0
            },
            days60: {
                horizonDays: 60,
                projectedBalance: balance60,
                inflows: flow60.inflows,
                outflows: flow60.outflows,
                netFlow: flow60.net,
                itemsCount: p60Items.length,
                items: p60Items,
                isNegative: balance60 < 0
            },
            days90: {
                horizonDays: 90,
                projectedBalance: balance90,
                inflows: flow90.inflows,
                outflows: flow90.outflows,
                netFlow: flow90.net,
                itemsCount: p90Items.length,
                items: p90Items,
                isNegative: balance90 < 0
            }
        },
        hasNegativeBalance
    };
}
/**
 * Deduplicazione importazioni estratti conto o fatture:
 * Crea hash univoco da data, importo, controparte/causale
 */
export function generateTransactionHash(bankAccountId, date, amount, description) {
    const normDesc = description.trim().toLowerCase().replace(/\s+/g, ' ');
    return `${bankAccountId}_${date}_${amount.toFixed(2)}_${normDesc}`;
}

/**
 * Normalizza il nome di una controparte per confronti case-insensitive
 */
export function normalizeCounterpartName(name) {
    return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Sincronizza e genera anagrafiche Fornitori (dalle fatture passive)
 * e anagrafiche Clienti (dalle fatture attive).
 */
export function syncEntitiesFromInvoices(currentEntities, invoices) {
    const entityMap = new Map();
    
    currentEntities.forEach(ent => {
        const key = normalizeCounterpartName(ent.name);
        if (key) {
            entityMap.set(key, { ...ent });
        }
    });

    const detectedMap = new Map();

    invoices.forEach(inv => {
        if (!inv.counterpartName) return;
        const cleanName = inv.counterpartName.trim();
        const key = normalizeCounterpartName(cleanName);
        if (!key) return;

        const existing = detectedMap.get(key) || {
            originalName: cleanName,
            isClient: false,
            isSupplier: false
        };

        if (inv.type === 'active') {
            existing.isClient = true;
        } else if (inv.type === 'passive') {
            existing.isSupplier = true;
        }

        if (cleanName.length > existing.originalName.length) {
            existing.originalName = cleanName;
        }

        detectedMap.set(key, existing);
    });

    let createdCount = 0;
    let updatedCount = 0;
    const newEntities = [];

    detectedMap.forEach((detected, key) => {
        const existing = entityMap.get(key);

        const targetType = detected.isClient && detected.isSupplier
            ? 'both'
            : detected.isClient
            ? 'client'
            : 'supplier';

        if (existing) {
            let needsUpdate = false;
            let newType = existing.type;

            if (existing.type !== 'both') {
                if (existing.type === 'client' && detected.isSupplier) {
                    newType = 'both';
                    needsUpdate = true;
                } else if (existing.type === 'supplier' && detected.isClient) {
                    newType = 'both';
                    needsUpdate = true;
                } else if (targetType === 'both') {
                    newType = 'both';
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                existing.type = newType;
                entityMap.set(key, existing);
                updatedCount++;
            }
        } else {
            const newEntity = {
                id: `ent-${targetType === 'supplier' ? 'for' : targetType === 'client' ? 'cli' : 'mix'}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                name: detected.originalName,
                type: targetType,
                isActive: true,
                standardPaymentTermsDays: targetType === 'client' ? 60 : 30
            };

            entityMap.set(key, newEntity);
            newEntities.push(newEntity);
            createdCount++;
        }
    });

    return {
        updatedEntities: Array.from(entityMap.values()),
        createdCount,
        updatedCount,
        newEntities
    };
}

/**
 * Calcolo della Posizione e Liquidazione IVA Periodica:
 * - IVA a Debito (Vendite / Fatture Attive)
 * - IVA a Credito (Acquisti / Fatture Passive)
 * - Saldo Netto IVA (Debito verso Erario se > 0, Credito se < 0)
 * - Ripartizione mensile coerente con il cruscotto Aruba
 */
export function calculateVatPosition(params) {
    const { invoices, periodType, periodValue } = params;

    const matchesPeriod = (itemMonth) => {
        if (!itemMonth) return false;
        if (periodType === 'year') {
            return itemMonth.startsWith(periodValue);
        }
        if (periodType === 'quarter') {
            const [year, quarter] = periodValue.split('-');
            const monthNum = parseInt(itemMonth.substring(5, 7), 10);
            if (!itemMonth.startsWith(year)) return false;
            if (quarter === 'Q1') return monthNum >= 1 && monthNum <= 3;
            if (quarter === 'Q2') return monthNum >= 4 && monthNum <= 6;
            if (quarter === 'Q3') return monthNum >= 7 && monthNum <= 9;
            if (quarter === 'Q4') return monthNum >= 10 && monthNum <= 12;
            return false;
        }
        return itemMonth === periodValue;
    };

    const periodInvoices = invoices.filter(inv => inv.isActive && matchesPeriod(inv.economicCompetenceMonth || inv.issueDate?.substring(0, 7)));

    let activeTaxable = 0;
    let activeVat = 0;
    let activeTotal = 0;
    let passiveTaxable = 0;
    let passiveVat = 0;
    let passiveTotal = 0;

    periodInvoices.forEach(inv => {
        if (inv.type === 'active') {
            activeTaxable += inv.taxableAmount;
            activeVat += inv.vatAmount;
            activeTotal += inv.totalAmount;
        } else {
            passiveTaxable += inv.taxableAmount;
            passiveVat += inv.vatAmount;
            passiveTotal += inv.totalAmount;
        }
    });

    const netVatBalance = activeVat - passiveVat;

    // Monthly breakdown per l'anno di riferimento (es. 2026-01 .. 2026-12)
    const targetYear = periodType === 'year' ? periodValue : periodValue.substring(0, 4);
    const monthLabels = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const monthlyBreakdown = [];

    for (let m = 1; m <= 12; m++) {
        const mStr = `${targetYear}-${String(m).padStart(2, '0')}`;
        const mInvs = invoices.filter(inv => inv.isActive && (inv.economicCompetenceMonth === mStr || inv.issueDate?.substring(0, 7) === mStr));

        let aTax = 0, aVat = 0, pTax = 0, pVat = 0;
        mInvs.forEach(inv => {
            if (inv.type === 'active') {
                aTax += inv.taxableAmount;
                aVat += inv.vatAmount;
            } else {
                pTax += inv.taxableAmount;
                pVat += inv.vatAmount;
            }
        });

        monthlyBreakdown.push({
            month: mStr,
            label: monthLabels[m - 1],
            activeTaxable: Number(aTax.toFixed(2)),
            activeVat: Number(aVat.toFixed(2)),
            passiveTaxable: Number(pTax.toFixed(2)),
            passiveVat: Number(pVat.toFixed(2)),
            netBalance: Number((aVat - pVat).toFixed(2))
        });
    }

    return {
        periodType,
        periodValue,
        activeTaxable: Number(activeTaxable.toFixed(2)),
        activeVat: Number(activeVat.toFixed(2)),
        activeTotal: Number(activeTotal.toFixed(2)),
        passiveTaxable: Number(passiveTaxable.toFixed(2)),
        passiveVat: Number(passiveVat.toFixed(2)),
        passiveTotal: Number(passiveTotal.toFixed(2)),
        netVatBalance: Number(netVatBalance.toFixed(2)),
        isDebtor: netVatBalance > 0,
        monthlyBreakdown
    };
}

/**
 * Trova suggerimenti di riconciliazione tra movimenti bancari e fatture.
 */
export function findBankReconciliationMatches(params) {
  const { transactions, invoices } = params;
  const suggestions = [];

  const unreconciledTxs = transactions.filter(t => !t.reconciled);
  const openInvoices = invoices.filter(i => i.isActive && i.status !== 'paid' && (i.outstandingAmount > 0 || i.status === 'issued' || i.status === 'partially_paid'));

  for (const tx of unreconciledTxs) {
    const isCredit = tx.amount > 0;
    const absTxAmount = Math.abs(tx.amount);
    const descLower = (tx.description || '').toLowerCase();
    const counterpartLower = (tx.counterpart || '').toLowerCase();

    const targetInvoices = openInvoices.filter(inv => isCredit ? inv.type === 'active' : inv.type === 'passive');

    let bestMatch = null;

    for (const inv of targetInvoices) {
      const invNum = (inv.number || '').trim().toLowerCase();
      const invCounterpart = (inv.counterpartName || '').trim().toLowerCase();

      const numClean = invNum.replace(/[^\w\d]/g, '');
      const hasNumberMatch = numClean.length >= 2 && descLower.replace(/[^\w\d]/g, '').includes(numClean);
      
      const counterpartWords = invCounterpart.split(/\s+/).filter(w => w.length > 2 && !['srl', 'spa', 'snc', 'sas', 's.r.l.', 's.p.a.', 'di', 'del', 'della', 'dei', 'e'].includes(w));
      const hasCounterpartMatch = counterpartWords.length > 0 && counterpartWords.some(w => descLower.includes(w) || counterpartLower.includes(w));

      // Caso 1: Accredito con Bonifico Parlante
      if (isCredit) {
        const s11 = calculateWithholdingSettlement({
          totalAmount: inv.outstandingAmount,
          isWithholdingApplicable: true,
          withholdingRate: 0.11,
          applyVatDescorporation: true
        });
        const s8 = calculateWithholdingSettlement({
          totalAmount: inv.outstandingAmount,
          isWithholdingApplicable: true,
          withholdingRate: 0.08,
          applyVatDescorporation: true
        });

        const isMatch11 = Math.abs(tx.amount - s11.bankCreditedAmount) < 0.05;
        const isMatch8 = Math.abs(tx.amount - s8.bankCreditedAmount) < 0.05;

        if (isMatch11 || isMatch8) {
          const matchedSettlement = isMatch11 ? s11 : s8;
          const score = (hasNumberMatch || hasCounterpartMatch) ? 1.0 : 0.95;
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = {
              invoice: inv,
              score,
              reason: 'withholding_parlante',
              label: 'alta',
              settlement: {
                totalPaid: inv.outstandingAmount,
                withholdingAmount: matchedSettlement.withholdingAmount,
                bankCreditedAmount: tx.amount,
                outstandingAfter: 0
              }
            };
          }
          continue;
        }
      }

      // Caso 2: Match Esatto Importo
      const isExactOutstanding = Math.abs(absTxAmount - inv.outstandingAmount) < 0.02;
      const isExactTotal = Math.abs(absTxAmount - inv.totalAmount) < 0.02;

      if (isExactOutstanding || isExactTotal) {
        let score = 0.85;
        let label = 'media';
        if (hasNumberMatch && hasCounterpartMatch) {
          score = 1.0;
          label = 'alta';
        } else if (hasNumberMatch || hasCounterpartMatch) {
          score = 0.95;
          label = 'alta';
        }

        if (!bestMatch || score > bestMatch.score) {
          bestMatch = {
            invoice: inv,
            score,
            reason: (hasNumberMatch || hasCounterpartMatch) ? 'counterpart_and_amount' : 'exact_amount',
            label,
            settlement: {
              totalPaid: absTxAmount,
              withholdingAmount: 0,
              bankCreditedAmount: absTxAmount,
              outstandingAfter: Math.max(0, Number((inv.outstandingAmount - absTxAmount).toFixed(2)))
            }
          };
        }
        continue;
      }

      // Caso 3: Match per Numero Fattura o Controparte (pagamento parziale)
      if (hasNumberMatch || hasCounterpartMatch) {
        if (absTxAmount < inv.outstandingAmount) {
          const score = hasNumberMatch ? 0.75 : 0.65;
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = {
              invoice: inv,
              score,
              reason: 'partial_match',
              label: 'media',
              settlement: {
                totalPaid: absTxAmount,
                withholdingAmount: 0,
                bankCreditedAmount: absTxAmount,
                outstandingAfter: Number((inv.outstandingAmount - absTxAmount).toFixed(2))
              }
            };
          }
        }
      }
    }

    if (bestMatch) {
      suggestions.push({
        transaction: tx,
        matchedInvoice: bestMatch.invoice,
        confidenceScore: bestMatch.score,
        matchReason: bestMatch.reason,
        confidenceLabel: bestMatch.label,
        suggestedSettlement: bestMatch.settlement
      });
    }
  }

  return suggestions.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

/**
 * Esegue la riconciliazione tra una fattura e un movimento bancario.
 */
export function reconcileInvoiceWithTransaction(params) {
  const { invoice, transaction, options } = params;
  const isCredit = transaction.amount > 0;
  const absTxAmount = options?.customAmount !== undefined ? options.customAmount : Math.abs(transaction.amount);

  let updatedInvoice;

  if (invoice.type === 'active' && options?.isWithholding) {
    const rate = options.withholdingRate || 0.11;
    const factor = 1 - (rate / 1.22);
    const grossClientPaid = Number((absTxAmount / factor).toFixed(2));
    const withholding = Number((grossClientPaid - absTxAmount).toFixed(2));
    const effectiveSettlement = Math.min(invoice.outstandingAmount, grossClientPaid);
    const newOutstanding = Math.max(0, Number((invoice.outstandingAmount - effectiveSettlement).toFixed(2)));

    updatedInvoice = {
      ...invoice,
      status: newOutstanding <= 0.01 ? 'paid' : 'partially_paid',
      isWithholdingApplicable: true,
      withholdingRate: rate,
      withholdingAmount: (invoice.withholdingAmount || 0) + withholding,
      amountCreditedByBank: (invoice.amountCreditedByBank || 0) + absTxAmount,
      amountPaidByClient: (invoice.amountPaidByClient || 0) + grossClientPaid,
      outstandingAmount: newOutstanding,
      bankTransactionId: transaction.id,
      reconciledDate: transaction.date
    };
  } else {
    const paid = Math.min(invoice.outstandingAmount, absTxAmount);
    const newOutstanding = Math.max(0, Number((invoice.outstandingAmount - paid).toFixed(2)));

    updatedInvoice = {
      ...invoice,
      status: newOutstanding <= 0.01 ? 'paid' : 'partially_paid',
      amountCreditedByBank: invoice.type === 'active' ? (invoice.amountCreditedByBank || 0) + paid : undefined,
      amountPaidByClient: invoice.type === 'active' ? (invoice.amountPaidByClient || 0) + paid : undefined,
      outstandingAmount: newOutstanding,
      bankTransactionId: transaction.id,
      reconciledDate: transaction.date
    };
  }

  const updatedTransaction = {
    ...transaction,
    reconciled: true,
    reconciledWithId: invoice.id,
    reconciledType: 'invoice',
    reconciledAmount: absTxAmount,
    reconciledDate: transaction.date,
    reconciledCounterpart: invoice.counterpartName
  };

  return { updatedInvoice, updatedTransaction };
}

/**
 * Annulla la riconciliazione tra una fattura e un movimento bancario (Undo/Scollega).
 */
export function unreconcileInvoiceTransaction(params) {
  const { invoice, transaction } = params;
  const absTxAmount = transaction.reconciledAmount || Math.abs(transaction.amount);

  let updatedInvoice;

  if (invoice.isWithholdingApplicable && invoice.withholdingAmount) {
    updatedInvoice = {
      ...invoice,
      status: 'issued',
      outstandingAmount: invoice.totalAmount,
      amountCreditedByBank: 0,
      amountPaidByClient: 0,
      withholdingAmount: 0,
      bankTransactionId: undefined,
      reconciledDate: undefined
    };
  } else {
    const restoredOutstanding = Math.min(invoice.totalAmount, Number((invoice.outstandingAmount + absTxAmount).toFixed(2)));
    updatedInvoice = {
      ...invoice,
      status: restoredOutstanding >= invoice.totalAmount - 0.01 ? 'issued' : 'partially_paid',
      outstandingAmount: restoredOutstanding,
      amountCreditedByBank: invoice.type === 'active' ? Math.max(0, (invoice.amountCreditedByBank || 0) - absTxAmount) : undefined,
      amountPaidByClient: invoice.type === 'active' ? Math.max(0, (invoice.amountPaidByClient || 0) - absTxAmount) : undefined,
      bankTransactionId: undefined,
      reconciledDate: undefined
    };
  }

  const updatedTransaction = {
    ...transaction,
    reconciled: false,
    reconciledWithId: undefined,
    reconciledType: undefined,
    reconciledAmount: undefined,
    reconciledDate: undefined,
    reconciledCounterpart: undefined
  };

  return { updatedInvoice, updatedTransaction };
}

/**
 * Verifica la quadratura matematica di un cedolino paga e dei costi aziendali.
 */
export function validatePayrollCalculations(record) {
  const expectedNet = Number((record.grossSalary - record.employeeContributions - record.employeeTaxWithheld).toFixed(2));
  const netDifference = Number(Math.abs(expectedNet - record.netPaid).toFixed(2));

  const expectedTotalCost = Number((record.grossSalary + record.employerContributions + record.severancePayAccrual + record.otherCompanyCosts).toFixed(2));
  const costDifference = Number(Math.abs(expectedTotalCost - record.totalCompanyCost).toFixed(2));

  const errors = [];
  const warnings = [];

  if (netDifference > 0.05) {
    errors.push(`Discrepanza Netto: Lordo (${record.grossSalary} €) - Trattenute (${(record.employeeContributions + record.employeeTaxWithheld).toFixed(2)} €) = ${expectedNet} €, ma il netto in busta è ${record.netPaid} € (differenza di ${netDifference} €).`);
  }

  if (record.isCompanyCostConfirmed && costDifference > 0.05) {
    warnings.push(`Verifica Costo Azienda: Somma componenti = ${expectedTotalCost} €, registrato ${record.totalCompanyCost} €.`);
  }

  if (!record.isCompanyCostConfirmed) {
    warnings.push('Costo Incompleto: Mancano prospetti con oneri c/azienda e rateo TFR confermati.');
  }

  return {
    isValid: errors.length === 0,
    expectedNet,
    netDifference,
    expectedTotalCost,
    costDifference,
    errors,
    warnings
  };
}

/**
 * Allinea le uscite dell'estratto conto con i cedolini paga.
 */
export function matchBankWithPayroll(params) {
  const { transactions, payrollRecords, month } = params;
  const monthRecords = payrollRecords.filter(p => p.month === month);
  const unreconciledRecords = monthRecords.filter(p => p.status !== 'paid' && !p.bankTransactionId);
  const totalNetToPay = Number(unreconciledRecords.reduce((sum, r) => sum + r.netPaid, 0).toFixed(2));

  const candidateTxs = transactions.filter(t => !t.reconciled && t.amount < 0);
  const suggestedMatches = [];

  for (const tx of candidateTxs) {
    const absAmount = Math.abs(tx.amount);
    const desc = (tx.description || '').toLowerCase();

    // 1. Match cumulativo stipendi
    const isCumulativeAmount = Math.abs(absAmount - totalNetToPay) < 0.05;
    const isSalaryCausal = desc.includes('stipend') || desc.includes('emolument') || desc.includes('retribuz') || desc.includes('salari');

    if (isCumulativeAmount || (isSalaryCausal && Math.abs(absAmount - totalNetToPay) < totalNetToPay * 0.1)) {
      suggestedMatches.push({
        transaction: tx,
        type: 'cumulative_salaries',
        description: `Bonifico cumulativo stipendi ${month} (€ ${absAmount.toFixed(2)} su € ${totalNetToPay.toFixed(2)} attesi)`
      });
      continue;
    }

    // 2. Match singolo dipendente
    for (const rec of unreconciledRecords) {
      const isExactNet = Math.abs(absAmount - rec.netPaid) < 0.02;
      const empWords = rec.employeeName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const hasNameInCausal = empWords.some(w => desc.includes(w));

      if (isExactNet || (hasNameInCausal && Math.abs(absAmount - rec.netPaid) < 1.0)) {
        suggestedMatches.push({
          record: rec,
          transaction: tx,
          type: 'single_employee',
          description: `Stipendio ${rec.employeeName} (${month}): € ${rec.netPaid.toFixed(2)}`
        });
      }
    }

    // 3. Match F24 contributi e ritenute
    const totalTaxAndContrib = Number(monthRecords.reduce((s, r) => s + r.employeeTaxWithheld + r.employeeContributions + r.employerContributions, 0).toFixed(2));
    if (desc.includes('f24') && (Math.abs(absAmount - totalTaxAndContrib) < 5.0 || desc.includes('ritenut') || desc.includes('inps'))) {
      suggestedMatches.push({
        transaction: tx,
        type: 'f24_taxes',
        description: `Delega F24 tributi e contributi del personale (${month}): € ${absAmount.toFixed(2)}`
      });
    }
  }

  return {
    unreconciledRecords,
    totalNetToPay,
    candidateTransactions: candidateTxs,
    suggestedMatches
  };
}

