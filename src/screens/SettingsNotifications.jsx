import "../styles/globals.css";
import "../styles/tokens.css";
import "../styles/finlann.css";

export default function SettingsNotifications({ onBack }) {
  return (
    <div className="finlann-dashboard">
      <header className="finlann-header">
        <button
          type="button"
          className="finlann-modal__secondary"
          onClick={onBack}
        >
          Voltar
        </button>
        <div className="finlann-header__left" style={{ marginLeft: 8 }}>
          <h1 className="finlann-section__title">Notificações</h1>
          <p className="finlann-header__subtitle">
            Preferências de lembretes e avisos
          </p>
        </div>
      </header>

      <section className="finlann-section">
        <header className="finlann-section__header">
          <h2 className="finlann-section__title">Em breve</h2>
        </header>

        <div className="finlann-settings-notifications">
          <p className="finlann-header__subtitle">
            Aqui você vai poder configurar:
          </p>
          <ul style={{ paddingLeft: 16, fontSize: "var(--font-size-sm)" }}>
            <li>Lembretes de fechamento e vencimento da fatura</li>
            <li>Avisos quando registrar uma nova compra</li>
            <li>Alertas ao chegar perto do limite de cada cartão</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
