// Funções relacionadas a exportação e merge de estado
// para futura sincronização com Google Drive (ou outro backend).

/**
 * Garante que o estado tenha o shape mínimo esperado.
 */
export function normalizeState(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      cards: [],
      expenses: [],
      incomes: [],
      paidInvoices: [],
    };
  }

  return {
    cards: Array.isArray(raw.cards) ? raw.cards : [],
    expenses: Array.isArray(raw.expenses) ? raw.expenses : [],
    incomes: Array.isArray(raw.incomes) ? raw.incomes : [],
    paidInvoices: Array.isArray(raw.paidInvoices) ? raw.paidInvoices : [],
  };
}

/**
 * Exporta o estado financeiro atual para um objeto pronto para ser
 * serializado em JSON e salvo no Google Drive.
 */
export function exportState(financeState) {
  const normalized = normalizeState(financeState);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    cards: normalized.cards,
    expenses: normalized.expenses,
    incomes: normalized.incomes,
    paidInvoices: normalized.paidInvoices,
  };
}

/**
 * Faz o merge de dois estados: um remoto (Drive) e um local (browser).
 *
 * Regras:
 * - Cada item deve ter um `id` único.
 * - Se o mesmo `id` existir nos dois lados, usamos o que tiver `updatedAt` mais recente.
 * - Se não tiver `updatedAt`, consideramos o remoto como fonte principal
 *   (para evitar sobrescrever dados já sincronizados).
 */
export function mergeRemoteAndLocal(remoteRaw, localRaw) {
  const remote = normalizeState(remoteRaw);
  const local = normalizeState(localRaw);

  function mergeArray(remoteArr, localArr) {
    const byId = new Map();

    // Começa pelos remotos
    for (const item of remoteArr) {
      if (!item || !item.id) continue;
      byId.set(item.id, item);
    }

    // Junta com os locais
    for (const localItem of localArr) {
      if (!localItem || !localItem.id) continue;
      const existing = byId.get(localItem.id);

      if (!existing) {
        // Item que só existe localmente → adiciona
        byId.set(localItem.id, localItem);
        continue;
      }

      // Se existe nos dois lados, decide pelo updatedAt
      const localUpdated = localItem.updatedAt ? Date.parse(localItem.updatedAt) : null;
      const remoteUpdated = existing.updatedAt ? Date.parse(existing.updatedAt) : null;

      if (localUpdated && remoteUpdated) {
        byId.set(localItem.id, localUpdated > remoteUpdated ? localItem : existing);
      } else if (localUpdated && !remoteUpdated) {
        byId.set(localItem.id, localItem);
      } else {
        // Sem updatedAt local, preferimos manter o remoto
        byId.set(localItem.id, existing);
      }
    }

    return Array.from(byId.values());
  }

  return {
    cards: mergeArray(remote.cards, local.cards),
    expenses: mergeArray(remote.expenses, local.expenses),
    incomes: mergeArray(remote.incomes, local.incomes),
  };
}
