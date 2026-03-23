import { useState, useEffect } from "react";
import Dashboard from "./screens/Dashboard.jsx";
import History from "./screens/History.jsx";
import Settings from "./screens/Settings.jsx";
import BottomNav from "./components/BottomNav.jsx";
import Toast from "./components/Toast.jsx";
import { createInitialState, createDemoStateForMonth, addExpense, addCard, updateCard, deleteCard, addIncome, removeExpenses, updateExpenses, removeIncomes, updateIncomes } from "./data/finance.js";
import { loadStateFromBackend, saveStateToBackend, subscribeToStateChanges, getCurrentHouseholdId } from "./data/finlannBackendClient.js";

import "./styles/globals.css";
import "./styles/finlann.css";
import loadingStep1 from "./assets/waitingscreen/progresso empty.png";
import loadingStep2 from "./assets/waitingscreen/progresso empty (2).png";

const STORAGE_KEY = "finlann-state-v1";

export default function App() {
  const [tab, setTab] = useState("overview");
  const [settingsView, setSettingsView] = useState("root"); // root | cards | notifications
  const [toast, setToast] = useState(null);
  const [financeState, setFinanceState] = useState(null);
  const [isBooting, setIsBooting] = useState(true);
  const [pendingRemoteState, setPendingRemoteState] = useState(null); // mantido por enquanto
  const [frame, setFrame] = useState(0); // animação da tela de carregamento
  const [showIntro, setShowIntro] = useState(true); // vinheta de abertura

  // household atual (conta logada); usado para amarrar realtime no Supabase
  const householdId = getCurrentHouseholdId();

  // Vinheta inicial: mostra sempre que a página é carregada ou recarregada
  useEffect(() => {
    if (typeof window === "undefined") {
      setShowIntro(false);
      return;
    }

    const id = setTimeout(() => {
      setShowIntro(false);
    }, 3000); // ~3s de vinheta

    return () => clearTimeout(id);
  }, []);

  // Boot inicial: carrega estado do backend (Supabase) ou, se estiver vazio,
  // injeta um mês de demonstração para facilitar testes (entradas/saídas reais).
  useEffect(() => {
    async function boot() {
      try {
        const remote = await loadStateFromBackend();
        if (remote && (remote.incomes?.length || remote.expenses?.length || remote.cards?.length)) {
          setFinanceState(remote);
          return;
        }

        const today = new Date();
        const demo = createDemoStateForMonth(today.getFullYear(), today.getMonth());
        setFinanceState(demo);

        // se já houver uma conta/household configurado, salva o demo no backend
        try {
          await saveStateToBackend(demo);
        } catch (e) {
          console.warn("[Finlann] Não foi possível salvar estado de demonstração no backend", e);
        }
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
    }, 150); // autosave mais rápido para sincronização quase imediata

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
    const householdId = getCurrentHouseholdId();
    if (!householdId) return;

    const unsubscribe = subscribeToStateChanges(householdId, (remoteState) => {
      // aplica automaticamente o estado mais recente da conta em todos os devices conectados
      setFinanceState(remoteState);
      setToast({ message: "Dados da conta atualizados.", kind: "success" });
      setPendingRemoteState(null);
    });

    return () => unsubscribe?.();
  }, [financeState]);

  // animação da tela de carregamento / vinheta: alterna entre duas imagens
  useEffect(() => {
    if (!showIntro && !isBooting && financeState) return; // só anima enquanto está na intro ou carregando

    const id = setInterval(() => {
      setFrame((prev) => (prev === 0 ? 1 : 0));
    }, 600);

    return () => clearInterval(id);
  }, [showIntro, isBooting, financeState]);

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

  // Vinheta de abertura: mostra só quando o app é aberto de novo na sessão
  if (showIntro) {
    const currentImage = frame === 0 ? loadingStep1 : loadingStep2;

    return (
      <div className="app-root">
        <div className="app-shell">
          <main className="finlann-loading-screen">
            <img
              src={currentImage}
              alt="Abrindo Finlann"
              className="finlann-loading-screen__image"
            />
          </main>
        </div>
      </div>
    );
  }

  // Tela de carregamento enquanto os dados ainda não chegaram
  if (isBooting || !financeState) {
    const currentImage = frame === 0 ? loadingStep1 : loadingStep2;

    return (
      <div className="app-root">
        <div className="app-shell">
          <main className="finlann-loading-screen">
            <img
              src={currentImage}
              alt="Carregando Finlann"
              className="finlann-loading-screen__image"
            />
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

        <BottomNav
          current={tab}
          onChange={(nextTab) => {
            if (nextTab === "settings") {
              setSettingsView("root"); // sempre volta para a tela principal de Config
            }
            setTab(nextTab);
          }}
        />
      </div>
    </div>
  );
}
