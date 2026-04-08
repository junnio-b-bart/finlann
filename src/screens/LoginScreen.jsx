import { useState } from "react";
import logoFinlann from "../assets/logo-f-mark.png";
import eyeOpen from "../assets/icons/4.png";
import eyeClosed from "../assets/icons/3.png";
import { createAccount, loginAccount, loadStateFromBackend } from "../data/finlannBackendClient.js";
import "../styles/globals.css";
import "../styles/tokens.css";
import "../styles/finlann.css";

const LAST_PROFILE_KEY = "finlann.lastProfile";

function readStoredProfile() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function buildProfile(account) {
  if (!account) return null;
  return {
    user_id: account.user_id || "",
    first_name: account.first_name || "",
    last_name: account.last_name || "",
    has_password: !!account.has_password,
    theme_color: account.theme_color || "#3b82f6",
  };
}

function getProfileInitials(profile) {
  if (!profile) return "FL";
  const fromNames = `${profile.first_name || ""} ${profile.last_name || ""}`
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (fromNames.length > 0) {
    return fromNames
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
  }
  const raw = (profile.user_id || "FL").replace(/[^a-zA-Z0-9]/g, "");
  return raw.slice(0, 2).toUpperCase() || "FL";
}

function persistAccount(account) {
  if (typeof window === "undefined" || !account) return;
  try {
    window.localStorage.setItem("finlann.currentAccount", JSON.stringify(account));
    if (account.user_id) {
      window.localStorage.setItem("finlann.householdId", account.user_id);
    }
    const profile = buildProfile(account);
    if (profile?.user_id) {
      window.localStorage.setItem(LAST_PROFILE_KEY, JSON.stringify(profile));
    }
  } catch {
    // ignore
  }
}

export default function LoginScreen({ onLoginSuccess, onContinueWithoutAccount }) {
  // "welcome" | "login" | "register" | "quick"
  const [view, setView] = useState("welcome");
  const [savedProfile, setSavedProfile] = useState(() => readStoredProfile());

  // campos compartilhados
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // campos exclusivos do cadastro
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [themeColor, setThemeColor] = useState("#3b82f6");

  // flags de erro de campo
  const [fieldErrors, setFieldErrors] = useState({});

  const profileDisplayName = savedProfile?.first_name
    ? `${savedProfile.first_name}${savedProfile.last_name ? ` ${savedProfile.last_name}` : ""}`
    : savedProfile?.user_id || "";
  const hasSavedProfile = !!savedProfile?.user_id;
  const profileInitials = getProfileInitials(savedProfile);

  function resetForm() {
    setUser("");
    setPassword("");
    setConfirmPassword("");
    setFirstName("");
    setLastName("");
    setEmail("");
    setError("");
    setFieldErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
    setHasPassword(false);
    setThemeColor(savedProfile?.theme_color || "#3b82f6");
  }

  function goTo(nextView) {
    resetForm();
    if (nextView === "login" && savedProfile?.user_id) {
      setUser(savedProfile.user_id);
    }
    setView(nextView);
  }

  async function finalizeLogin(account) {
    persistAccount(account);
    setSavedProfile(buildProfile(account));

    let remoteState = null;
    try {
      remoteState = await loadStateFromBackend(account.user_id);
    } catch {
      // app cai para estado vazio no App quando remote nao estiver disponivel
    }

    onLoginSuccess(account, remoteState);
  }

  async function handleLogin(e) {
    e?.preventDefault();
    setError("");
    setFieldErrors({});

    if (!user.trim()) {
      setFieldErrors({ user: true });
      return;
    }

    setLoading(true);
    try {
      const account = await loginAccount({ user_id: user.trim(), password: password || null });
      await finalizeLogin(account);
    } catch (err) {
      if (err?.message === "INVALID_CREDENTIALS") {
        setError("Usuario ou senha incorretos.");
      } else {
        setError("Nao foi possivel entrar agora. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickUnlock(e) {
    e?.preventDefault();
    setError("");
    setFieldErrors({});

    if (!savedProfile?.user_id) {
      setError("Nenhum perfil salvo neste dispositivo.");
      return;
    }

    if (savedProfile.has_password && !password) {
      setFieldErrors({ password: true });
      return;
    }

    setLoading(true);
    try {
      const account = await loginAccount({
        user_id: savedProfile.user_id,
        password: savedProfile.has_password ? password : null,
      });
      await finalizeLogin(account);
    } catch (err) {
      if (err?.message === "INVALID_CREDENTIALS") {
        setError("Senha incorreta.");
      } else {
        setError("Nao foi possivel entrar agora. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDeviceUnlock() {
    if (!savedProfile?.user_id) return;

    if (!savedProfile.has_password) {
      await handleQuickUnlock();
      return;
    }

    if (!window.isSecureContext || !window.PublicKeyCredential) {
      setError("Desbloqueio do dispositivo nao disponivel neste navegador. Use sua senha.");
      return;
    }

    setError("Desbloqueio do dispositivo ainda nao configurado para esta conta. Use sua senha.");
  }

  async function handleRegister(e) {
    e?.preventDefault();
    setError("");

    const errors = {};
    if (!email || !email.includes("@")) errors.email = true;
    if (!firstName.trim()) errors.firstName = true;
    if (!lastName.trim()) errors.lastName = true;
    if (!user.trim()) errors.user = true;
    if (hasPassword) {
      if (!password) errors.password = true;
      if (!confirmPassword) errors.confirmPassword = true;
      if (password && confirmPassword && password !== confirmPassword) {
        errors.confirmPassword = true;
        setError("As senhas nao coincidem.");
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const account = await createAccount({
        user_id: user.trim(),
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        has_password: hasPassword,
        password: hasPassword ? password : null,
        theme_color: themeColor,
      });
      persistAccount(account);
      setSavedProfile(buildProfile(account));
      onLoginSuccess(account, null);
    } catch (err) {
      console.error("[Finlann] Erro ao criar conta:", err);
      if (err?.code === "23505") {
        setError("Esse nome de conta ja esta em uso. Escolha outro.");
        setFieldErrors({ user: true });
      } else {
        setError("Nao foi possivel criar a conta agora. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (view === "welcome") {
    return (
      <div className="finlann-login-screen finlann-login-screen--welcome">
        <div className="finlann-login-welcome-graph" aria-hidden="true">
          <svg viewBox="0 0 430 280" preserveAspectRatio="none">
            <defs>
              <linearGradient id="finlannLoginWaveMain" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0f3d8f" stopOpacity="0.45" />
                <stop offset="55%" stopColor="#1cd38f" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#6fffd0" stopOpacity="0.6" />
              </linearGradient>
              <linearGradient id="finlannLoginWaveSecondary" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#17306a" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#2f6bce" stopOpacity="0.3" />
              </linearGradient>
              <linearGradient id="finlannLoginBars" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#102248" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.45" />
              </linearGradient>
            </defs>
            <path
              d="M -12 215 C 58 165 92 276 154 228 C 212 184 244 142 292 178 C 344 216 372 142 442 74"
              fill="none"
              stroke="url(#finlannLoginWaveMain)"
              strokeWidth="2.1"
            />
            <path
              d="M -10 228 C 44 194 88 256 148 236 C 206 218 246 188 286 206 C 346 238 384 192 440 140"
              fill="none"
              stroke="url(#finlannLoginWaveSecondary)"
              strokeWidth="1.1"
            />
            <rect x="337" y="185" width="16" height="60" rx="8" fill="url(#finlannLoginBars)" />
            <rect x="368" y="166" width="20" height="79" rx="10" fill="url(#finlannLoginBars)" />
            <rect x="401" y="126" width="24" height="119" rx="12" fill="url(#finlannLoginBars)" />
            <circle cx="407" cy="114" r="6.2" fill="#78ffd2" />
          </svg>
        </div>

        <div className="finlann-login-welcome-hero">
          <div className="finlann-login-brand" aria-label="Finlann">
            <img src={logoFinlann} alt="" className="finlann-login-logo finlann-login-logo--welcome" />
            <span className="finlann-login-brand__name">Finlann</span>
          </div>
          <h1 className="finlann-login-welcome-title">
            Controle total do seu <span>dinheiro</span>
          </h1>
          <p className="finlann-login-welcome-subtitle">
            Gestao financeira simples, inteligente e feita para voce.
          </p>
        </div>

        <div className="finlann-login-welcome-actions">
          <section className="finlann-login-welcome-card">
            <span className="finlann-login-welcome-badge">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 12.5a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Zm0 2.4c-4.6 0-8.3 2.2-8.3 4.8a1 1 0 1 0 2 0c0-1.1 2.3-2.8 6.3-2.8s6.3 1.7 6.3 2.8a1 1 0 1 0 2 0c0-2.6-3.7-4.8-8.3-4.8Z"
                  fill="currentColor"
                />
              </svg>
              {hasSavedProfile ? "Perfil salvo" : "Acesso rapido"}
            </span>

            <button
              type="button"
              className="finlann-login-welcome-identity"
              onClick={() => hasSavedProfile && goTo("quick")}
              disabled={!hasSavedProfile}
            >
              <div className="finlann-login-welcome-avatar">
                <span>{profileInitials}</span>
                <span className={"finlann-login-welcome-avatar-check" + (hasSavedProfile ? "" : " is-hidden")}>✓</span>
              </div>
              <div className="finlann-login-welcome-identity-text">
                <strong>{hasSavedProfile ? profileDisplayName : "Entrar na conta"}</strong>
                <span>{hasSavedProfile ? `@${savedProfile.user_id}` : "Use seu usuario e senha"}</span>
              </div>
            </button>

            <button
              type="button"
              className="finlann-login-welcome-enter"
              onClick={() => goTo(hasSavedProfile ? "quick" : "login")}
            >
              Entrar agora <span aria-hidden="true">→</span>
            </button>
          </section>

          <div className="finlann-login-welcome-divider" aria-hidden="true">
            <span>ou</span>
          </div>

          <button
            type="button"
            className="finlann-login-welcome-create"
            onClick={() => goTo("register")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M11 12.2a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2.2c-4.9 0-8.8 2.4-8.8 5.2a1 1 0 1 0 2 0c0-1.3 2.5-3.2 6.8-3.2 1.7 0 3.1.3 4.2.8a1 1 0 0 0 .9-1.8c-1.4-.7-3.1-1-5.1-1Zm8.6 0h-1.8v-1.8a1 1 0 1 0-2 0v1.8H14a1 1 0 1 0 0 2h1.8v1.8a1 1 0 1 0 2 0v-1.8h1.8a1 1 0 1 0 0-2Z"
                fill="currentColor"
              />
            </svg>
            <span>Criar conta</span>
          </button>

          <p className="finlann-login-welcome-security">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 2.4 4.5 5.2v6.6c0 4.7 3.2 8.6 7.5 9.8 4.3-1.2 7.5-5.1 7.5-9.8V5.2L12 2.4Zm0 2.1 5.5 2.1v5.2c0 3.6-2.3 6.7-5.5 7.8-3.2-1.1-5.5-4.2-5.5-7.8V6.6L12 4.5Zm-1 3.9v2H9.2a1 1 0 0 0 0 2H11v1.8a1 1 0 1 0 2 0v-1.8h1.8a1 1 0 1 0 0-2H13v-2a1 1 0 1 0-2 0Z"
                fill="currentColor"
              />
            </svg>
            <span>Seus dados estao protegidos com seguranca de ponta a ponta.</span>
          </p>
        </div>

        <button type="button" className="finlann-login-skip finlann-login-skip--welcome" onClick={onContinueWithoutAccount}>
          Continuar sem conta <span aria-hidden="true">›</span>
        </button>
      </div>
    );
  }

  if (view === "quick") {
    return (
      <div className="finlann-login-screen">
        <div className="finlann-login-logo-area">
          <img src={logoFinlann} alt="Finlann" className="finlann-login-logo finlann-login-logo--small" />
        </div>

        <div className="finlann-login-form-card">
          <h2 className="finlann-login-form-title">Entrar no perfil</h2>

          <div className="finlann-login-quick-profile">
            <span className="finlann-login-label">Perfil</span>
            <strong>{profileDisplayName}</strong>
            <span className="finlann-login-quick-profile__id">@{savedProfile?.user_id}</span>
          </div>

          <form onSubmit={handleQuickUnlock} className="finlann-login-form">
            {savedProfile?.has_password && (
              <div className="finlann-login-field">
                <div className="finlann-login-floating-field finlann-login-floating-field--with-action">
                  <input
                    id="quick-password"
                    type={showPassword ? "text" : "password"}
                    className={"finlann-field__input" + (fieldErrors.password ? " finlann-field__input--error" : "")}
                    placeholder=" "
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    autoComplete="current-password"
                    autoFocus
                  />
                  <label htmlFor="quick-password" className="finlann-login-floating-label">
                    SENHA{fieldErrors.password && <span className="finlann-login-error-dot"> *</span>}
                  </label>
                  <button
                    type="button"
                    className="finlann-login-eye-btn"
                    onClick={() => setShowPassword((p) => !p)}
                    tabIndex={-1}
                  >
                    <img src={showPassword ? eyeClosed : eyeOpen} alt="" style={{ width: 18, height: 18 }} />
                  </button>
                </div>
              </div>
            )}

            {error && <p className="finlann-login-error-msg">{error}</p>}

            <button type="submit" className="finlann-login-btn finlann-login-btn--primary" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </button>

            <button
              type="button"
              className="finlann-login-btn finlann-login-btn--secondary"
              onClick={handleDeviceUnlock}
              disabled={loading}
            >
              Usar desbloqueio do dispositivo
            </button>
          </form>

          <div className="finlann-login-form-footer">
            <button type="button" className="finlann-login-link" onClick={() => goTo("login")}>
              Usar outra conta
            </button>
          </div>
        </div>

        <button type="button" className="finlann-login-skip" onClick={() => goTo("welcome")}>
          Voltar
        </button>
      </div>
    );
  }

  if (view === "login") {
    return (
      <div className="finlann-login-screen">
        <div className="finlann-login-logo-area">
          <img src={logoFinlann} alt="Finlann" className="finlann-login-logo finlann-login-logo--small" />
        </div>

        <div className="finlann-login-form-card">
          <h2 className="finlann-login-form-title">Entrar</h2>

          <form onSubmit={handleLogin} className="finlann-login-form">
            <div className="finlann-login-field">
              <div className="finlann-login-floating-field">
                <input
                  id="login-user"
                  type="text"
                  className={"finlann-field__input" + (fieldErrors.user ? " finlann-field__input--error" : "")}
                  placeholder=" "
                  value={user}
                  onChange={(e) => {
                    setUser(e.target.value);
                    setError("");
                  }}
                  autoComplete="username"
                  autoFocus
                />
                <label htmlFor="login-user" className="finlann-login-floating-label">
                  NOME DA CONTA
                  {fieldErrors.user && <span className="finlann-login-error-dot"> *</span>}
                </label>
              </div>
            </div>

            <div className="finlann-login-field">
              <div className="finlann-login-floating-field finlann-login-floating-field--with-action">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  className="finlann-field__input"
                  placeholder=" "
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <label htmlFor="login-password" className="finlann-login-floating-label">
                  SENHA (opcional)
                </label>
                <button
                  type="button"
                  className="finlann-login-eye-btn"
                  onClick={() => setShowPassword((p) => !p)}
                  tabIndex={-1}
                >
                  <img src={showPassword ? eyeClosed : eyeOpen} alt="" style={{ width: 18, height: 18 }} />
                </button>
              </div>
            </div>

            {error && <p className="finlann-login-error-msg">{error}</p>}

            <button type="submit" className="finlann-login-btn finlann-login-btn--primary" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="finlann-login-form-footer">
            <span className="finlann-login-form-footer__text">Nao tem conta?</span>
            <button type="button" className="finlann-login-link" onClick={() => goTo("register")}>
              Criar conta
            </button>
          </div>
        </div>

        <button type="button" className="finlann-login-skip" onClick={() => goTo("welcome")}>
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="finlann-login-screen finlann-login-screen--register">
      <div className="finlann-login-logo-area">
        <img src={logoFinlann} alt="Finlann" className="finlann-login-logo finlann-login-logo--small" />
      </div>

      <div
        className="finlann-login-form-card"
        style={{
          borderColor: themeColor,
          backgroundImage: `linear-gradient(135deg, #020617 0%, #020617 20%, ${themeColor}22 60%, ${themeColor}55 100%)`,
        }}
      >
        <h2 className="finlann-login-form-title">Criar conta</h2>

        <form onSubmit={handleRegister} className="finlann-login-form">
          <div className="finlann-login-field">
            <div className="finlann-login-floating-field">
              <input
                id="register-email"
                type="email"
                className={"finlann-field__input" + (fieldErrors.email ? " finlann-field__input--error" : "")}
                placeholder=" "
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFieldErrors((p) => ({ ...p, email: false }));
                }}
                autoFocus
              />
              <label htmlFor="register-email" className="finlann-login-floating-label">
                E-MAIL{fieldErrors.email && <span className="finlann-login-error-dot"> *</span>}
              </label>
            </div>
          </div>

          <div className="finlann-login-row">
            <div className="finlann-login-field">
              <div className="finlann-login-floating-field">
                <input
                  id="register-firstname"
                  type="text"
                  className={"finlann-field__input" + (fieldErrors.firstName ? " finlann-field__input--error" : "")}
                  placeholder=" "
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    setFieldErrors((p) => ({ ...p, firstName: false }));
                  }}
                />
                <label htmlFor="register-firstname" className="finlann-login-floating-label">
                  NOME{fieldErrors.firstName && <span className="finlann-login-error-dot"> *</span>}
                </label>
              </div>
            </div>
            <div className="finlann-login-field">
              <div className="finlann-login-floating-field">
                <input
                  id="register-lastname"
                  type="text"
                  className={"finlann-field__input" + (fieldErrors.lastName ? " finlann-field__input--error" : "")}
                  placeholder=" "
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    setFieldErrors((p) => ({ ...p, lastName: false }));
                  }}
                />
                <label htmlFor="register-lastname" className="finlann-login-floating-label">
                  SOBRENOME{fieldErrors.lastName && <span className="finlann-login-error-dot"> *</span>}
                </label>
              </div>
            </div>
          </div>

          <div className="finlann-login-field">
            <div className="finlann-login-floating-field">
              <input
                id="register-user"
                type="text"
                className={"finlann-field__input" + (fieldErrors.user ? " finlann-field__input--error" : "")}
                placeholder=" "
                value={user}
                onChange={(e) => {
                  setUser(e.target.value);
                  setFieldErrors((p) => ({ ...p, user: false }));
                  setError("");
                }}
              />
              <label htmlFor="register-user" className="finlann-login-floating-label">
                NOME DA CONTA{fieldErrors.user && <span className="finlann-login-error-dot"> *</span>}
              </label>
            </div>
          </div>

          <div className="finlann-login-field">
            <label className="finlann-login-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>ADICIONAR SENHA</span>
              <button
                type="button"
                onClick={() => setHasPassword((p) => !p)}
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 999,
                  background: hasPassword ? themeColor : "rgba(100,116,139,0.4)",
                  border: "none",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 0.2s",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    left: hasPassword ? 18 : 2,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "left 0.2s",
                  }}
                />
              </button>
            </label>
          </div>

          {hasPassword && (
            <>
              <div className="finlann-login-field">
                <div className="finlann-login-floating-field finlann-login-floating-field--with-action">
                  <input
                    id="register-password"
                    type={showPassword ? "text" : "password"}
                    className={"finlann-field__input" + (fieldErrors.password ? " finlann-field__input--error" : "")}
                    placeholder=" "
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setFieldErrors((p) => ({ ...p, password: false }));
                    }}
                  />
                  <label htmlFor="register-password" className="finlann-login-floating-label">
                    SENHA{fieldErrors.password && <span className="finlann-login-error-dot"> *</span>}
                  </label>
                  <button type="button" className="finlann-login-eye-btn" onClick={() => setShowPassword((p) => !p)} tabIndex={-1}>
                    <img src={showPassword ? eyeClosed : eyeOpen} alt="" style={{ width: 18, height: 18 }} />
                  </button>
                </div>
              </div>
              <div className="finlann-login-field">
                <div className="finlann-login-floating-field finlann-login-floating-field--with-action">
                  <input
                    id="register-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    className={"finlann-field__input" + (fieldErrors.confirmPassword ? " finlann-field__input--error" : "")}
                    placeholder=" "
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setFieldErrors((p) => ({ ...p, confirmPassword: false }));
                      setError("");
                    }}
                  />
                  <label htmlFor="register-confirm-password" className="finlann-login-floating-label">
                    CONFIRMAR SENHA{fieldErrors.confirmPassword && <span className="finlann-login-error-dot"> *</span>}
                  </label>
                  <button type="button" className="finlann-login-eye-btn" onClick={() => setShowConfirmPassword((p) => !p)} tabIndex={-1}>
                    <img src={showConfirmPassword ? eyeClosed : eyeOpen} alt="" style={{ width: 18, height: 18 }} />
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="finlann-login-field">
            <label className="finlann-login-label">COR DA CONTA</label>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {["#3b82f6", "#8b5cf6", "#ec4899", "#22c55e", "#f97316", "#0ea5e9"].map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setThemeColor(color)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    backgroundColor: color,
                    border: themeColor === color ? "2px solid #fff" : "2px solid transparent",
                    cursor: "pointer",
                    padding: 0,
                  }}
                />
              ))}
            </div>
          </div>

          {error && <p className="finlann-login-error-msg">{error}</p>}

          <button
            type="submit"
            className="finlann-login-btn finlann-login-btn--primary"
            disabled={loading}
            style={loading ? undefined : { background: themeColor }}
          >
            {loading ? "Criando conta..." : "Criar conta"}
          </button>
        </form>

        <div className="finlann-login-form-footer">
          <span className="finlann-login-form-footer__text">Ja tem conta?</span>
          <button type="button" className="finlann-login-link" onClick={() => goTo(savedProfile?.user_id ? "quick" : "login")}>
            Entrar
          </button>
        </div>
      </div>

      <button type="button" className="finlann-login-skip" onClick={() => goTo("welcome")}>
        Voltar
      </button>
    </div>
  );
}
