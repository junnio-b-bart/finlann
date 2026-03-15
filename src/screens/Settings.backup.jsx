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

      {/* Card de perfil + Google + Sync */}
      <section className="finlann-section">
        <header className="finlann-section__header">
          <h2 className="finlann-section__title">Conta e sincronização</h2>
        </header>

        <div className="finlann-settings-profile-row">
          <div className="finlann-settings-avatar">
            {user?.picture ? (
              <img
                src={user.picture}
                alt={user.name || "Conta Google"}
                className="finlann-settings-avatar__img"
              />
            ) : (
              <span className="finlann-settings-avatar__circle finlann-settings-avatar__circle--large">
                {(user?.name || "F").charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="finlann-settings-profile-text">
            <p className="finlann-settings-profile-name">
              {user?.name || "Finlann"}
            </p>
            <p className="finlann-settings-profile-subtitle">
              {loggedIn
                ? user?.email || "Conta conectada ao Google Drive"
                : "Conecte com o Google para sincronizar seus dados no Drive"}
            </p>
          </div>
        </div>

        <div className="finlann-settings-actions-bar">
          <button
            type="button"
            className="finlann-chip finlann-chip--outline finlann-settings-actions-bar__left"
            onClick={handleLoginClick}
          >
            <img src={googleLogo} alt="Google" className="finlann-google-mark" />
            <span>{loggedIn ? "Sair da conta Google" : "Logar com Google"}</span>
          </button>
          <button
            type="button"
            className="finlann-settings-sync-button finlann-settings-actions-bar__right"
            title={loggedIn ? "Sincronizar com Google Drive" : "Conecte ao Google para sincronizar"}
            onClick={loggedIn ? handleSyncClick : undefined}
            disabled={!loggedIn}
          >
            ⟳
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
    </div>
  );
}
