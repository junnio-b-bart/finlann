import { useState } from "react";

import "../styles/globals.css";
import "../styles/tokens.css";
import "../styles/finlann.css";

import { exportState, normalizeState } from "../data/finance.sync.js";
import googleLogo from "../assets/Google_G_logo.png";
import { isGoogleConfigured, isLoggedInToGoogle, getCurrentGoogleUser, loginWithGoogle, logoutFromGoogle, syncWithGoogleDrive, loadRemoteStateFromDrive } from "../data/googleDriveClient.js";
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

  // Modal de conta Finlann (abrir/entrar)
  const [accountModalMode, setAccountModalMode] = useState(null); // "create" | "login" | null
  const [modalHouseholdId, setModalHouseholdId] = useState("");
  const [modalPin, setModalPin] = useState("");
  const [modalFirstName, setModalFirstName] = useState("");
  const [modalLastName, setModalLastName] = useState("");
  const [modalShowPassword, setModalShowPassword] = useState(false);
  const [modalPasswordStrength, setModalPasswordStrength] = useState("none"); // none | weak | medium | strong
  const [modalPasswordError, setModalPasswordError] = useState("");
  const [modalConfirmPin, setModalConfirmPin] = useState("");
  const [modalConfirmError, setModalConfirmError] = useState("");
  const [modalConfirmTouched, setModalConfirmTouched] = useState(false);
  const [modalColor, setModalColor] = useState("#4F46E5");
  const [modalCustomColor, setModalCustomColor] = useState(null);
  const [modalShowCustomColor, setModalShowCustomColor] = useState(false);

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

  function openAccountModal(mode) {
    setAccountModalMode(mode);
    setModalFirstName("");
    setModalLastName("");
    setModalHouseholdId("");
    setModalPin("");
    setModalShowPassword(false);
    setModalPasswordStrength("none");
    setModalPasswordError("");
    setModalConfirmPin("");
    setModalConfirmError("");
    setModalConfirmTouched(false);
  }

  function closeAccountModal() {
    setAccountModalMode(null);
    setModalFirstName("");
    setModalLastName("");
    setModalPin("");
    setModalShowPassword(false);
    setModalPasswordStrength("none");
    setModalPasswordError("");
    setModalConfirmPin("");
    setModalConfirmError("");
    setModalConfirmTouched(false);
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
            <p className="finlann-settings-profile-name">Finlann</p>
            <p className="finlann-settings-profile-subtitle">
              Abra ou acesse uma conta Finlann para sincronizar seus dados.
            </p>
          </div>
        </div>

        <div className="finlann-settings-actions-bar">
          <button
            type="button"
            className="finlann-chip finlann-chip--outline finlann-settings-actions-bar__left"
            style={{ flex: 0.6 }}
            onClick={() => openAccountModal("login")}
          >
            Entrar
          </button>
          <button
            type="button"
            className="finlann-chip finlann-chip--outline finlann-settings-actions-bar__right"
            style={{ flex: 0.4 }}
            onClick={() => openAccountModal("create")}
          >
            Criar conta
          </button>
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
                    border: `2px solid ${modalColor}`,
                    backgroundImage: `linear-gradient(135deg, #020617 0%, #020617 20%, ${modalColor}33 50%, ${modalColor}80 100%)`,
                  }
                : {
                    border: "1px solid rgba(148, 163, 184, 0.25)",
                    backgroundColor: "#020617",
                  }
            }
          >
            <header className="finlann-modal__header">
              <p className="finlann-modal__eyebrow">
                {accountModalMode === "create" ? "Nova conta" : "Entrar em conta"}
              </p>
              <h2 className="finlann-modal__title">
                {accountModalMode === "create" ? "Criar conta Finlann" : "Fazer login na conta Finlann"}
              </h2>
            </header>

            <div className="finlann-modal__body">
              {accountModalMode === "create" && (
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label className="finlann-settings-profile-subtitle" style={{ marginBottom: 4, display: "block" }}>
                      NOME
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
                    <label className="finlann-settings-profile-subtitle" style={{ marginBottom: 4, display: "block" }}>
                      SOBRENOME
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
              )}

              <div style={{ marginBottom: 12 }}>
                <label className="finlann-settings-profile-subtitle" style={{ marginBottom: 4, display: "block" }}>
                  USUÁRIO
                </label>
                <input
                  type="text"
                  className="finlann-field__input"
                  placeholder="Nome da conta"
                  value={modalHouseholdId}
                  onChange={(e) => setModalHouseholdId(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label className="finlann-settings-profile-subtitle" style={{ marginBottom: 4, display: "block" }}>
                  SENHA
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 260 }}>
                  <input
                    type={modalShowPassword ? "text" : "password"}
                    className="finlann-field__input"
                    placeholder="Senha"
                    value={modalPin}
                    onChange={(e) => {
                      const value = e.target.value;
                      setModalPin(value);
                      const len = value.length;
                      const hasLetter = /[A-Za-z]/.test(value);
                      const hasNumber = /[0-9]/.test(value);

                      let strength = "none";
                      if (len > 0 && len <= 4) {
                        strength = "weak";
                      } else if (len >= 5 && len <= 7) {
                        strength = "medium";
                      } else if (len >= 8) {
                        // só consideramos forte quando tem letra E número
                        strength = hasLetter && hasNumber ? "strong" : "medium";
                      }

                      setModalPasswordStrength(strength);
                      setModalPasswordError("");
                    }}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => setModalShowPassword((prev) => !prev)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 999,
                      border: "1px solid rgba(148, 163, 184, 0.4)",
                      background: "rgba(15, 23, 42, 0.95)",
                      color: "#e5e7eb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      fontSize: 14,
                      padding: 0,
                    }}
                    aria-label={modalShowPassword ? "Esconder senha" : "Mostrar senha"}
                  >
                    <div style={{ position: "relative", width: 18, height: 12 }}>
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          borderRadius: 999,
                          border: "2px solid rgba(148, 163, 184, 0.9)",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          top: "50%",
                          left: "50%",
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          transform: "translate(-50%, -50%)",
                          backgroundColor: "rgba(148, 163, 184, 0.9)",
                        }}
                      />
                      {!modalShowPassword && (
                        <div
                          style={{
                            position: "absolute",
                            left: -2,
                            right: -2,
                            top: "50%",
                            height: 2,
                            backgroundColor: "rgba(148, 163, 184, 0.9)",
                            transform: "rotate(-35deg)",
                            transformOrigin: "center",
                          }}
                        />
                      )}
                    </div>
                  </button>
                </div>

                {accountModalMode === "create" && (
                  <div>
                    <div style={{ marginTop: 10 }}>
                      <div
                        style={{
                          display: "flex",
                          gap: 4,
                          marginBottom: 2,
                          width: "75%",
                          maxWidth: 195, // 75% de 260px (largura do container da senha)
                          marginLeft: 3,
                        }}
                      >
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
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <p className="finlann-settings-profile-subtitle" style={{ fontSize: 12 }}>
                        Requisitos: pelo menos 8 caracteres, com pelo menos uma letra e um número.
                      </p>
                      {modalPasswordError && (
                        <p className="finlann-settings-profile-subtitle" style={{ fontSize: 12, color: "#b91c1c" }}>
                          {modalPasswordError}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirmar senha só na criação e cor */}
              {accountModalMode === "create" && (
                <div>
                  <div style={{ marginBottom: 12 }}>
                  <label
                    className="finlann-settings-profile-subtitle"
                    style={{ marginBottom: 4, display: "block" }}
                  >
                    CONFIRMAR SENHA
                  </label>
                  <input
                    type={modalShowPassword ? "text" : "password"}
                    className="finlann-field__input"
                    placeholder="Repita a senha"
                    value={modalConfirmPin}
                    onChange={(e) => {
                      setModalConfirmPin(e.target.value);
                      setModalConfirmError("");
                      setModalConfirmTouched(false);
                    }}
                    onBlur={() => {
                      const value = (modalConfirmPin || "").trim();
                      const original = (modalPin || "").trim();
                      if (!value) {
                        setModalConfirmTouched(false);
                        setModalConfirmError("");
                        return;
                      }
                      setModalConfirmTouched(true);
                      if (value !== original) {
                        setModalConfirmError("As senhas não coincidem.");
                      } else {
                        setModalConfirmError("");
                      }
                    }}
                    style={{ maxWidth: 260 }}
                  />

                  {/* bolinha de status da confirmação */}
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 999,
                      marginTop: 8,
                      border: modalConfirmTouched ? "none" : "1px solid #4b5563",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {modalConfirmTouched && !modalConfirmError && (
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 999,
                          backgroundColor: "#22c55e", // verde
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#020617",
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        ✓
                      </div>
                    )}
                    {modalConfirmTouched && modalConfirmError && (
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 999,
                          backgroundColor: "#ef4444", // vermelho
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#020617",
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        ×
                      </div>
                    )}
                  </div>

                  {modalConfirmError && (
                    <p
                      className="finlann-settings-profile-subtitle"
                      style={{ fontSize: 12, color: "#b91c1c", marginTop: 4 }}
                    >
                      {modalConfirmError}
                    </p>
                  )}
                </div>

                {/* Foto ou cor da conta (isolada temporariamente) */}
                {false && (
                  <div style={{ marginBottom: 12 }}>
                    <label
                      className="finlann-settings-profile-subtitle"
                      style={{ marginBottom: 4, display: "block" }}
                    >
                      Foto ou cor da conta
                    </label>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <button
                        type="button"
                        className={`finlann-chip ${"finlann-chip--solid"}`}
                      >
                        Cor
                      </button>
                      <button
                        type="button"
                        className={`finlann-chip ${"finlann-chip--outline"}`}
                      >
                        Foto (em breve)
                      </button>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {["#4F46E5", "#EC4899", "#22C55E", "#0EA5E9"].map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => {
                            setModalColor(color);
                            setModalShowCustomColor(false);
                          }}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            border:
                              modalColor === color ? "2px solid #111827" : "1px solid #E5E7EB",
                            backgroundColor: color,
                            padding: 0,
                            cursor: "pointer",
                          }}
                        />
                      ))}

                      {/* 5º quadradinho com cor customizada, se existir */}
                      <button
                        type="button"
                        onClick={() => {
                          if (!modalCustomColor) return;
                          setModalColor(modalCustomColor);
                          setModalShowCustomColor(false);
                        }}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          border: modalCustomColor
                            ? "2px solid #e5e7eb"
                            : "1px dashed #4b5563",
                          backgroundColor: modalCustomColor || "transparent",
                          padding: 0,
                          cursor: modalCustomColor ? "pointer" : "default",
                        }}
                      />

                      {/* Botão de cor personalizada (bolinha colorida) */}
                      <button
                        type="button"
                        onClick={() => setModalShowCustomColor((prev) => !prev)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "999px",
                          border: modalShowCustomColor
                            ? "2px solid #111827"
                            : "1px solid #E5E7EB",
                          backgroundImage:
                            "conic-gradient(from 180deg, #EF4444, #F97316, #FACC15, #22C55E, #0EA5E9, #6366F1, #EC4899, #EF4444)",
                          padding: 0,
                          cursor: "pointer",
                        }}
                      />
                    </div>

                    {modalShowCustomColor && (
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                        <input
                          type="color"
                          value={modalColor}
                          onChange={(e) => {
                            const value = e.target.value;
                            setModalColor(value);
                            if (!['#4F46E5', '#EC4899', '#22C55E', '#0EA5E9'].includes(value)) {
                              setModalCustomColor(value);
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
                        <span
                          className="finlann-settings-profile-subtitle"
                          style={{ fontSize: 12 }}
                        >
                          Essa cor será usada como destaque visual para esta conta.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              )}
            </div>

            {false && (
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
                      onClick={() => {
                        const value = (modalPin || "").trim();
                        const hasMinLength = value.length >= 8;
                        const hasLetter = /[A-Za-z]/.test(value);
                        const hasNumber = /[0-9]/.test(value);

                        if (!hasMinLength || !hasLetter || !hasNumber) {
                          setModalPasswordError(
                            "A senha precisa ter pelo menos 8 caracteres, com pelo menos uma letra e um número."
                          );
                          return;
                        }

                        if ((modalConfirmPin || "").trim() !== value) {
                          setModalConfirmError("As senhas não coincidem.");
                          return;
                        }

                        // salvamento real virá nas próximas partes
                        closeAccountModal();
                      }}
                    >
                      Criar conta
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
