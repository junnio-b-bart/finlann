import { useState, useEffect } from "react";
import "../styles/globals.css";
import "../styles/tokens.css";
import "../styles/finlann.css";

const PREFS_KEY = "finlann.notificationPrefs";

const DEFAULT_PREFS = {
  permissionGranted: false,
  closingReminder: { enabled: false, daysBefore: 2 },
  dueReminder: { enabled: false, daysBefore: 1 },
  newPurchaseAlert: { enabled: false },
  limitAlert: { enabled: false, threshold: 80 },
};

const APP_ICON_URL = `${import.meta.env.BASE_URL}finlann-icon.png`;

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

async function requestBrowserPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const result = await Notification.requestPermission();
  return result;
}

function fireTestNotification() {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  new Notification("Finlann · Teste", {
    body: "Suas notificações estão funcionando corretamente.",
    icon: APP_ICON_URL,
  });
}

// ── Toggle switch ──────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      style={{
        width: 44,
        height: 24,
        borderRadius: 999,
        background: checked ? "var(--color-accent, #3b82f6)" : "rgba(100,116,139,0.3)",
        border: "none",
        cursor: "pointer",
        position: "relative",
        transition: "background 0.2s",
        flexShrink: 0,
        marginLeft: 12,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.18s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
        }}
      />
    </button>
  );
}

// ── Row com toggle ─────────────────────────────────────────────────────────────
function NotifRow({ label, subtitle, checked, onChange, children }) {
  return (
    <div
      className="finlann-list-item"
      style={{ flexDirection: "column", alignItems: "stretch", cursor: "default", gap: 0 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="finlann-list-item__title">{label}</p>
          {subtitle && (
            <p className="finlann-list-item__subtitle" style={{ marginTop: 2 }}>
              {subtitle}
            </p>
          )}
        </div>
        <Toggle checked={checked} onChange={onChange} />
      </div>
      {checked && children && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px solid rgba(148,163,184,0.1)",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ── Seletor de dias antes ──────────────────────────────────────────────────────
function DaysPicker({ value, onChange }) {
  const options = [1, 2, 3, 5, 7];
  return (
    <div>
      <p
        style={{
          fontSize: 11,
          color: "rgba(148,163,184,0.7)",
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        Quantos dias antes?
      </p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {options.map((d) => {
          const active = value === d;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onChange(d)}
              style={{
                padding: "5px 14px",
                borderRadius: 999,
                fontSize: 13,
                background: active ? "rgba(59,130,246,0.2)" : "rgba(148,163,184,0.08)",
                border: active
                  ? "1px solid rgba(59,130,246,0.7)"
                  : "1px solid rgba(148,163,184,0.2)",
                color: active ? "#93c5fd" : "rgba(148,163,184,0.7)",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {d === 1 ? "1 dia" : `${d} dias`}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Seletor de limite (%) ──────────────────────────────────────────────────────
function ThresholdPicker({ value, onChange }) {
  const options = [60, 70, 80, 90];
  return (
    <div>
      <p
        style={{
          fontSize: 11,
          color: "rgba(148,163,184,0.7)",
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        Alertar ao atingir
      </p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {options.map((pct) => {
          const active = value === pct;
          return (
            <button
              key={pct}
              type="button"
              onClick={() => onChange(pct)}
              style={{
                padding: "5px 14px",
                borderRadius: 999,
                fontSize: 13,
                background: active ? "rgba(245,158,11,0.2)" : "rgba(148,163,184,0.08)",
                border: active
                  ? "1px solid rgba(245,158,11,0.7)"
                  : "1px solid rgba(148,163,184,0.2)",
                color: active ? "#fcd34d" : "rgba(148,163,184,0.7)",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {pct}%
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Tela principal ─────────────────────────────────────────────────────────────
export default function SettingsNotifications({ onBack }) {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [permission, setPermission] = useState(() => {
    if (typeof Notification === "undefined") return "unsupported";
    return Notification.permission;
  });
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);

  // Persiste toda vez que prefs mudam
  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  // Checa se alguma notif está ativa mas sem permissão
  const anyEnabled =
    prefs.closingReminder.enabled ||
    prefs.dueReminder.enabled ||
    prefs.newPurchaseAlert.enabled ||
    prefs.limitAlert.enabled;

  async function handleToggle(key, subKey) {
    // Pede permissão ao ativar qualquer notificação pela primeira vez
    if (!prefs[key].enabled && permission !== "granted") {
      const result = await requestBrowserPermission();
      setPermission(result);
      if (result === "denied") {
        setShowPermissionBanner(true);
        return;
      }
      if (result === "unsupported") {
        setShowPermissionBanner(true);
        return;
      }
    }

    setPrefs((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        enabled: !prev[key].enabled,
      },
    }));
  }

  function handleSubValue(key, subKey, value) {
    setPrefs((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [subKey]: value,
      },
    }));
  }

  const isUnsupported = permission === "unsupported";
  const isDenied = permission === "denied";

  return (
    <div className="finlann-dashboard">
      <div className="finlann-header-strip">
        <header className="finlann-header">
          <button
            type="button"
            className="finlann-modal__secondary"
            onClick={onBack}
            style={{ flexShrink: 0 }}
          >
            ← Voltar
          </button>
          <div className="finlann-header__left" style={{ marginLeft: 12 }}>
            <h1 className="finlann-section__title">Notificações</h1>
          </div>
        </header>
      </div>

      {/* Banner de permissão negada */}
      {(showPermissionBanner || isDenied) && !isUnsupported && (
        <div
          style={{
            margin: "0 16px 12px",
            padding: "12px 14px",
            borderRadius: 12,
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.35)",
            fontSize: 13,
            color: "#fca5a5",
            lineHeight: 1.5,
          }}
        >
          <strong>Permissão negada.</strong> Para receber notificações, ative-as nas configurações
          do seu navegador e recarregue a página.
        </div>
      )}

      {/* Banner de não suportado */}
      {isUnsupported && (
        <div
          style={{
            margin: "0 16px 12px",
            padding: "12px 14px",
            borderRadius: 12,
            background: "rgba(148,163,184,0.1)",
            border: "1px solid rgba(148,163,184,0.2)",
            fontSize: 13,
            color: "rgba(148,163,184,0.8)",
            lineHeight: 1.5,
          }}
        >
          Notificações não são suportadas neste navegador.
        </div>
      )}

      {/* Seção: Faturas */}
      <section className="finlann-section">
        <header className="finlann-section__header">
          <h2 className="finlann-section__title">Faturas</h2>
        </header>

        <div className="finlann-list">
          <NotifRow
            label="Fechamento de fatura"
            subtitle="Aviso antes da fatura fechar e novos lançamentos pararem de entrar."
            checked={prefs.closingReminder.enabled}
            onChange={() => handleToggle("closingReminder")}
          >
            <DaysPicker
              value={prefs.closingReminder.daysBefore}
              onChange={(v) => handleSubValue("closingReminder", "daysBefore", v)}
            />
          </NotifRow>

          <NotifRow
            label="Vencimento de fatura"
            subtitle="Lembrete antes da data de pagamento da fatura."
            checked={prefs.dueReminder.enabled}
            onChange={() => handleToggle("dueReminder")}
          >
            <DaysPicker
              value={prefs.dueReminder.daysBefore}
              onChange={(v) => handleSubValue("dueReminder", "daysBefore", v)}
            />
          </NotifRow>
        </div>
      </section>

      {/* Seção: Gastos */}
      <section className="finlann-section">
        <header className="finlann-section__header">
          <h2 className="finlann-section__title">Gastos</h2>
        </header>

        <div className="finlann-list">
          <NotifRow
            label="Nova compra registrada"
            subtitle="Receba um aviso sempre que uma nova saída for lançada."
            checked={prefs.newPurchaseAlert.enabled}
            onChange={() => handleToggle("newPurchaseAlert")}
          />

          <NotifRow
            label="Limite do cartão"
            subtitle="Alerta quando o total de uma fatura atingir um percentual do limite."
            checked={prefs.limitAlert.enabled}
            onChange={() => handleToggle("limitAlert")}
          >
            <ThresholdPicker
              value={prefs.limitAlert.threshold}
              onChange={(v) => handleSubValue("limitAlert", "threshold", v)}
            />
          </NotifRow>
        </div>
      </section>

      {/* Botão de teste */}
      {anyEnabled && permission === "granted" && (
        <section className="finlann-section">
          <header className="finlann-section__header">
            <h2 className="finlann-section__title">Testar</h2>
          </header>
          <div style={{ padding: "0 16px 16px" }}>
            <button
              type="button"
              className="finlann-modal__secondary"
              style={{ width: "100%" }}
              onClick={fireTestNotification}
            >
              Enviar notificação de teste
            </button>
          </div>
        </section>
      )}

      {/* Rodapé informativo */}
      <div
        style={{
          padding: "12px 16px 32px",
          fontSize: 12,
          color: "rgba(148,163,184,0.45)",
          lineHeight: 1.6,
          textAlign: "center",
        }}
      >
        As notificações são geradas pelo app enquanto ele está aberto no navegador.
        Prefências salvas localmente neste dispositivo.
      </div>
    </div>
  );
}

