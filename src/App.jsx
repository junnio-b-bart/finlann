import { useState, useEffect } from "react";
import Dashboard from "./screens/Dashboard.jsx";
import History from "./screens/History.jsx";
import Settings from "./screens/Settings.jsx";
import BottomNav from "./components/BottomNav.jsx";
import Toast from "./components/Toast.jsx";
import { createInitialState, createDemoStateForMonth, addExpense, addCard, updateCard, deleteCard, addIncome, removeExpenses, updateExpenses, removeIncomes, updateIncomes } from "./data/finance.js";
import { loadStateFromBackend, saveStateToBackend, subscribeToStateChanges } from "./data/finlannBackendClient.js";

import "./styles/globals.css";
import "./styles/finlann.css";

const STORAGE_KEY = "finlann-state-v1";

export default function App() {
  const [tab, setTab] = useState("overview");
  const [settingsView, setSettingsView] = useState("root"); // root | cards | notifications
  const [toast, setToast] = useState(null);
  const [financeState, setFinanceState] = useState(null);
  const [isBooting, setIsBooting] = useState(true);
  const [pendingRemoteState, setPendingRemoteState] = useState(null);

  // Boot inicial: carrega estado do backend (Supabase) ou cai em um estado de demonstração
  useEffect(() => {
    async function boot() {
      try {
        const remote = await loadStateFromBackend();
        if (remote) {
          setFinanceState(remote);
          return;
        }
        const today = new Date();
        setFinanceState(createDemoStateForMonth(today.getFullYear(), today.getMonth()));
      } finally {
        setIsBooting(false);
      }
    }
    boot();
  }, []);

  // Migração rápida: garante que não existam despesas duplicadas com o mesmo id
  useEffect(() => {
    setFinanceState((prev) => {
      if (!prev || !Array.isArray(prev?.expenses)) return prev;
      const seen = new Set();
      const deduped = prev.expenses.filter((e) => {
        if (!e || !e.id) return true;
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
      if (deduped.length === prev.expenses.length) return prev;
      return { ...prev, expenses: deduped };
    });
  }, []);

  // Pequena camada de comandos internos para permitir que o agente
  // registre entradas/saídas "por trás" do app (sem digitar no browser).
  useEffect(() => {
    if (typeof window === "undefined") return;

    function parseAmount(raw) {
      if (raw == null) return 0;
      if (typeof raw === "number") return raw;
      const normalized = String(raw)
        .replace(/[^0-9,\.]/g, "")
        .replace(/\./g, "")
        .replace(/,/g, ".");
      const value = Number(normalized);
      return Number.isNaN(value) ? 0 : value;
    }

    window.finlannCommand = (cmd) => {
      if (!cmd || typeof cmd !== "object") return;
      const { type, payload } = cmd;

      if (type === "add-expense") {
        const now = new Date();
        const baseDate = payload?.date
          ? new Date(payload.date)
          : now;
        const amount = parseAmount(payload?.amount);
        if (!amount || !payload?.method) return;

        const expense = {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          description: (payload.description || "").trim(),
          amount,
          method: payload.method, // credit, debit, pix, cash
          cardId: payload.method === "credit" ? payload.cardId || null : null,
          totalInstallments: 1,
          purchaseDate: baseDate.toISOString(),
          firstInvoiceMonthIndex: baseDate.getMonth(),
          firstInvoiceYear: baseDate.getFullYear(),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
        setFinanceState((prev) => addExpense(prev, expense));
        setToast({ message: "Saída registrada com sucesso.", kind: "success" });
        return;
      }

      if (type === "add-income") {
        const now = new Date();
        const amount = parseAmount(payload?.amount);
        if (!amount) return;

        const income = {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          description: (payload.description || "").trim(),
          amount,
          type: payload?.incomeType || "pix",
          origin: (payload.origin || "").trim(),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
        setFinanceState((prev) => addIncome(prev, income));
        setToast({ message: "Entrada registrada com sucesso.", kind: "success" });
        return;
      }

      // futuros comandos (editar lançamento, etc.) podem ser adicionados aqui.
    };

    return () => {
      if (window.finlannCommand) {
        try {
          delete window.finlannCommand;
        } catch {
          window.finlannCommand = undefined;
        }
      }
    };
  }, []);

  // Persistência local + autosave no backend para o household atual
  useEffect(() => {
    if (!financeState) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(financeState));
    } catch {
      // silencioso por enquanto
    }

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      if (cancelled) return;
      try {
        await saveStateToBackend(financeState);
      } catch (e) {
        console.warn("[Finlann] Falha ao salvar automaticamente no backend", e);
      }
    }, 800);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [financeState]);

  // Auto-clear de toast depois de alguns segundos
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => {
      setToast(null);
    }, 2400);
    return () => clearTimeout(id);
  }, [toast]);

  // Realtime: escuta atualizações do estado desta conta no Supabase
  useEffect(() => {
    if (!financeState) return;

    const unsubscribe = subscribeToStateChanges(undefined, (remoteState) => {
      // guarda o novo estado e deixa o usuário decidir quando aplicar
      setPendingRemoteState(remoteState);
    });

    return () => unsubscribe?.();
  }, [financeState]);

  function handleAddExpense(expense) {
    setFinanceState((prev) => addExpense(prev, expense));
    setToast({ message: "Saída registrada com sucesso.", kind: "success" });
  }

  function handleAddIncome(income) {
    setFinanceState((prev) => addIncome(prev, income));
    setToast({ message: "Entrada registrada com sucesso.", kind: "success" });
  }

  function handleRemoveIncomes(incomeIds) {
    setFinanceState((prev) => removeIncomes(prev, incomeIds));
  }

  function handleUpdateIncomes(updater) {
    setFinanceState((prev) => updateIncomes(prev, updater));
  }

  function handleAddCard(card) {
    setFinanceState((prev) => addCard(prev, card));
  }

  function handleUpdateCard(card) {
    setFinanceState((prev) => updateCard(prev, card));
  }

  function handleDeleteCard(cardId) {
    setFinanceState((prev) => deleteCard(prev, cardId));
  }

  function handleRemoveExpenses(expenseIds) {
    setFinanceState((prev) => removeExpenses(prev, expenseIds));
  }

  function handleTransferExpenses(expenseIds, targetCardId) {
    setFinanceState((prev) =>
      updateExpenses(prev, (e) =>
        expenseIds.includes(e.id)
          ? { ...e, cardId: targetCardId }
          : undefined
      )
    );
  }

  if (isBooting || !financeState) {
    return (
      <div className="app-root">
        <div className="app-shell">
          <main>
            <p className="finlann-loading">Carregando seus dados...</p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <div className="app-shell">
        <main>
          {toast && <Toast message={toast.message} kind={toast.kind} />}

          {pendingRemoteState && (
            <div className="finlann-sync-banner">
              <span>Novos dados desta conta estão disponíveis.</span>
              <button
                type="button"
                className="finlann-sync-banner__button"
                onClick={() => {
                  setFinanceState(pendingRemoteState);
                  setPendingRemoteState(null);
                  setToast({
                    message: "Dados atualizados da conta.",
                    kind: "success",
                  });
                }}
              >
                Atualizar agora
              </button>
            </div>
          )}

          {tab === "overview" && (
            <Dashboard
              financeState={financeState}
              onAddExpense={handleAddExpense}
              onAddIncome={handleAddIncome}
              onRemoveIncomes={handleRemoveIncomes}
              onUpdateIncomes={handleUpdateIncomes}
              onAddCard={handleAddCard}
              onUpdateCard={handleUpdateCard}
              onRemoveExpenses={handleRemoveExpenses}
              onTransferExpenses={handleTransferExpenses}
              onUpdateExpenses={(updater) =>
                setFinanceState((prev) => updateExpenses(prev, updater))
              }
            />
          )}
          {tab === "history" && (
            <History
              financeState={financeState}
              onUpdateIncomes={handleUpdateIncomes}
              onUpdateExpenses={(updater) =>
                setFinanceState((prev) => updateExpenses(prev, updater))
              }
            />
          )}
          {tab === "settings" && (
            <Settings
              financeState={financeState}
              view={settingsView}
              onChangeView={setSettingsView}
              onAddCard={handleAddCard}
              onUpdateCard={handleUpdateCard}
              onDeleteCard={handleDeleteCard}
              onSyncState={setFinanceState}
              onResetState={() => {
                if (typeof window !== "undefined") {
                  try {
                    window.localStorage.removeItem(STORAGE_KEY);
                  } catch {
                    // ignore
                  }
                }
                setFinanceState(createInitialState());
              }}
              onSettingsToast={(message, kind = "success") =>
                setToast({ message, kind })
              }
            />
          )}
        </main>

        <BottomNav current={tab} onChange={setTab} />
      </div>
    </div>
  );
}
