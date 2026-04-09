import { useState } from "react";
import logoFinlann from "../assets/logo-f-mark.png";
import eyeOpen from "../assets/icons/4.png";
import eyeClosed from "../assets/icons/3.png";
import { createAccount, loginAccount, loadStateFromBackend } from "../data/finlannBackendClient.js";
import "../styles/globals.css";
import "../styles/tokens.css";
import "../styles/finlann.css";

const LAST_PROFILE_KEY = "finlann.lastProfile";
const DEVICE_UNLOCKS_KEY = "finlann.deviceUnlocks";
const DEVICE_PASSWORDS_KEY = "finlann.deviceUnlockPasswords";

function readStoredJson(key, fallback = null) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredJson(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToUint8Array(base64url) {
  const normalized = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function readDeviceUnlockConfig(userId) {
  if (!userId) return null;
  const all = readStoredJson(DEVICE_UNLOCKS_KEY, {});
  return all?.[userId] || null;
}

function persistDeviceUnlockConfig(userId, config) {
  if (!userId) return;
  const all = readStoredJson(DEVICE_UNLOCKS_KEY, {});
  all[userId] = {
    enabled: !!config?.enabled,
    credentialId: config?.credentialId || "",
    prompted: !!config?.prompted,
    updatedAt: Date.now(),
  };
  writeStoredJson(DEVICE_UNLOCKS_KEY, all);
}

function isDeviceUnlockEnabled(userId) {
  const config = readDeviceUnlockConfig(userId);
  return !!config?.enabled && !!config?.credentialId;
}

function persistDevicePassword(userId, plainPassword) {
  if (!userId || !plainPassword) return;
  const all = readStoredJson(DEVICE_PASSWORDS_KEY, {});
  all[userId] = plainPassword;
  writeStoredJson(DEVICE_PASSWORDS_KEY, all);
}

function readDevicePassword(userId) {
  if (!userId) return "";
  const all = readStoredJson(DEVICE_PASSWORDS_KEY, {});
  return all?.[userId] || "";
}

async function createDeviceCredentialForUser(userId) {
  if (!window.isSecureContext || !window.PublicKeyCredential) {
    throw new Error("DEVICE_UNLOCK_UNAVAILABLE");
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const encodedUserId = new TextEncoder().encode(`finlann:${userId}`);
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Finlann" },
      user: {
        id: encodedUserId,
        name: userId,
        displayName: userId,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 }, // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      timeout: 60000,
      attestation: "none",
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
    },
  });

  if (!credential?.rawId) {
    throw new Error("DEVICE_UNLOCK_REGISTER_FAILED");
  }

  return {
    credentialId: arrayBufferToBase64Url(credential.rawId),
  };
}

async function assertDeviceCredential(credentialId) {
  if (!window.isSecureContext || !window.PublicKeyCredential) {
    throw new Error("DEVICE_UNLOCK_UNAVAILABLE");
  }
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const allowId = base64UrlToUint8Array(credentialId);
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      timeout: 60000,
      userVerification: "required",
      allowCredentials: [{ id: allowId, type: "public-key" }],
    },
  });
  if (!assertion) {
    throw new Error("DEVICE_UNLOCK_FAILED");
  }
}

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
    device_unlock_enabled: isDeviceUnlockEnabled(account.user_id),
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
  const hasDeviceUnlockForSavedProfile = hasSavedProfile
    ? isDeviceUnlockEnabled(savedProfile.user_id)
    : false;
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

  function goToLoginWithoutPrefill() {
    resetForm();
    setView("login");
  }

  async function maybeOfferDeviceUnlock(account, typedPassword) {
    if (!account?.user_id) return;
    const currentConfig = readDeviceUnlockConfig(account.user_id);
    if (currentConfig?.enabled || currentConfig?.prompted) return;

    const wantsEnable = window.confirm(
      "Deseja habilitar acesso rapido com Face ID/biometria/senha do aparelho para os proximos logins?"
    );
    if (!wantsEnable) {
      persistDeviceUnlockConfig(account.user_id, {
        enabled: false,
        credentialId: "",
        prompted: true,
      });
      return;
    }

    try {
      const registration = await createDeviceCredentialForUser(account.user_id);
      persistDeviceUnlockConfig(account.user_id, {
        enabled: true,
        credentialId: registration.credentialId,
        prompted: true,
      });

      if (account.has_password && typedPassword) {
        persistDevicePassword(account.user_id, typedPassword);
      }
    } catch (err) {
      persistDeviceUnlockConfig(account.user_id, {
        enabled: false,
        credentialId: "",
        prompted: true,
      });
      if (err?.name === "NotAllowedError") {
        setError("Habilitacao de desbloqueio cancelada.");
        return;
      }
      if (err?.message === "DEVICE_UNLOCK_UNAVAILABLE") {
        setError("Desbloqueio do dispositivo nao disponivel neste navegador.");
        return;
      }
      setError("Nao foi possivel habilitar o desbloqueio do dispositivo agora.");
    }
  }

  async function tryDeviceUnlockLogin({ fallbackToQuick = false } = {}) {
    if (!savedProfile?.user_id) return false;

    const config = readDeviceUnlockConfig(savedProfile.user_id);
    if (!config?.enabled || !config?.credentialId) {
      setError("Desbloqueio do dispositivo nao habilitado para este perfil.");
      if (fallbackToQuick) goTo("quick");
      return false;
    }

    setLoading(true);
    setError("");
    try {
      await assertDeviceCredential(config.credentialId);

      const localPassword = readDevicePassword(savedProfile.user_id);
      const account = await loginAccount({
        user_id: savedProfile.user_id,
        password: savedProfile.has_password ? localPassword || null : null,
      });
      await finalizeLogin(account);
      return true;
    } catch (err) {
      if (err?.name === "NotAllowedError") {
        setError("Desbloqueio cancelado. Use sua senha ou tente novamente.");
      } else if (err?.message === "DEVICE_UNLOCK_UNAVAILABLE") {
        setError("Desbloqueio do dispositivo nao disponivel neste navegador.");
      } else if (err?.message === "INVALID_CREDENTIALS" && savedProfile.has_password) {
        setError("Para este perfil, faça login com senha uma vez para habilitar o desbloqueio automatico.");
      } else {
        setError("Nao foi possivel entrar com desbloqueio do dispositivo.");
      }
      if (fallbackToQuick) goTo("quick");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleWelcomeEnter() {
    if (!hasSavedProfile) {
      goTo("login");
      return;
    }

    if (hasDeviceUnlockForSavedProfile) {
      await tryDeviceUnlockLogin({ fallbackToQuick: true });
      return;
    }

    goTo("quick");
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
      await maybeOfferDeviceUnlock(account, password || null);
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
      await maybeOfferDeviceUnlock(account, hasPassword ? password : null);
      await finalizeLogin(account);
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

            <div className="finlann-login-welcome-card-row">
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
              onClick={handleWelcomeEnter}
              disabled={loading}
            >
              {loading ? "Entrando..." : <>Entrar agora <span aria-hidden="true">{"\u203A"}</span></>}
            </button>
            </div>

          </section>

          <div className="finlann-login-welcome-divider" aria-hidden="true">
            <span>ou</span>
          </div>

          <div className="finlann-login-welcome-account-row">
            {hasSavedProfile && (
              <button
                type="button"
                className="finlann-login-welcome-other-account finlann-login-welcome-other-account--row"
                onClick={goToLoginWithoutPrefill}
              >
                Entrar com outra conta
              </button>
            )}

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
          </div>

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
      <div className="finlann-login-screen finlann-login-screen--quick">
        <div className="finlann-login-logo-area">
          <div className="finlann-login-brand" aria-label="Finlann">
            <img src={logoFinlann} alt="" className="finlann-login-logo finlann-login-logo--welcome" />
            <span className="finlann-login-brand__name">Finlann</span>
          </div>
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

          </form>

          <div className="finlann-login-form-footer">
            <button type="button" className="finlann-login-link" onClick={() => goTo("login")}>
              Usar outra conta
            </button>
          </div>
        </div>

        <button type="button" className="finlann-login-skip" onClick={() => goTo("welcome")}>
          <span aria-hidden="true">{"\u2039"} </span>Voltar
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
