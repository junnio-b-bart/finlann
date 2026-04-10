import { useState, useEffect } from "react";
import Dashboard from "./screens/Dashboard.jsx";
import History from "./screens/History.jsx";
import Settings from "./screens/Settings.jsx";
import LoginScreen from "./screens/LoginScreen.jsx";
import BottomNav from "./components/BottomNav.jsx";
import Toast from "./components/Toast.jsx";
import { createInitialState, addExpense, addCard, updateCard, deleteCard, addIncome, removeExpenses, updateExpenses, removeIncomes, updateIncomes, markInvoicePaid, getFirstInvoiceReferenceForExpense, createInvoicePaymentEntry } from "./data/finance.js";
import { loadStateFromBackend, saveStateToBackend, subscribeToStateChanges } from "./data/finlannBackendClient.js";

import "./styles/globals.css";
import "./styles/finlann.css";
import logoFinlann from "./assets/logo-f-mark.png";

const STORAGE_KEY = "finlann-state-v1";
const SESSION_LAST_ACTIVE_KEY = "finlann.session.lastActiveAt";
const SESSION_BACKGROUND_AT_KEY = "finlann.session.backgroundAt";
const LAST_PROFILE_KEY = "finlann.lastProfile";
const SESSION_TIMEOUT_MS = 60 * 60 * 1000;

export default function App() {
  const [tab, setTab] = useState("overview");
  const [guestMode, setGuestMode] = useState(false);
  const [settingsView, setSettingsView] = useState("root"); // root | cards | notifications
  const [toast, setToast] = useState(null);
  const [financeState, setFinanceState] = useState(null);
  const [isBooting, setIsBooting] = useState(true);
  const [pendingRemoteState, setPendingRemoteState] = useState(null); // mantido por enquanto
  const [showIntro, setShowIntro] = useState(true); // vinheta de abertura

  // Conta logada: lida do localStorage para nÃ£o perder ao recarregar
  const [currentAccount, setCurrentAccount] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem("finlann.currentAccount");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // Vinheta inicial: mostra sempre que a pÃ¡gina Ã© carregada ou recarregada
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

  // Boot inicial:
  // - com conta: carrega estado da conta no backend (ou estado vazio se for conta nova)
  // - sem conta: sempre inicia zerado
  useEffect(() => {
    async function boot() {
      try {
        if (!currentAccount?.user_id) {
          setFinanceState(createInitialState());
          return;
        }

        const remote = await loadStateFromBackend(currentAccount.user_id);
        if (remote && (remote.incomes?.length || remote.expenses?.length || remote.cards?.length)) {
          setFinanceState(remote);
          return;
        }

        const emptyState = createInitialState();
        setFinanceState(emptyState);

        try {
          await saveStateToBackend(emptyState, currentAccount.user_id);
        } catch (e) {
          console.warn("[Finlann] Nao foi possivel salvar estado inicial da conta", e);
        }
      } finally {
        setIsBooting(false);
      }
    }
    boot();
  }, [currentAccount?.user_id]);

  // MigraÃ§Ã£o rÃ¡pida: garante que nÃ£o existam despesas duplicadas com o mesmo id
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
  // registre entradas/saÃ­das "por trÃ¡s" do app (sem digitar no browser).
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

        const referenceCard =
          payload.method === "credit" && payload.cardId
            ? financeState?.cards?.find((c) => c.id === payload.cardId) || null
            : null;
        const invoiceReference =
          payload.method === "credit"
            ? getFirstInvoiceReferenceForExpense(
                {
                  purchaseDate: baseDate.toISOString(),
                  createdAt: baseDate.toISOString(),
                },
                referenceCard
              )
            : {
                firstInvoiceMonthIndex: baseDate.getMonth(),
                firstInvoiceYear: baseDate.getFullYear(),
              };

        const expense = {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          description: (payload.description || "").trim(),
          amount,
          method: payload.method, // credit, debit, pix, cash
          cardId: payload.method === "credit" ? payload.cardId || null : null,
          totalInstallments: 1,
          purchaseDate: baseDate.toISOString(),
          firstInvoiceMonthIndex: invoiceReference.firstInvoiceMonthIndex,
          firstInvoiceYear: invoiceReference.firstInvoiceYear,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
        setFinanceState((prev) => addExpense(prev, expense));
        setToast({ message: "SaÃ­da registrada com sucesso.", kind: "success" });
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

      // futuros comandos (editar lanÃ§amento, etc.) podem ser adicionados aqui.
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

  // PersistÃªncia local + autosave no backend para o household atual
  useEffect(() => {
    if (!financeState) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(financeState));
    } catch {
      // silencioso por enquanto
    }

    if (!currentAccount?.user_id) return;

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      if (cancelled) return;
      try {
        await saveStateToBackend(financeState, currentAccount.user_id);
      } catch (e) {
        console.warn("[Finlann] Falha ao salvar automaticamente no backend", e);
      }
    }, 150); // autosave mais rÃ¡pido para sincronizaÃ§Ã£o quase imediata

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [financeState, currentAccount?.user_id]);

  // Auto-clear de toast depois de alguns segundos
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => {
      setToast(null);
    }, 2400);
    return () => clearTimeout(id);
  }, [toast]);

  // Sessao expira apos 1h com o app em segundo plano
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const markActive = () => {
      try {
        window.localStorage.setItem(SESSION_LAST_ACTIVE_KEY, String(Date.now()));
      } catch {
        // ignore
      }
    };

    const markBackgroundStart = () => {
      try {
        window.localStorage.setItem(SESSION_BACKGROUND_AT_KEY, String(Date.now()));
      } catch {
        // ignore
      }
    };

    const clearBackgroundStart = () => {
      try {
        window.localStorage.removeItem(SESSION_BACKGROUND_AT_KEY);
      } catch {
        // ignore
      }
    };

    const expireIfNeeded = () => {
      if (!currentAccount?.user_id) {
        clearBackgroundStart();
        markActive();
        return;
      }

      let backgroundAt = 0;
      try {
        backgroundAt = Number(window.localStorage.getItem(SESSION_BACKGROUND_AT_KEY) || "0");
      } catch {
        backgroundAt = 0;
      }

      if (backgroundAt > 0 && Date.now() - backgroundAt > SESSION_TIMEOUT_MS) {
        persistLastProfile(currentAccount);
        try {
          window.localStorage.removeItem("finlann.currentAccount");
          window.localStorage.removeItem("finlann.householdId");
          window.localStorage.removeItem(SESSION_BACKGROUND_AT_KEY);
        } catch {
          // ignore
        }
        setCurrentAccount(null);
        setGuestMode(false);
        setFinanceState(createInitialState());
        setTab("overview");
        setToast({ message: "Sessao expirada. Faca login novamente.", kind: "error" });
        markActive();
        return;
      }

      clearBackgroundStart();
      markActive();
    };

    const handleVisibility = () => {
      if (document.hidden) {
        markBackgroundStart();
        return;
      }
      expireIfNeeded();
    };

    const handleFocus = () => {
      expireIfNeeded();
    };

    const handlePageHide = () => {
      markBackgroundStart();
    };

    expireIfNeeded();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [currentAccount?.user_id]);

  // Realtime: escuta atualizaÃ§Ãµes do estado desta conta no Supabase
  useEffect(() => {
    if (!financeState) return;
    const householdId = currentAccount?.user_id;
    if (!householdId) return;

    const unsubscribe = subscribeToStateChanges(householdId, (remoteState) => {
      // aplica automaticamente o estado mais recente da conta em todos os devices conectados
      setFinanceState(remoteState);
      setToast({ message: "Dados da conta atualizados.", kind: "success" });
      setPendingRemoteState(null);
    });

    return () => unsubscribe?.();
  }, [financeState, currentAccount?.user_id]);
  function handleAddExpense(expense) {
    setFinanceState((prev) => addExpense(prev, expense));
    setToast({ message: "Saida registrada com sucesso.", kind: "success" });
  }

  function handleImportExpenses(expensesToImport) {
    if (!Array.isArray(expensesToImport) || expensesToImport.length === 0) {
      return { added: 0, skipped: 0 };
    }

    const toSignature = (expense) => {
      const dateRaw = expense.purchaseDate || expense.createdAt;
      const date = dateRaw ? new Date(dateRaw) : null;
      const dateKey =
        date && !Number.isNaN(date.getTime())
          ? date.toISOString().slice(0, 10)
          : "";
      const amount = Number(expense.amount || 0);
      const normalizedAmount = Number.isFinite(amount) ? amount.toFixed(2) : "0.00";

      return [
        expense.method || "",
        expense.cardId || "",
        (expense.description || "").trim().toLowerCase(),
        normalizedAmount,
        String(expense.totalInstallments || 1),
        dateKey,
      ].join("|");
    };

    let added = 0;
    let skipped = 0;

    setFinanceState((prev) => {
      const current = Array.isArray(prev?.expenses) ? prev.expenses : [];
      const signatures = new Set(current.map((expense) => toSignature(expense)));
      const merged = [...current];

      for (const expense of expensesToImport) {
        const signature = toSignature(expense);
        if (signatures.has(signature)) {
          skipped += 1;
          continue;
        }
        signatures.add(signature);
        merged.push(expense);
        added += 1;
      }

      if (added === 0) return prev;
      return {
        ...prev,
        expenses: merged,
      };
    });

    if (added > 0) {
      const label = added === 1 ? "lancamento importado" : "lancamentos importados";
      setToast({ message: `${added} ${label} da fatura.`, kind: "success" });
    } else {
      setToast({ message: "Nenhum novo lancamento para importar.", kind: "error" });
    }

    return { added, skipped };
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

  function handlePayInvoice(cardId, monthIndex, year) {
    setFinanceState((prev) => {
      const paymentEntry = createInvoicePaymentEntry(prev, cardId, monthIndex, year);
      return markInvoicePaid(prev, cardId, monthIndex, year, paymentEntry);
    });
    setToast({ message: "Fatura marcada como paga!", kind: "success" });
  }

  function persistLastProfile(account) {
    if (!account?.user_id || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        LAST_PROFILE_KEY,
        JSON.stringify({
          user_id: account.user_id || "",
          first_name: account.first_name || "",
          last_name: account.last_name || "",
          has_password: !!account.has_password,
          theme_color: account.theme_color || "#3b82f6",
        })
      );
    } catch {
      // ignore
    }
  }

  function handleLoginSuccess(account, remoteState) {
    persistLastProfile(account);
    try {
      window.localStorage.setItem("finlann.currentAccount", JSON.stringify(account));
      if (account?.user_id) {
        window.localStorage.setItem("finlann.householdId", account.user_id);
      }
      window.localStorage.setItem(SESSION_LAST_ACTIVE_KEY, String(Date.now()));
      window.localStorage.removeItem(SESSION_BACKGROUND_AT_KEY);
    } catch {
      // ignore
    }
    setCurrentAccount(account);
    setGuestMode(false);
    setFinanceState(remoteState || createInitialState());
    setTab("overview");
  }

  function handleContinueWithoutAccount() {
    try {
      window.localStorage.removeItem("finlann.currentAccount");
      window.localStorage.removeItem("finlann.householdId");
      window.localStorage.removeItem(SESSION_BACKGROUND_AT_KEY);
    } catch {
      // ignore
    }
    setCurrentAccount(null); // garante que nÃ£o hÃ¡ conta logada
    setGuestMode(true);
    setFinanceState(createInitialState());
    setTab("overview");
  }

  function handleLogoutAccount() {
    persistLastProfile(currentAccount);

    try {
      window.localStorage.removeItem("finlann.currentAccount");
      window.localStorage.removeItem("finlann.householdId");
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(SESSION_BACKGROUND_AT_KEY);
    } catch {
      // ignore
    }
    setCurrentAccount(null);
    setGuestMode(false);
    setFinanceState(createInitialState());
    setTab("overview");
    setSettingsView("root");
    setToast({ message: "Sessao encerrada. Faca login novamente.", kind: "success" });
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

  // Vinheta de abertura: mostra sÃ³ quando o app Ã© aberto de novo na sessÃ£o
  if (showIntro) {

    return (
      <div className="app-root app-root--immersive">
        <div className="app-shell app-shell--loading">
          <main className="finlann-loading-screen">
            <div className="finlann-loading-brand" aria-label="Finlann">
              <img src={logoFinlann} alt="" className="finlann-loading-logo-img" />
              <span className="finlann-loading-brand__name">Finlann</span>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Tela de carregamento enquanto os dados ainda nÃ£o chegaram
  if (isBooting || !financeState) {

    return (
      <div className="app-root app-root--immersive">
        <div className="app-shell app-shell--loading">
          <main className="finlann-loading-screen">
            <div className="finlann-loading-brand" aria-label="Finlann">
              <img src={logoFinlann} alt="" className="finlann-loading-logo-img" />
              <span className="finlann-loading-brand__name">Finlann</span>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Se nÃ£o hÃ¡ conta logada e o boot terminou, mostra a tela de login
  if (!isBooting && !showIntro && financeState && !currentAccount && !guestMode) {
    return (
      <div className="app-root app-root--immersive">
        <div className="app-shell app-shell--auth">
          <LoginScreen
            onLoginSuccess={handleLoginSuccess}
            onContinueWithoutAccount={handleContinueWithoutAccount}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <div className={tab === "overview" ? "app-shell app-shell--overview" : "app-shell"}>
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
              onPayInvoice={handlePayInvoice}
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
              onImportExpenses={handleImportExpenses}
              onLogoutAccount={handleLogoutAccount}
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



