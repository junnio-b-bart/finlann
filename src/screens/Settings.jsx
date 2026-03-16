import { useState } from "react";
import "../styles/globals.css";
import "../styles/tokens.css";
import "../styles/finlann.css";

import { exportState, normalizeState } from "../data/finance.sync.js";
import googleLogo from "../assets/Google_G_logo.png";
import { isGoogleConfigured, isLoggedInToGoogle, getCurrentGoogleUser, loginWithGoogle, logoutFromGoogle, syncWithGoogleDrive, loadRemoteStateFromDrive } from "../data/googleDriveClient.js";
import { createAccount, loginAccount, loadStateFromBackend, saveStateToBackend } from "../data/finlannBackendClient.js";
import SettingsCards from "./SettingsCards.jsx";
import SettingsNotifications from "./SettingsNotifications.jsx";

export default function Settings({
  financeState,
  view,
  onChangeView,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onSyncState,
  onResetState,
  onGoogleStatusToast,
}) {
  const exported = exportState(financeState);

  const googleReady = isGoogleConfigured();
  const [googleSession, setGoogleSession] = useState(() => ({
    loggedIn: isLoggedInToGoogle(),
    user: getCurrentGoogleUser(),
  }));

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

  const loggedIn = googleSession.loggedIn;
  const user = googleSession.user;

  async function handleLoginClick() {
    if (loggedIn) {
      const confirmed = window.confirm("Deseja sair da conta Google conectada ao Finlann?");
      if (!confirmed) return;
      await logoutFromGoogle();
      setGoogleSession({ loggedIn: false, user: null });
      onGoogleStatusToast?.("logout-success");
      return;
    }

    try {
      await loginWithGoogle();

      // Depois do login, buscamos o estado remoto e decidimos o que fazer
      await handlePostLoginStateDecision();
      onGoogleStatusToast?.("login-success");
    } catch (err) {
      console.error("[Finlann] Erro no login com Google:", err);
      onGoogleStatusToast?.("login-error");
      alert("Não foi possível conectar ao Google. Tente novamente.");
    }
  }

  async function handleSyncClick() {
    try {
      const merged = await syncWithGoogleDrive(financeState);
      console.log("[Finlann] Estado sincronizado (merge remoto+local)", merged);

      if (onSyncState) {
        onSyncState(merged);
      }

      alert("Sincronização com Google Drive concluída.");
    } catch (err) {
      console.error("[Finlann] Erro ao sincronizar com Google Drive:", err);
      alert("Não foi possível sincronizar com o Google Drive. Verifique o login e tente de novo.");
    }
  }

  // Decide como tratar o estado local x remoto logo após o login
  async function handlePostLoginStateDecision() {
    // Atualiza sessão visual
    setGoogleSession({
      loggedIn: true,
      user: getCurrentGoogleUser(),
    });

    const remote = await loadRemoteStateFromDrive();
    const local = normalizeState(financeState);

    const localIsEmpty =
      (local.cards?.length || 0) === 0 &&
      (local.expenses?.length || 0) === 0 &&
      (local.incomes?.length || 0) === 0;

    if (!remote) {
      // Nada no Drive ainda → mantém só o local; primeiro sync vai criar o arquivo
      alert("Conectado ao Google Drive. Ainda não há dados na conta, o estado atual deste dispositivo será usado no próximo sync.");
      return;
    }

    if (localIsEmpty) {
      // App vazio → simplesmente carregar tudo do Drive
      if (onSyncState) {
        onSyncState(remote);
      }
      alert("Dados da sua conta Google foram carregados neste dispositivo.");
      return;
    }

    // Temos dados locais e remotos → perguntar o que fazer
    const choice = window.prompt(
      "Encontramos dados neste dispositivo e também na sua conta Google.\n" +
        "Digite: \n" +
        "1 - Limpar este app e usar apenas os dados da conta Google\n" +
        "2 - Juntar (mesclar) os dados locais com os da conta Google\n" +
        "3 - Cancelar (não alterar nada agora)",
      "2"
    );

    if (choice === "1") {
      // Limpa app e usa só o remoto
      if (onSyncState) {
        onSyncState(remote);
      }
      alert("Este dispositivo agora está usando apenas os dados da sua conta Google.");
      return;
    }

    if (choice === "2") {
      // Usa fluxo normal de sync (merge remoto+local + grava no Drive)
      try {
        const merged = await syncWithGoogleDrive(financeState);
        if (onSyncState) {
          onSyncState(merged);
        }
        alert("Dados locais e da conta Google foram mesclados.");
      } catch (err) {
        console.error("[Finlann] Erro ao mesclar dados locais e remotos após login:", err);
        alert("Não foi possível mesclar os dados com o Google Drive agora. Tente o sync manual depois.");
      }
      return;
    }

    // Qualquer outra coisa (3, cancelar, ESC) → não altera o estado
    alert("Conexão com Google feita, mas mantivemos o estado local sem alterações.");
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

  return (
    <div className="finlann-dashboard">
      <header className="finlann-header finlann-header--centered">
        <div className="finlann-header__left">
          <h1 className="finlann-section__title">Configurações</h1>
        </div>
      </header>

      {/* Card de Conta Finlann (sem Google) */}
      <section className="finlann-section">
        <header className="finlann-section__header">
          <h2 className="finlann-section__title">Conta</h2>
        </header>

        <div className="finlann-settings-profile-row">
          <div className="finlann-settings-avatar">
            <span className="finlann-settings-avatar__circle finlann-settings-avatar__circle--large">
              F
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
        </div>

        <div
          className="finlann-settings-actions-bar"
          style={currentAccount ? { flexDirection: "column", alignItems: "flex-start", gap: 8 } : undefined}
        >
          {currentAccount && (
            <div className="finlann-settings-actions-row" style={{ width: "100%", gap: 8 }}>
              <button
                type="button"
                className="finlann-chip finlann-chip--outline"
                style={{ width: 260 }}
                onClick={() => {
                  window.alert("Edição de dados da conta ainda não está disponível.");
                }}
              >
                Editar conta
              </button>
              <button
                type="button"
                className="finlann-chip finlann-chip--outline"
                onClick={async () => {
                  try {
                    await saveStateToBackend(financeState, currentAccount.user_id);
                    setShowSyncSuccess(true);
                  } catch (e) {
                    console.error("[Finlann] Erro ao forçar sync com backend:", e);
                    setModalError("Não foi possível sincronizar agora. Tente novamente.");
                  }
                }}
                aria-label="Sincronizar agora"
              >
                ↻
              </button>
            </div>
          )}

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
            <button
              type="button"
              className="finlann-chip finlann-chip--outline finlann-settings-actions-bar__left"
              style={{
                width: 260,
                borderColor: "#f97373",
                color: "#f97373",
              }}
              onClick={() => {
                setShowLogoutConfirm(true);
              }}
            >
              Sair da conta
            </button>
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
                Os dados que já estiverem na sua conta Google (Drive) não serão apagados.
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

            <div className="finlann-settings-actions" style={{ marginTop: 8 }}>
              <div className="finlann-settings-actions-row">
                <button
                  type="button"
                  className="finlann-chip finlann-chip--outline"
                  onClick={() => {
                    setEraseConfirmation("");
                    setShowEraseModal(false);
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="finlann-chip finlann-chip--solid finlann-chip--accent"
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
                {accountModalMode === "create" ? "Nova conta" : "Fazer login na conta Finlann"}
              </h2>
            </header>

            <div className="finlann-modal__body">
              {accountModalMode === "create" && (
                <>
                  <div style={{ marginBottom: 12 }}>
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

              <div style={{ marginBottom: 12 }}>
                <label
                  className="finlann-settings-profile-subtitle"
                  style={{ marginBottom: 4, display: "block" }}
                >
                  USUÁRIO
                  {modalUserError && (
                    <span style={{ color: "#ef4444", marginLeft: 4 }}>*</span>
                  )}
                </label>
                <input
                  type="text"
                  className="finlann-field__input"
                  placeholder="Nome da conta"
                  value={modalUser}
                  onChange={(e) => setModalUser(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label
                  className="finlann-settings-profile-subtitle"
                  style={{ marginBottom: 4, display: "block" }}
                >
                  <input
                    type="checkbox"
                    checked={modalHasPassword}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setModalHasPassword(checked);
                      if (!checked) {
                        setModalPassword("");
                        setModalConfirmPassword("");
                        setModalPasswordStrength("none");
                        setModalPasswordErrorFlag(false);
                        setModalConfirmPasswordError(false);
                      }
                    }}
                    style={{
                      width: 16,
                      height: 16,
                      marginRight: 8,
                      verticalAlign: "middle",
                    }}
                  />
                  SENHA
                  {modalHasPassword && modalPasswordErrorFlag && (
                    <span style={{ color: "#ef4444", marginLeft: 4 }}>*</span>
                  )}
                </label>

                {modalHasPassword && (
                  <>
                    <input
                      type="password"
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
                    />

                    {/* Força da senha (só na criação) */}
                    {accountModalMode === "create" && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: "flex", gap: 4, marginBottom: 2, width: "75%", maxWidth: 195 }}>
                          {[0, 1, 2].map((index) => {
                            let active = false;
                            if (modalPasswordStrength === "weak") active = index === 0;
                            if (modalPasswordStrength === "medium") active = index <= 1;
                            if (modalPasswordStrength === "strong") active = index <= 2;

                            let color = "#E5E7EB";
                            if (active) {
                              if (modalPasswordStrength === "weak") color = "#b91c1c";
                              if (modalPasswordStrength === "medium") color = "#f59e0b";
                              if (modalPasswordStrength === "strong") color = "#16a34a";
                            }

                            return (
                              <div
                                key={index}
                                style={{
                                  flex: 1,
                                  height: 6,
                                  borderRadius: 999,
                                  backgroundColor: color,
                                }}
                              />
                            );
                          })}
                        </div>
                        {modalPasswordStrength !== "none" && (
                          <p
                            className="finlann-settings-profile-subtitle"
                            style={{
                              fontSize: 12,
                              color:
                                modalPasswordStrength === "weak"
                                  ? "#b91c1c"
                                  : modalPasswordStrength === "medium"
                                  ? "#b45309"
                                  : "#15803d",
                            }}
                          >
                            {modalPasswordStrength === "weak" && "Senha fraca"}
                            {modalPasswordStrength === "medium" && "Senha média"}
                            {modalPasswordStrength === "strong" && "Senha forte"}
                          </p>
                        )}
                        <p className="finlann-settings-profile-subtitle" style={{ fontSize: 12, marginTop: 8 }}>
                          Requisitos: pelo menos 8 caracteres, com pelo menos uma letra e um número.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {modalHasPassword && (
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
                  <input
                    type="password"
                    className="finlann-field__input"
                    placeholder="Repita a senha"
                    value={modalConfirmPassword}
                    onChange={(e) => setModalConfirmPassword(e.target.value)}
                  />
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

            <div className="finlann-settings-actions" style={{ marginTop: 8 }}>
              <div className="finlann-settings-actions-row">
                <button
                  type="button"
                  className="finlann-chip finlann-chip--outline"
                  onClick={closeAccountModal}
                >
                  Cancelar
                </button>
                {accountModalMode === "create" && (
                  <button
                    type="button"
                    className="finlann-chip finlann-chip--solid finlann-chip--accent"
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
                    className="finlann-chip finlann-chip--solid finlann-chip--accent"
                    onClick={async () => {
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
                            const choice = window.prompt(
                              "Sua conta Finlann está vazia, mas este dispositivo já tem dados.\n" +
                                "Digite:\n" +
                                "1 - Limpar este app e começar uma conta zerada\n" +
                                "2 - Usar apenas os dados deste dispositivo",
                              "2"
                            );

                            if (choice === "1") {
                              onResetState?.();
                            }
                            // escolha "2" mantém o estado local; autosave depois sobe para a conta
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
                    }}
                  >
                    Entrar
                  </button>
                )}
              </div>
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
              <p className="finlann-settings-profile-subtitle">
                Encontramos dados neste dispositivo <strong>e</strong> na sua conta Finlann.
              </p>
              <p className="finlann-settings-profile-subtitle" style={{ marginTop: 8 }}>
                Escolha qual fonte quer usar agora:
              </p>
            </div>
            <div className="finlann-settings-actions" style={{ marginTop: 8 }}>
              <div className="finlann-settings-actions-row">
                <button
                  type="button"
                  className="finlann-chip finlann-chip--outline"
                  onClick={() => {
                    // usar apenas os dados da conta
                    if (accountConflict.remoteState && onSyncState) {
                      onSyncState(accountConflict.remoteState);
                    }
                    setAccountConflict(null);
                  }}
                >
                  Usar dados da conta
                </button>
                <button
                  type="button"
                  className="finlann-chip finlann-chip--solid finlann-chip--accent"
                  onClick={async () => {
                    // manter apenas os dados deste dispositivo; autosave já atualiza a conta,
                    // mas forçamos um save agora para garantir
                    try {
                      await saveStateToBackend(financeState, currentAccount?.user_id);
                    } catch (e) {
                      console.warn("[Finlann] Erro ao salvar estado local como fonte principal após conflito:", e);
                    }
                    setAccountConflict(null);
                  }}
                >
                  Usar dados deste dispositivo
                </button>
              </div>
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
            <div className="finlann-settings-actions" style={{ marginTop: 8 }}>
              <div className="finlann-settings-actions-row">
                <button
                  type="button"
                  className="finlann-chip finlann-chip--outline"
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="finlann-chip finlann-chip--solid finlann-chip--accent"
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    onResetState?.();
                    setAndPersistCurrentAccount(null);
                    try {
                      if (typeof window !== "undefined") {
                        window.localStorage.removeItem("finlann.currentAccount");
                        window.localStorage.removeItem("finlann.householdId");
                        window.localStorage.removeItem("finlann-state-v1");
                      }
                    } catch {}
                  }}
                >
                  Sair da conta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
