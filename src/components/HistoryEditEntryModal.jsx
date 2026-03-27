import { useState } from "react";
import Overlay from "./Overlay.jsx";
import { formatCurrencyInput, parseCurrencyInput } from "../utils/currency.js";

function formatAmountDisplay(value) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}


export default function HistoryEditEntryModal({ entry, onClose, onSave, existingCards }) {
  if (!entry) return null;

  const isIncome = entry.kind === "income";

  const [description, setDescription] = useState(entry.description || "");
  const [amountText, setAmountText] = useState(
    formatAmountDisplay(entry.amount)
  );
  const [hasTypedDescription, setHasTypedDescription] = useState(false);
  const [hasTypedAmount, setHasTypedAmount] = useState(false);
  const [origin, setOrigin] = useState(entry.origin || "");
  const [extra, setExtra] = useState(entry.extra || "");
  const [method, setMethod] = useState(
    entry.kind === "expense" ? entry.origin || entry.method || "" : ""
  );
  const [cardId, setCardId] = useState(
    entry.kind === "expense" ? entry.extra || entry.cardId || "" : ""
  );
  const [note, setNote] = useState(entry.note || "");

  const hasAnyTyping = hasTypedDescription || hasTypedAmount;

  function handleSave() {
    const numericAmount = parseCurrencyInput(amountText);
    if (!numericAmount) return;

    if (!isIncome && !method) return;

    onSave?.({
      ...entry,
      description: description.trim(),
      origin: isIncome ? origin.trim() : method,
      extra: isIncome ? extra.trim() : cardId || "",
      amount: numericAmount,
      method: !isIncome ? method : undefined,
      cardId: !isIncome ? (method === "credit" ? cardId || null : null) : undefined,
      note: note.trim() || undefined,
    });
  }

  const kindLabel = isIncome ? "Entrada" : "Saída";

  const selectedCard = !isIncome
    ? existingCards?.find((c) => c.id === cardId)
    : null;
  const accentColor = selectedCard?.color;

  return (
    <Overlay
      onClose={onClose}
      kind={isIncome ? "income" : "expense"}
      accentColor={accentColor}
      closeOnBackdrop={!hasAnyTyping}
    >
      <header className="finlann-modal__header">
        <div>
          <p className="finlann-modal__eyebrow">Editar {kindLabel}</p>
          <h2 className="finlann-modal__title">{description || kindLabel}</h2>
        </div>
      </header>

      <div className="finlann-modal__body">
        <div className="finlann-field">
          <label className="finlann-field__label">Descrição</label>
          <input
            className="finlann-field__input"
            value={description}
            onChange={(e) => {
              if (!hasTypedDescription && e.target.value !== entry.description) {
                setHasTypedDescription(true);
              }
              setDescription(e.target.value);
            }}
          />
        </div>

        <div className="finlann-field finlann-field--amount">
          <label className="finlann-field__label">Valor</label>
          <input
            className="finlann-field__input finlann-field__input--amount"
            placeholder="R$ 0,00"
            inputMode="decimal"
            value={amountText}
            onChange={(e) => {
              const raw = e.target.value;
              if (!hasTypedAmount && raw !== "") {
                setHasTypedAmount(true);
              }
              const formatted = formatCurrencyInput(raw);
              setAmountText(formatted);
            }}
          />
        </div>

        {isIncome ? (
          <>
            <div className="finlann-field">
              <label className="finlann-field__label">Origem</label>
              <input
                className="finlann-field__input"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
              />
            </div>

            <div className="finlann-field">
              <label className="finlann-field__label">Tipo</label>
              <div className="finlann-chips">
                {["pix", "transfer", "cash"].map((id) => {
                  const label = id === "pix" ? "Pix" : id === "transfer" ? "Transferência" : "Dinheiro";
                  const active = extra === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={
                        "finlann-chip " +
                        (active ? "finlann-chip--solid is-active" : "finlann-chip--outline")
                      }
                      onClick={() => setExtra(id)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="finlann-field">
              <label className="finlann-field__label">Forma de pagamento</label>
              <div className="finlann-chips">
                {[
                  { id: "credit", label: "Crédito" },
                  { id: "debit", label: "Débito" },
                  { id: "pix", label: "Pix" },
                  { id: "cash", label: "Dinheiro" },
                ].map((type) => {
                  const active = type.id === method;
                  const useAccent = active && type.id === "credit" && accentColor;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      className={
                        "finlann-chip " +
                        (active
                          ? "finlann-chip--solid is-active" +
                            (useAccent ? " finlann-chip--accent" : "")
                          : "finlann-chip--outline")
                      }
                      onClick={() => setMethod(type.id)}
                    >
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {method === "credit" && (
              <div className="finlann-field">
                <label className="finlann-field__label">Cartão de crédito</label>
                <div className="finlann-select">
                  <select
                    className="finlann-field__input"
                    value={cardId}
                    onChange={(e) => setCardId(e.target.value)}
                  >
                    <option value="">Selecione um cartão</option>
                    {existingCards?.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="finlann-field">
              <label className="finlann-field__label">Observações</label>
              <textarea
                className="finlann-field__input"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </>
        )}

        {isIncome && (
          <div className="finlann-field">
            <label className="finlann-field__label">Observações</label>
            <textarea
              className="finlann-field__input"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        )}
      </div>

      <footer className="finlann-modal__footer" style={{ justifyContent: "flex-end" }}>
        <button
          type="button"
          className="finlann-modal__primary"
          onClick={handleSave}
        >
          Salvar
        </button>
      </footer>
    </Overlay>
  );
}
