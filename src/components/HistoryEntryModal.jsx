import Overlay from "./Overlay.jsx";
import calendarioIcon from "../assets/icons/calendario.png";

function formatCurrency(value) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDateTime(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} - ${hours}:${minutes}`;
}

function getExpenseMethodLabel(origin) {
  if (origin === "credit") return "Credito";
  if (origin === "debit") return "Debito";
  if (origin === "pix") return "Pix";
  if (origin === "cash") return "Dinheiro";
  if (origin === "invoice_payment") return "Pagamento de fatura";
  return origin || "-";
}

function getExpenseCategoryLabel(categoryId) {
  if (!categoryId) return "Outros";
  if (categoryId === "alimentacao") return "Alimentacao";
  if (categoryId === "carro") return "Carro";
  if (categoryId === "lazer") return "Lazer";
  if (categoryId === "compras") return "Compras";
  if (categoryId === "investimentos") return "Investimentos";
  if (categoryId === "casa") return "Casa";
  if (categoryId === "saude") return "Saude";
  if (categoryId === "outros") return "Outros";
  return categoryId
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getCategoryTone(categoryId) {
  if (categoryId === "carro") return "car";
  if (categoryId === "alimentacao") return "food";
  if (categoryId === "lazer") return "fun";
  if (categoryId === "compras") return "shop";
  if (categoryId === "investimentos") return "invest";
  if (categoryId === "casa") return "home";
  if (categoryId === "saude") return "health";
  return "default";
}

export default function HistoryEntryModal({ entry, onClose, onEdit, cards = [] }) {
  if (!entry) return null;

  const isIncome = entry.kind === "income";
  const kindLabel = isIncome ? "Entrada" : "Saida";
  const card = !isIncome ? cards.find((c) => c.id === entry.cardId) : null;
  const methodLabel = isIncome ? entry.origin || "-" : getExpenseMethodLabel(entry.origin);
  const categoryLabel = getExpenseCategoryLabel(entry.category);
  const categoryTone = getCategoryTone(entry.category);

  let accentColor;
  if (!isIncome && (entry.origin === "credit" || entry.origin === "invoice_payment")) {
    accentColor = card?.color;
  }
  if (!accentColor && !isIncome && (entry.origin === "pix" || entry.origin === "cash")) {
    accentColor = "linear-gradient(to bottom right, #22c55e 0%, #16a34a 40%, #020617 100%)";
  }

  return (
    <Overlay
      onClose={onClose}
      kind={isIncome ? "income" : "expense"}
      accentColor={accentColor}
    >
      <div className="finlann-history-entry">
        <header className="finlann-history-entry__header">
          <div>
            <p className="finlann-modal__eyebrow">{kindLabel}</p>
          </div>
          <button
            type="button"
            className="finlann-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        <div className="finlann-history-entry__title-row">
          <span className="finlann-history-entry__icon">✎</span>
          <h2 className="finlann-history-entry__title">{entry.description || kindLabel}</h2>
        </div>

        <section className="finlann-history-entry__top-grid">
          <div className="finlann-history-entry__date-chip">
            <img src={calendarioIcon} alt="" aria-hidden="true" />
            <span>{formatDateTime(entry.createdAt).replace(" - ", " • ")}</span>
          </div>
          <div className="finlann-history-entry__amount">
            <span className="finlann-field__label">Valor</span>
            <strong>{formatCurrency(entry.amount)}</strong>
          </div>
        </section>

        {!isIncome && (
          <section className="finlann-history-entry__detail-grid">
            <div className="finlann-history-entry__card">
              <span className="finlann-field__label">Categoria</span>
              <div className={`finlann-history-entry__category-pill is-${categoryTone}`}>
                <span className="finlann-history-entry__category-icon">#</span>
                <span>{categoryLabel}</span>
              </div>
              <small>Classificacao deste gasto</small>
            </div>

            <div className="finlann-history-entry__card finlann-history-entry__card--payment">
              <span className="finlann-field__label">Pagamento</span>
              <div className="finlann-history-entry__payment-box">
                <div className="finlann-history-entry__payment-main">
                  <span className="finlann-history-entry__payment-icon">▦</span>
                  <span>{card?.label || methodLabel}</span>
                  <span className="finlann-history-entry__payment-chevron">›</span>
                </div>
                <span className="finlann-history-entry__payment-tag">{methodLabel}</span>
              </div>
              <small>Metodo de pagamento</small>
            </div>
          </section>
        )}

        {entry.note && (
          <div className="finlann-history-entry__note">
            <span className="finlann-field__label">Detalhe</span>
            <span>{entry.note}</span>
          </div>
        )}

        <footer className="finlann-history-entry__footer">
          {!entry.readOnly && (
            <button
              type="button"
              className="finlann-history-entry__edit-btn"
              onClick={() => onEdit?.(entry)}
            >
              Editar lancamento
            </button>
          )}
        </footer>
      </div>
    </Overlay>
  );
}
