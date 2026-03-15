import Overlay from "./Overlay.jsx";

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
  return `${day}/${month}/${year} · ${hours}:${minutes}`;
}

export default function HistoryEntryModal({ entry, onClose, onEdit, cards = [] }) {
  if (!entry) return null;

  const isIncome = entry.kind === "income";
  const kindLabel = isIncome ? "Entrada" : "Saída";

  let accentColor;
  if (!isIncome) {
    // Saídas
    if (entry.origin === "credit") {
      const card = cards.find((c) => c.id === entry.cardId);
      if (card?.color) {
        accentColor = card.color;
      }
    }
    if (!accentColor && (entry.origin === "pix" || entry.origin === "cash")) {
      // Usa o mesmo padrão verde do modal de saída
      accentColor = "linear-gradient(to bottom right, #22c55e 0%, #16a34a 40%, #020617 100%)";
    }
  }

  return (
    <Overlay
      onClose={onClose}
      kind={isIncome ? "income" : "expense"}
      accentColor={accentColor}
    >
      <header className="finlann-modal__header" style={{ alignItems: "stretch" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          <div>
            <p className="finlann-modal__eyebrow">{kindLabel}</p>
            <h2 className="finlann-modal__title">
              {entry.description || kindLabel}
            </h2>
          </div>
          <button
            type="button"
            className="finlann-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
      </header>

      <div className="finlann-modal__body" style={{ gap: 8 }}>
        <div className="finlann-field">
          <span className="finlann-field__label">Valor</span>
          <span className="finlann-card__value">
            {formatCurrency(entry.amount)}
          </span>
        </div>

        <div className="finlann-field">
          <span className="finlann-field__label">Data e hora</span>
          <span>{formatDateTime(entry.createdAt)}</span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <div className="finlann-field" style={{ flex: 1 }}>
            <span className="finlann-field__label">
              {isIncome ? "Origem" : "Método"}
            </span>
            <span>
              {isIncome
                ? entry.origin || "—"
                : entry.origin === "credit"
                ? "Crédito"
                : entry.origin === "debit"
                ? "Débito"
                : entry.origin === "pix"
                ? "Pix"
                : entry.origin === "cash"
                ? "Dinheiro"
                : entry.origin || "—"}
            </span>
          </div>

          <div className="finlann-field" style={{ flex: 1 }}>
            <span className="finlann-field__label">
              {isIncome ? "Tipo" : "Cartão"}
            </span>
            <span>{entry.extra || "—"}</span>
          </div>
        </div>
      </div>

      <footer className="finlann-modal__footer" style={{ justifyContent: "flex-end" }}>
        <button
          type="button"
          className="finlann-modal__primary"
          onClick={() => onEdit?.(entry)}
        >
          Editar
        </button>
      </footer>
    </Overlay>
  );
}
