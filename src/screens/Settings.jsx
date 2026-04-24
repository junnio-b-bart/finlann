import { useState } from "react";
import "../styles/globals.css";
import "../styles/tokens.css";
import "../styles/finlann.css";

import eyeOpen from "../assets/icons/4.png";
import eyeClosed from "../assets/icons/3.png";

import { exportState, normalizeState } from "../data/finance.sync.js";
import { createAccount, loginAccount, loadStateFromBackend, saveStateToBackend, updateAccount } from "../data/finlannBackendClient.js";
import SettingsCards from "./SettingsCards.jsx";
import SettingsNotifications from "./SettingsNotifications.jsx";
import InvoicePdfImportModal from "../components/InvoicePdfImportModal.jsx";
import InvoiceImageImportModal from "../components/InvoiceImageImportModal.jsx";

export default function Settings({
  financeState,
  view,
  onChangeView,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onSyncState,
  onResetState,
  onSettingsToast,
  onImportExpenses,
  onLogoutAccount,
}) {
  const exported = exportState(financeState);

  const [showEraseModal, setShowEraseModal] = useState(false);
  const [eraseConfirmation, setEraseConfirmation] = useState("");

  // Modal de conta Finlann
  const [accountModalMode, setAccountModalMode] = useState(null); // "create" | "login" | null
  const [modalEmail, setModalEmail] = useState("");
  const [modalFirstName, setModalFirstName] = useState("");
  const [modalLastName, setModalLastName] = useState("");
  const [modalUser, setModalUser] = useState("");

  // Conta Finlann logada (MVP: assume logado após criar conta)
  const [currentAccount, setCurrentAccount] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem("finlann.currentAccount");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  function setAndPersistCurrentAccount(account) {
    setCurrentAccount(account);
    if (typeof window === "undefined" || !account) return;
    try {
      window.localStorage.setItem("finlann.currentAccount", JSON.stringify(account));
      // também amarra o householdId desta conta
      if (account.user_id) {
        window.localStorage.setItem("finlann.householdId", account.user_id);
      }
    } catch {
      // ignore
    }
  }
  const [modalPassword, setModalPassword] = useState("");
  const [modalConfirmPassword, setModalConfirmPassword] = useState("");
  const [modalHasPassword, setModalHasPassword] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalPasswordStrength, setModalPasswordStrength] = useState("none"); // none | weak | medium | strong
  const [modalThemeColor, setModalThemeColor] = useState("#3b82f6"); // cor base do pop-up de conta
  const [modalShowCustomColor, setModalShowCustomColor] = useState(false);
  const [modalCustomThemeColor, setModalCustomThemeColor] = useState(null);
 
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const [accountConflict, setAccountConflict] = useState(null); // { remoteState }
  const [modalEmailError, setModalEmailError] = useState(false);
  const [modalFirstNameError, setModalFirstNameError] = useState(false);
  const [modalLastNameError, setModalLastNameError] = useState(false);
  const [modalUserError, setModalUserError] = useState(false);
  const [modalPasswordErrorFlag, setModalPasswordErrorFlag] = useState(false);
  const [modalConfirmPasswordError, setModalConfirmPasswordError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Estado da modal de editar conta
  const [showEditAccountModal, setShowEditAccountModal] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editThemeColor, setEditThemeColor] = useState("#3b82f6");
  const [editNewPassword, setEditNewPassword] = useState("");
  const [editConfirmNewPassword, setEditConfirmNewPassword] = useState("");
  const [editShowNewPassword, setEditShowNewPassword] = useState(false);
  const [editShowConfirmPassword, setEditShowConfirmPassword] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState(false);

  function openEditAccountModal() {
    if (!currentAccount) return;
    setEditFirstName(currentAccount.first_name || "");
    setEditLastName(currentAccount.last_name || "");
    setEditEmail(currentAccount.email || "");
    setEditThemeColor(currentAccount.theme_color || "#3b82f6");
    setEditNewPassword("");
    setEditConfirmNewPassword("");
    setEditError("");
    setEditSuccess(false);
    setEditShowNewPassword(false);
    setEditShowConfirmPassword(false);
    setShowEditAccountModal(true);
  }

  function openAccountModal(mode) {
    setAccountModalMode(mode);
    setModalEmail("");
    setModalFirstName("");
    setModalLastName("");
    setModalUser("");
    setModalPassword("");
    setModalConfirmPassword("");
    setModalError("");
  }

  function closeAccountModal() {
    setAccountModalMode(null);
    setModalEmail("");
    setModalFirstName("");
    setModalLastName("");
    setModalUser("");
    setModalPassword("");
    setModalConfirmPassword("");
    setModalError("");
  }

  async function handleLoginSubmit(event) {
    if (event) {
      event.preventDefault();
    }

    if (accountModalMode !== "login") return;

    setModalUserError(false);
    setModalPasswordErrorFlag(false);
    setModalError("");

    let hasError = false;
    if (!modalUser) {
      setModalUserError(true);
      hasError = true;
    }
    if (hasError) return;

    try {
      const account = await loginAccount({
        user_id: modalUser,
        password: modalPassword || null,
      });
      setAndPersistCurrentAccount(account);

      // conflito local x backend para essa conta
      try {
        const remoteState = await loadStateFromBackend(account.user_id);
        const local = normalizeState(financeState);

        const localIsEmpty =
          (local.cards?.length || 0) === 0 &&
          (local.expenses?.length || 0) === 0 &&
          (local.incomes?.length || 0) === 0;

        if (!remoteState && !localIsEmpty) {
          // Conta nova vazia, mas há dados locais → usa o conflito estilizado
          setAccountConflict({ remoteState: null, emptyRemote: true });
          // escolha via modal de conflito abaixo; o autosave depois sobe os dados locais
        } else if (remoteState && localIsEmpty) {
          // app vazio, conta com dados -> usar dados da conta
          if (onSyncState) {
            onSyncState(remoteState);
          }
        } else if (remoteState && !localIsEmpty) {
          // temos dados locais E na conta -> abre pop-up de conflito estilizado
          setAccountConflict({ remoteState });
        }
      } catch (e) {
        console.warn("[Finlann] Não foi possível resolver conflito local/backend após login:", e);
      }

      closeAccountModal();
    } catch (err) {
      console.error("[Finlann] Erro ao fazer login na conta Finlann:", err);
      setModalError("Usuário ou senha inválidos.");
    }
  }

  if (view === "cards") {
    return (
      <SettingsCards
        financeState={financeState}
        onAddCard={onAddCard}
        onUpdateCard={onUpdateCard}
        onDeleteCard={onDeleteCard}
        onBack={() => onChangeView("root")}
      />
    );
  }

  if (view === "notifications") {
    return <SettingsNotifications onBack={() => onChangeView("root")} />;
  }

  if (view === "invoice-image") {
    return (
      <div className="finlann-dashboard finlann-dashboard--settings finlann-dashboard--ambient finlann-dashboard--settings-invoice-image">
        <div className="finlann-dashboard__scroll finlann-dashboard__scroll--settings finlann-dashboard__scroll--invoice-image">
          <InvoiceImageImportModal
            asPage
            cards={financeState?.cards || []}
            existingExpenses={financeState?.expenses || []}
            onClose={() => onChangeView("root")}
            onImportExpenses={onImportExpenses}
            onSettingsToast={onSettingsToast}
          />
        </div>
      </div>
    );
  }

  if (view === "invoice-pdf") {
    return (
      <div className="finlann-dashboard finlann-dashboard--settings finlann-dashboard--ambient finlann-dashboard--settings-invoice-image">
        <div className="finlann-dashboard__scroll finlann-dashboard__scroll--settings finlann-dashboard__scroll--invoice-image">
          <InvoicePdfImportModal
            asPage
            cards={financeState?.cards || []}
            onClose={() => onChangeView("root")}
            onImportExpenses={onImportExpenses}
            onSettingsToast={onSettingsToast}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="finlann-dashboard finlann-dashboard--settings finlann-dashboard--ambient">
      <div className="finlann-dashboard__top">
        <div className="finlann-header-strip">
          <header className="finlann-header finlann-header--centered">
            <div className="finlann-header__left" style={{ paddingTop: 8 }}>
              <h1 className="finlann-settings-title-brand">
                <span className="finlann-settings-title-brand__icon" aria-hidden="true" />
                <span>Configuração</span>
              </h1>
            </div>
          </header>
        </div>
      </div>

      <div className="finlann-dashboard__scroll finlann-dashboard__scroll--settings">
      {/* Card de Conta Finlann (sem Google) */}
      <section className="finlann-section">
        <header className="finlann-section__header">
          <h2 className="finlann-section__title">Conta</h2>
        </header>

        <div className="finlann-settings-profile-row" style={{ gap: 6 }}>
          <div className="finlann-settings-avatar">
            <span
              className="finlann-settings-avatar__circle finlann-settings-avatar__circle--large"
              style={currentAccount?.theme_color ? { background: currentAccount.theme_color } : undefined}
            >
              {currentAccount
                ? `${(currentAccount.first_name || "?")[0]}${(currentAccount.last_name || "")[0] || ""}`.toUpperCase()
                : "F"}
            </span>
          </div>

          <div className="finlann-settings-profile-text">
            <p className="finlann-settings-profile-name">
              {currentAccount
                ? `${currentAccount.first_name || ""} ${currentAccount.last_name || ""}`.trim() || currentAccount.user_id
                : "Finlann"}
            </p>
            <p className="finlann-settings-profile-subtitle">
              {currentAccount
                ? `Conectado como ${currentAccount.user_id}.`
                : "Abra ou acesse uma conta Finlann para sincronizar seus dados."}
            </p>
          </div>

          {currentAccount && (
            <div className="finlann-settings-actions-bar__right" style={{ alignSelf: "center" }}>
              <button
                type="button"
                className="finlann-settings-sync-button"
                onClick={async () => {
                  try {
                    // Puxa o estado mais recente da conta no backend e aplica neste dispositivo
                    const remote = await loadStateFromBackend(currentAccount.user_id);
                    if (remote && onSyncState) {
                      onSyncState(remote);
                    }

                    setShowSyncSuccess(true);
                    onSettingsToast?.("Dados sincronizados com a conta.", "success");
                  } catch (e) {
                    console.error("[Finlann] Erro ao sincronizar com backend:", e);
                    setModalError("Não foi possível sincronizar agora. Tente novamente.");
                  }
                }}
                aria-label="Sincronizar agora"
              >
                ↻
              </button>
            </div>
          )}
        </div>

        <div
          className="finlann-settings-actions-bar"
          style={currentAccount ? { flexDirection: "row", alignItems: "center", gap: 8 } : { width: "100%", maxWidth: 520, gap: 8 }}
        >
          {!currentAccount ? (
            <div className="finlann-settings-actions-row" style={{ width: "100%", maxWidth: 520, gap: 8 }}>
              <button
                type="button"
                className="finlann-chip finlann-chip--outline"
                style={{ flex: 1 }}
                onClick={() => openAccountModal("login")}
              >
                Entrar
              </button>
              <button
                type="button"
                className="finlann-chip finlann-chip--outline"
                style={{ flex: 1 }}
                onClick={() => openAccountModal("create")}
              >
                Criar conta
              </button>
            </div>
          ) : (
            <div className="finlann-settings-actions-row" style={{ width: "100%", gap: 8 }}>
              <button
                type="button"
                className="finlann-chip finlann-chip--outline"
                style={{ flex: 1 }}
                onClick={() => openEditAccountModal()}
              >
                Editar conta
              </button>
              <button
                type="button"
                className="finlann-chip finlann-chip--outline"
                style={{ flex: 1, borderColor: "#f97373", color: "#f97373" }}
                onClick={() => {
                  setShowLogoutConfirm(true);
                }}
              >
                Sair da conta
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Lista de subpáginas de configurações */}
      <section className="finlann-section">
        <header className="finlann-section__header">
          <h2 className="finlann-section__title">Ajustes</h2>
        </header>

        <div className="finlann-list">
          <button
            type="button"
            className="finlann-list-item"
            onClick={() => onChangeView("cards")}
          >
            <div className="finlann-list-item__left">
              <div>
                <p className="finlann-list-item__title">Cartões</p>
                <p className="finlann-list-item__subtitle">
                  Ver, editar e excluir cartões de crédito.
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            className="finlann-list-item"
            onClick={() => onChangeView("notifications")}
          >
            <div className="finlann-list-item__left">
              <div>
                <p className="finlann-list-item__title">Notificações</p>
                <p className="finlann-list-item__subtitle">
                  Lembretes de fatura e alertas de limite (em breve).
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            className="finlann-list-item"
            onClick={() => onChangeView("invoice-pdf")}
          >
            <div className="finlann-list-item__left">
              <div>
                <p className="finlann-list-item__title">Importar fatura em PDF</p>
                <p className="finlann-list-item__subtitle">
                  Leia o PDF, marque os itens com checkbox e importe so o que for seu.
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            className="finlann-list-item"
            onClick={() => onChangeView("invoice-image")}
          >
            <div className="finlann-list-item__left">
              <div>
                <p className="finlann-list-item__title">Importar fatura por foto</p>
                <p className="finlann-list-item__subtitle">
                  Envie fotos da fatura, revise os itens com checkbox e importe apenas o que for seu.
                </p>
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* Seção de segurança: apagar todos os dados locais */}
      <section className="finlann-section">
        <header className="finlann-section__header">
          <h2 className="finlann-section__title">Segurança e limpeza</h2>
        </header>

        <div className="finlann-list">
          <button
            type="button"
            className="finlann-list-item"
            onClick={() => setShowEraseModal(true)}
          >
            <div className="finlann-list-item__left">
              <div>
                <p className="finlann-list-item__title">Apagar todos os dados deste dispositivo</p>
                <p className="finlann-list-item__subtitle">
                  Remove entradas, saídas e cartões salvos localmente. Seus dados no Google Drive não são afetados.
                </p>
              </div>
            </div>
          </button>
        </div>
      </section>
      </div>

      {showEraseModal && (
        <div className="finlann-overlay">
          <div className="finlann-overlay__panel">
            <header className="finlann-modal__header">
              <p className="finlann-modal__eyebrow">Limpeza de dados</p>
              <h2 className="finlann-modal__title">Apagar todos os dados deste app</h2>
            </header>

            <div className="finlann-modal__body">
              <p className="finlann-settings-profile-subtitle">
                Este procedimento vai apagar todas as entradas, saídas e cartões salvos neste dispositivo.
                Os dados já salvos na sua conta Finlann permanecerão no servidor.
              </p>
              <p className="finlann-settings-profile-subtitle">
                Para confirmar, digite a frase abaixo exatamente como está:
              </p>
              <p className="finlann-settings-profile-name" style={{ marginTop: 4 }}>
                <strong>APAGAR TODOS OS DADOS</strong>
              </p>
              <input
                type="text"
                className="finlann-field__input"
                placeholder="Digite aqui para confirmar"
                value={eraseConfirmation}
                onChange={(e) => setEraseConfirmation(e.target.value)}
              />
            </div>

            <div className="finlann-modal__footer finlann-modal__footer--split">
              <button
                type="button"
                className="finlann-modal__secondary"
                onClick={() => {
                  setEraseConfirmation("");
                  setShowEraseModal(false);
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="finlann-modal__primary finlann-modal__primary--danger"
                disabled={eraseConfirmation !== "APAGAR TODOS OS DADOS"}
                onClick={() => {
                  if (eraseConfirmation !== "APAGAR TODOS OS DADOS") return;
                  setEraseConfirmation("");
                  setShowEraseModal(false);
                  onResetState?.();
                }}
              >
                Confirmar exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {accountModalMode && (
        <div className="finlann-overlay">
          <div
            className="finlann-overlay__panel"
            style={
              accountModalMode === "create"
                ? {
                    border: `2px solid ${modalThemeColor}`,
                    backgroundImage: `linear-gradient(135deg, #020617 0%, #020617 20%, ${modalThemeColor}33 55%, ${modalThemeColor}80 100%)`,
                  }
                : undefined
            }
          >
            <header className="finlann-modal__header">
              <h2 className="finlann-modal__title">
                {accountModalMode === "create" ? "Nova conta" : "Fazer login"}
              </h2>
            </header>

            <div className="finlann-modal__body finlann-modal__body--scroll">
              {accountModalMode === "create" && (
                <>
                  <div style={{ margin: "24px 0 12px" }}>
                    <label
                      className="finlann-settings-profile-subtitle"
                      style={{ marginBottom: 4, display: "block" }}
                    >
                      E-MAIL
                      {modalEmailError && (
                        <span style={{ color: "#ef4444", marginLeft: 4 }}>*</span>
                      )}
                    </label>
                    <input
                      type="email"
                      className="finlann-field__input"
                      placeholder="seu@email.com"
                      value={modalEmail}
                      onChange={(e) => setModalEmail(e.target.value)}
                    />
                  </div>

                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label
                        className="finlann-settings-profile-subtitle"
                        style={{ marginBottom: 4, display: "block" }}
                      >
                        NOME
                        {modalFirstNameError && (
                          <span style={{ color: "#ef4444", marginLeft: 4 }}>*</span>
                        )}
                      </label>
                      <input
                        type="text"
                        className="finlann-field__input"
                        placeholder="Nome"
                        value={modalFirstName}
                        onChange={(e) => setModalFirstName(e.target.value)}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label
                        className="finlann-settings-profile-subtitle"
                        style={{ marginBottom: 4, display: "block" }}
                      >
                        SOBRENOME
                        {modalLastNameError && (
                          <span style={{ color: "#ef4444", marginLeft: 4 }}>*</span>
                        )}
                      </label>
                      <input
                        type="text"
                        className="finlann-field__input"
                        placeholder="Sobrenome"
                        value={modalLastName}
                        onChange={(e) => setModalLastName(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              <div style={{ margin: "24px 0 12px" }}>
                <label
                  className="finlann-settings-profile-subtitle"
                  style={{ marginBottom: 4, display: "block" }}
                >
                  NOME DA CONTA
                </label>
                <input
                  type="text"
                  className="finlann-field__input"
                  placeholder="Nome da conta"
                  value={modalUser}
                  onChange={(e) => setModalUser(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleLoginSubmit(e);
                    }
                  }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label
                  className="finlann-settings-profile-subtitle"
                  style={{ marginBottom: 4, display: "block" }}
                >
                  SENHA
                  {modalHasPassword && modalPasswordErrorFlag && (
                    <span style={{ color: "#ef4444", marginLeft: 4 }}>*</span>
                  )}
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="finlann-field__input"
                    placeholder="Senha"
                    value={modalPassword}
                    onChange={(e) => {
                      const value = e.target.value;
                      setModalPassword(value);
                      const len = value.length;
                      let strength = "none";
                      if (len > 0 && len <= 4) strength = "weak";
                      else if (len >= 5 && len <= 7) strength = "medium";
                      else if (len >= 8) strength = "strong";
                      setModalPasswordStrength(strength);
                      setModalError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleLoginSubmit(e);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    style={{
                      borderRadius: 999,
                      border: "1px solid rgba(148,163,184,0.5)",
                      width: 32,
                      height: 32,
                      background: "transparent",
                      color: "#e5e7eb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                  >
                    <img
                      src={showPassword ? eyeClosed : eyeOpen}
                      alt={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      style={{ width: 18, height: 18 }}
                    />
                  </button>
                </div>
              </div>

              {accountModalMode === "create" && modalHasPassword && (
                <div style={{ marginBottom: 12 }}>
                  <label
                    className="finlann-settings-profile-subtitle"
                    style={{ marginBottom: 4, display: "block" }}
                  >
                    CONFIRMAR SENHA
                    {modalConfirmPasswordError && (
                      <span style={{ color: "#ef4444", marginLeft: 4 }}>*</span>
                    )}
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      className="finlann-field__input"
                      placeholder="Repita a senha"
                      value={modalConfirmPassword}
                      onChange={(e) => setModalConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      style={{
                        borderRadius: 999,
                        border: "1px solid rgba(148,163,184,0.5)",
                        width: 32,
                        height: 32,
                        background: "transparent",
                        color: "#e5e7eb",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                      }}
                    >
                      <img
                        src={showConfirmPassword ? eyeClosed : eyeOpen}
                        alt={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                        style={{ width: 18, height: 18 }}
                      />
                    </button>
                  </div>
                </div>
              )}

              {accountModalMode === "create" && (
                <div style={{ marginBottom: 12 }}>
                  <label
                    className="finlann-settings-profile-subtitle"
                    style={{ marginBottom: 4, display: "block" }}
                  >
                    CORES DA CONTA
                  </label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {/* 4 cores fixas */}
                    {["#3b82f6", "#8b5cf6", "#ec4899", "#22c55e"].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => {
                          setModalThemeColor(color);
                          setModalShowCustomColor(false);
                        }}
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 999,
                          border:
                            modalThemeColor === color
                              ? "2px solid #e5e7eb"
                              : "1px solid #4b5563",
                          backgroundColor: color,
                          padding: 0,
                          cursor: "pointer",
                        }}
                      />
                    ))}

                    {/* 5ª bolinha: cor customizada, se existir */}
                    <button
                      type="button"
                      onClick={() => {
                        if (!modalCustomThemeColor) return;
                        setModalThemeColor(modalCustomThemeColor);
                        setModalShowCustomColor(false);
                      }}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        border: modalCustomThemeColor
                          ? "2px solid #e5e7eb"
                          : "1px dashed #4b5563",
                        backgroundColor: modalCustomThemeColor || "transparent",
                        padding: 0,
                        cursor: modalCustomThemeColor ? "pointer" : "default",
                      }}
                    />

                    {/* 6ª bolinha: seletor customizado (arco-íris) */}
                    <button
                      type="button"
                      onClick={() => setModalShowCustomColor((prev) => !prev)}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        border: modalShowCustomColor
                          ? "2px solid #e5e7eb"
                          : "1px solid #4b5563",
                        backgroundImage:
                          "conic-gradient(from 180deg, #EF4444, #F97316, #FACC15, #22C55E, #0EA5E9, #6366F1, #EC4899, #EF4444)",
                        padding: 0,
                        cursor: "pointer",
                      }}
                    />
                  </div>

                  {modalShowCustomColor && (
                    <div style={{ marginTop: 8 }}>
                      <input
                        type="color"
                        value={modalThemeColor}
                        onChange={(e) => {
                          const value = e.target.value;
                          setModalThemeColor(value);
                          // se não for uma das fixas, vira a cor custom da 5ª bolinha
                          if (!['#3b82f6', '#8b5cf6', '#ec4899', '#22c55e'].includes(value)) {
                            setModalCustomThemeColor(value);
                          }
                        }}
                        style={{
                          width: 40,
                          height: 40,
                          padding: 0,
                          border: "none",
                          borderRadius: 8,
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {modalError && (
                <p
                  className="finlann-settings-profile-subtitle"
                  style={{ fontSize: 12, color: "#b91c1c" }}
                >
                  {modalError}
                </p>
              )}
            </div>

            <div className="finlann-modal__footer finlann-modal__footer--split">
              <button
                type="button"
                className="finlann-modal__secondary"
                onClick={closeAccountModal}
              >
                Cancelar
              </button>
              {accountModalMode === "create" && (
                  <button
                    type="button"
                    className="finlann-modal__primary"
                    onClick={async () => {
                      // zera flags
                      setModalEmailError(false);
                      setModalFirstNameError(false);
                      setModalLastNameError(false);
                      setModalUserError(false);
                      setModalPasswordErrorFlag(false);
                      setModalConfirmPasswordError(false);
                      setModalError("");

                      let hasError = false;

                      if (!modalEmail || !modalEmail.includes("@")) {
                        setModalEmailError(true);
                        hasError = true;
                      }
                      if (!modalFirstName) {
                        setModalFirstNameError(true);
                        hasError = true;
                      }
                      if (!modalLastName) {
                        setModalLastNameError(true);
                        hasError = true;
                      }
                      if (!modalUser) {
                        setModalUserError(true);
                        hasError = true;
                      }

                      if (modalHasPassword) {
                        if (!modalPassword) {
                          setModalPasswordErrorFlag(true);
                          hasError = true;
                        }
                        if (!modalConfirmPassword) {
                          setModalConfirmPasswordError(true);
                          hasError = true;
                        }

                        if (
                          modalPassword &&
                          modalConfirmPassword &&
                          modalPassword !== modalConfirmPassword
                        ) {
                          setModalConfirmPasswordError(true);
                          setModalError("As senhas não coincidem.");
                          hasError = true;
                        }
                      }

                      if (hasError) {
                        return;
                      }

                      try {
                        const account = await createAccount({
                          user_id: modalUser,
                          email: modalEmail,
                          first_name: modalFirstName,
                          last_name: modalLastName,
                          has_password: modalHasPassword,
                          password: modalHasPassword ? modalPassword : null,
                          theme_color: modalThemeColor,
                        });
                        setAndPersistCurrentAccount(account);
                        closeAccountModal();
                      } catch (err) {
                        console.error(err);
                        setModalError(
                          "Não foi possível criar a conta agora. Tente novamente."
                        );
                      }
                    }}
                  >
                    Criar conta
                  </button>
                )}
              {accountModalMode === "login" && (
                <button
                  type="button"
                  className="finlann-modal__primary"
                  onClick={handleLoginSubmit}
                >
                  Entrar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {accountConflict && (
        <div className="finlann-overlay">
          <div className="finlann-overlay__panel">
            <header className="finlann-modal__header">
              <p className="finlann-modal__eyebrow">Conta Finlann</p>
              <h2 className="finlann-modal__title">Qual dado usar?</h2>
            </header>
            <div className="finlann-modal__body">
              {accountConflict?.emptyRemote ? (
                <>
                  <p className="finlann-settings-profile-subtitle">
                    Sua conta Finlann está vazia, mas este dispositivo já tem dados.
                  </p>
                  <p className="finlann-settings-profile-subtitle" style={{ marginTop: 8 }}>
                    O que você quer fazer?
                  </p>
                </>
              ) : (
                <>
                  <p className="finlann-settings-profile-subtitle">
                    Encontramos dados neste dispositivo <strong>e</strong> na sua conta Finlann.
                  </p>
                  <p className="finlann-settings-profile-subtitle" style={{ marginTop: 8 }}>
                    Escolha qual fonte quer usar agora:
                  </p>
                </>
              )}
            </div>
            <div className="finlann-modal__footer finlann-modal__footer--split">
              {!accountConflict?.emptyRemote && (
                <button
                  type="button"
                  className="finlann-modal__secondary"
                  onClick={() => {
                    if (accountConflict.remoteState && onSyncState) {
                      onSyncState(accountConflict.remoteState);
                    }
                    setAccountConflict(null);
                  }}
                >
                  Usar dados da conta
                </button>
              )}
              {accountConflict?.emptyRemote && (
                <button
                  type="button"
                  className="finlann-modal__secondary"
                  onClick={() => {
                    onResetState?.();
                    setAccountConflict(null);
                  }}
                >
                  Começar do zero
                </button>
              )}
              <button
                type="button"
                className="finlann-modal__primary"
                onClick={async () => {
                  try {
                    await saveStateToBackend(financeState, currentAccount?.user_id);
                  } catch (e) {
                    console.warn("[Finlann] Erro ao salvar estado local após conflito:", e);
                  }
                  setAccountConflict(null);
                }}
              >
                Usar dados deste dispositivo
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditAccountModal && (
        <div className="finlann-overlay">
          <div
            className="finlann-overlay__panel"
            style={{
              border: `1.5px solid ${editThemeColor}`,
              backgroundImage: `linear-gradient(135deg, #020617 0%, #020617 20%, ${editThemeColor}22 60%, ${editThemeColor}44 100%)`,
            }}
          >
            <header className="finlann-modal__header">
              <p className="finlann-modal__eyebrow">Conta Finlann</p>
              <h2 className="finlann-modal__title">Editar conta</h2>
              <button
                type="button"
                className="finlann-modal__close"
                onClick={() => setShowEditAccountModal(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>

            <div className="finlann-modal__body finlann-modal__body--scroll">
              {/* Avatar com iniciais */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <span
                  className="finlann-settings-avatar__circle finlann-settings-avatar__circle--large"
                  style={{ width: 64, height: 64, fontSize: 26, background: editThemeColor }}
                >
                  {`${(editFirstName || "?")[0]}${(editLastName || "")[0] || ""}`.toUpperCase()}
                </span>
              </div>

              {/* Nome + Sobrenome */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label className="finlann-login-label">NOME</label>
                  <input
                    type="text"
                    className="finlann-field__input"
                    placeholder="Nome"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="finlann-login-label">SOBRENOME</label>
                  <input
                    type="text"
                    className="finlann-field__input"
                    placeholder="Sobrenome"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                  />
                </div>
              </div>

              {/* E-mail */}
              <div style={{ marginBottom: 12 }}>
                <label className="finlann-login-label">E-MAIL</label>
                <input
                  type="email"
                  className="finlann-field__input"
                  placeholder="seu@email.com"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>

              {/* Nome da conta (read-only) */}
              <div style={{ marginBottom: 16 }}>
                <label className="finlann-login-label">NOME DA CONTA</label>
                <input
                  type="text"
                  className="finlann-field__input"
                  value={currentAccount?.user_id || ""}
                  disabled
                  style={{ opacity: 0.45, cursor: "not-allowed" }}
                />
                <p style={{ fontSize: 11, color: "rgba(148,163,184,0.5)", marginTop: 3 }}>
                  O nome da conta não pode ser alterado.
                </p>
              </div>

              {/* Nova senha */}
              <div style={{ marginBottom: 12 }}>
                <label className="finlann-login-label">
                  NOVA SENHA{" "}
                  <span style={{ opacity: 0.5, fontWeight: 400 }}>(opcional)</span>
                </label>
                <div className="finlann-login-password-row">
                  <input
                    type={editShowNewPassword ? "text" : "password"}
                    className="finlann-field__input"
                    placeholder="Deixe em branco para não alterar"
                    value={editNewPassword}
                    onChange={(e) => setEditNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="finlann-login-eye-btn"
                    onClick={() => setEditShowNewPassword((p) => !p)}
                    tabIndex={-1}
                  >
                    <img src={editShowNewPassword ? eyeClosed : eyeOpen} alt="" style={{ width: 18, height: 18 }} />
                  </button>
                </div>
              </div>

              {editNewPassword && (
                <div style={{ marginBottom: 16 }}>
                  <label className="finlann-login-label">CONFIRMAR NOVA SENHA</label>
                  <div className="finlann-login-password-row">
                    <input
                      type={editShowConfirmPassword ? "text" : "password"}
                      className="finlann-field__input"
                      placeholder="Repita a nova senha"
                      value={editConfirmNewPassword}
                      onChange={(e) => setEditConfirmNewPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="finlann-login-eye-btn"
                      onClick={() => setEditShowConfirmPassword((p) => !p)}
                      tabIndex={-1}
                    >
                      <img src={editShowConfirmPassword ? eyeClosed : eyeOpen} alt="" style={{ width: 18, height: 18 }} />
                    </button>
                  </div>
                </div>
              )}

              {/* Cor da conta */}
              <div style={{ marginBottom: 16 }}>
                <label className="finlann-login-label">COR DA CONTA</label>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  {["#3b82f6", "#8b5cf6", "#ec4899", "#22c55e", "#f97316", "#0ea5e9"].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setEditThemeColor(color)}
                      style={{
                        width: 26, height: 26, borderRadius: "50%",
                        backgroundColor: color,
                        border: editThemeColor === color ? "2.5px solid #fff" : "2px solid transparent",
                        cursor: "pointer", padding: 0,
                        transition: "transform 0.15s",
                        transform: editThemeColor === color ? "scale(1.2)" : "scale(1)",
                      }}
                    />
                  ))}
                </div>
              </div>

              {editError && (
                <p style={{ fontSize: 12, color: "#f87171", marginBottom: 8 }}>{editError}</p>
              )}
              {editSuccess && (
                <p style={{ fontSize: 12, color: "#4ade80", marginBottom: 8 }}>
                  ✓ Conta atualizada com sucesso!
                </p>
              )}
            </div>

            <div className="finlann-modal__footer finlann-modal__footer--split">
              <button
                type="button"
                className="finlann-modal__secondary"
                onClick={() => setShowEditAccountModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="finlann-modal__primary"
                style={editSaving ? undefined : { background: editThemeColor }}
                disabled={editSaving}
                onClick={async () => {
                  setEditError("");
                  setEditSuccess(false);

                  if (editNewPassword && editNewPassword !== editConfirmNewPassword) {
                    setEditError("As senhas não coincidem.");
                    return;
                  }

                  setEditSaving(true);
                  try {
                    const updates = {
                      first_name: editFirstName.trim(),
                      last_name: editLastName.trim(),
                      email: editEmail.trim(),
                      theme_color: editThemeColor,
                    };
                    if (editNewPassword) {
                      updates.has_password = true;
                      updates.password = editNewPassword;
                    }
                    const updated = await updateAccount(currentAccount.user_id, updates);
                    setAndPersistCurrentAccount(updated);
                    setEditSuccess(true);
                    setTimeout(() => setShowEditAccountModal(false), 1200);
                  } catch (err) {
                    console.error("[Finlann] Erro ao atualizar conta:", err);
                    setEditError("Não foi possível salvar. Tente novamente.");
                  } finally {
                    setEditSaving(false);
                  }
                }}
              >
                {editSaving ? "Salvando…" : "Salvar alterações"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="finlann-overlay">
          <div className="finlann-overlay__panel">
            <header className="finlann-modal__header">
              <p className="finlann-modal__eyebrow">Conta Finlann</p>
              <h2 className="finlann-modal__title">Sair da conta</h2>
            </header>
            <div className="finlann-modal__body">
              <p className="finlann-settings-profile-subtitle">
                Deseja sair da conta Finlann atual?
              </p>
            </div>
            <div className="finlann-modal__footer finlann-modal__footer--split">
              <button
                type="button"
                className="finlann-modal__secondary"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="finlann-modal__primary finlann-modal__primary--danger"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogoutAccount?.();
                }}
              >
                Sair da conta
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

