import { useState } from "react";
import logoFinlann from "../assets/FinlannLogo.png";
import eyeOpen from "../assets/icons/4.png";
import eyeClosed from "../assets/icons/3.png";
import { createAccount, loginAccount, loadStateFromBackend } from "../data/finlannBackendClient.js";
import "../styles/globals.css";
import "../styles/tokens.css";
import "../styles/finlann.css";

// Utilitário: força o localStorage a persistir a conta logada
function persistAccount(account) {
  if (typeof window === "undefined" || !account) return;
  try {
    window.localStorage.setItem("finlann.currentAccount", JSON.stringify(account));
    if (account.user_id) {
      window.localStorage.setItem("finlann.householdId", account.user_id);
    }
  } catch {
    // ignore
  }
}

export default function LoginScreen({ onLoginSuccess, onContinueWithoutAccount }) {
  // "welcome" | "login" | "register"
  const [view, setView] = useState("welcome");

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
    setThemeColor("#3b82f6");
  }

  function goTo(nextView) {
    resetForm();
    setView(nextView);
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
      persistAccount(account);

      // tenta carregar dados da conta no backend
      let remoteState = null;
      try {
        remoteState = await loadStateFromBackend(account.user_id);
      } catch {
        // se falhar, tudo bem — o app usa estado local
      }

      onLoginSuccess(account, remoteState);
    } catch (err) {
      if (err?.message === "INVALID_CREDENTIALS") {
        setError("Usuário ou senha incorretos.");
      } else {
        setError("Não foi possível entrar agora. Tente novamente.");
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
        setError("As senhas não coincidem.");
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
      onLoginSuccess(account, null);
    } catch (err) {
      console.error("[Finlann] Erro ao criar conta:", err);
      if (err?.code === "23505") {
        setError("Esse nome de conta já está em uso. Escolha outro.");
        setFieldErrors({ user: true });
      } else {
        setError("Não foi possível criar a conta agora. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  // ----- TELA INICIAL (welcome) -----
  if (view === "welcome") {
    return (
      <div className="finlann-login-screen">
        <div className="finlann-login-logo-area">
          <img src={logoFinlann} alt="Finlann" className="finlann-login-logo" />
          <p className="finlann-login-tagline">Gestão financeira simples.</p>
        </div>

        <div className="finlann-login-ctas">
          <button
            type="button"
            className="finlann-login-btn finlann-login-btn--primary"
            onClick={() => goTo("login")}
          >
            Entrar na conta
          </button>
          <button
            type="button"
            className="finlann-login-btn finlann-login-btn--secondary"
            onClick={() => goTo("register")}
          >
            Criar conta
          </button>
        </div>

        <button
          type="button"
          className="finlann-login-skip"
          onClick={onContinueWithoutAccount}
        >
          Continuar sem conta
        </button>
      </div>
    );
  }

  // ----- TELA DE LOGIN -----
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
              <label className="finlann-login-label">
                NOME DA CONTA
                {fieldErrors.user && <span className="finlann-login-error-dot"> *</span>}
              </label>
              <input
                type="text"
                className={"finlann-field__input" + (fieldErrors.user ? " finlann-field__input--error" : "")}
                placeholder="seu_nome_de_usuario"
                value={user}
                onChange={(e) => { setUser(e.target.value); setError(""); }}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="finlann-login-field">
              <label className="finlann-login-label">SENHA (opcional)</label>
              <div className="finlann-login-password-row">
                <input
                  type={showPassword ? "text" : "password"}
                  className="finlann-field__input"
                  placeholder="Deixe em branco se não tiver senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
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

            <button
              type="submit"
              className="finlann-login-btn finlann-login-btn--primary"
              disabled={loading}
            >
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <div className="finlann-login-form-footer">
            <span className="finlann-login-form-footer__text">Não tem conta?</span>
            <button type="button" className="finlann-login-link" onClick={() => goTo("register")}>
              Criar conta
            </button>
          </div>
        </div>

        <button type="button" className="finlann-login-skip" onClick={() => goTo("welcome")}>
          ← Voltar
        </button>
      </div>
    );
  }

  // ----- TELA DE CADASTRO -----
  return (
    <div className="finlann-login-screen finlann-login-screen--register">
      <div className="finlann-login-logo-area">
        <img src={logoFinlann} alt="Finlann" className="finlann-login-logo finlann-login-logo--small" />
      </div>

      <div className="finlann-login-form-card" style={{ borderColor: themeColor, backgroundImage: `linear-gradient(135deg, #020617 0%, #020617 20%, ${themeColor}22 60%, ${themeColor}55 100%)` }}>
        <h2 className="finlann-login-form-title">Criar conta</h2>

        <form onSubmit={handleRegister} className="finlann-login-form">
          {/* Email */}
          <div className="finlann-login-field">
            <label className="finlann-login-label">
              E-MAIL{fieldErrors.email && <span className="finlann-login-error-dot"> *</span>}
            </label>
            <input
              type="email"
              className={"finlann-field__input" + (fieldErrors.email ? " finlann-field__input--error" : "")}
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: false })); }}
              autoFocus
            />
          </div>

          {/* Nome + Sobrenome */}
          <div className="finlann-login-row">
            <div className="finlann-login-field">
              <label className="finlann-login-label">
                NOME{fieldErrors.firstName && <span className="finlann-login-error-dot"> *</span>}
              </label>
              <input
                type="text"
                className={"finlann-field__input" + (fieldErrors.firstName ? " finlann-field__input--error" : "")}
                placeholder="Nome"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setFieldErrors((p) => ({ ...p, firstName: false })); }}
              />
            </div>
            <div className="finlann-login-field">
              <label className="finlann-login-label">
                SOBRENOME{fieldErrors.lastName && <span className="finlann-login-error-dot"> *</span>}
              </label>
              <input
                type="text"
                className={"finlann-field__input" + (fieldErrors.lastName ? " finlann-field__input--error" : "")}
                placeholder="Sobrenome"
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); setFieldErrors((p) => ({ ...p, lastName: false })); }}
              />
            </div>
          </div>

          {/* Nome da conta (user_id) */}
          <div className="finlann-login-field">
            <label className="finlann-login-label">
              NOME DA CONTA{fieldErrors.user && <span className="finlann-login-error-dot"> *</span>}
            </label>
            <input
              type="text"
              className={"finlann-field__input" + (fieldErrors.user ? " finlann-field__input--error" : "")}
              placeholder="Identificador único (ex: joao_silva)"
              value={user}
              onChange={(e) => { setUser(e.target.value); setFieldErrors((p) => ({ ...p, user: false })); setError(""); }}
            />
          </div>

          {/* Senha (opcional — toggle) */}
          <div className="finlann-login-field">
            <label className="finlann-login-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>ADICIONAR SENHA</span>
              <button
                type="button"
                onClick={() => setHasPassword((p) => !p)}
                style={{
                  width: 36, height: 20, borderRadius: 999,
                  background: hasPassword ? themeColor : "rgba(100,116,139,0.4)",
                  border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s",
                  flexShrink: 0,
                }}
              >
                <span style={{
                  position: "absolute", top: 2, left: hasPassword ? 18 : 2,
                  width: 16, height: 16, borderRadius: "50%",
                  background: "#fff", transition: "left 0.2s",
                }} />
              </button>
            </label>
          </div>

          {hasPassword && (
            <>
              <div className="finlann-login-field">
                <label className="finlann-login-label">
                  SENHA{fieldErrors.password && <span className="finlann-login-error-dot"> *</span>}
                </label>
                <div className="finlann-login-password-row">
                  <input
                    type={showPassword ? "text" : "password"}
                    className={"finlann-field__input" + (fieldErrors.password ? " finlann-field__input--error" : "")}
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: false })); }}
                  />
                  <button type="button" className="finlann-login-eye-btn" onClick={() => setShowPassword((p) => !p)} tabIndex={-1}>
                    <img src={showPassword ? eyeClosed : eyeOpen} alt="" style={{ width: 18, height: 18 }} />
                  </button>
                </div>
              </div>
              <div className="finlann-login-field">
                <label className="finlann-login-label">
                  CONFIRMAR SENHA{fieldErrors.confirmPassword && <span className="finlann-login-error-dot"> *</span>}
                </label>
                <div className="finlann-login-password-row">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    className={"finlann-field__input" + (fieldErrors.confirmPassword ? " finlann-field__input--error" : "")}
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors((p) => ({ ...p, confirmPassword: false })); setError(""); }}
                  />
                  <button type="button" className="finlann-login-eye-btn" onClick={() => setShowConfirmPassword((p) => !p)} tabIndex={-1}>
                    <img src={showConfirmPassword ? eyeClosed : eyeOpen} alt="" style={{ width: 18, height: 18 }} />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Cor da conta */}
          <div className="finlann-login-field">
            <label className="finlann-login-label">COR DA CONTA</label>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {["#3b82f6", "#8b5cf6", "#ec4899", "#22c55e", "#f97316", "#0ea5e9"].map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setThemeColor(color)}
                  style={{
                    width: 24, height: 24, borderRadius: "50%",
                    backgroundColor: color, border: themeColor === color ? "2px solid #fff" : "2px solid transparent",
                    cursor: "pointer", padding: 0,
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
            {loading ? "Criando conta…" : "Criar conta"}
          </button>
        </form>

        <div className="finlann-login-form-footer">
          <span className="finlann-login-form-footer__text">Já tem conta?</span>
          <button type="button" className="finlann-login-link" onClick={() => goTo("login")}>
            Entrar
          </button>
        </div>
      </div>

      <button type="button" className="finlann-login-skip" onClick={() => goTo("welcome")}>
        ← Voltar
      </button>
    </div>
  );
}
