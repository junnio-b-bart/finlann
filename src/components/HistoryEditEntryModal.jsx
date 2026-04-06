import { useState } from "react";
import Overlay from "./Overlay.jsx";
import { formatCurrencyInput, parseCurrencyInput } from "../utils/currency.js";

const expenseMethods = [
  { id: "credit", label: "Credito" },
  { id: "debit", label: "Debito" },
  { id: "pix", label: "Pix" },
  { id: "cash", label: "Dinheiro" },
];

const incomeTypes = [
  { id: "pix", label: "Pix" },
  { id: "salary", label: "Salario" },
  { id: "freela", label: "Freela" },
  { id: "transfer", label: "Transferencia" },
  { id: "cash", label: "Dinheiro" },
];

const expenseCategories = [
  { id: "alimentacao", label: "Alimentacao" },
  { id: "carro", label: "Carro" },
  { id: "lazer", label: "Lazer" },
  { id: "compras", label: "Compras" },
  { id: "investimentos", label: "Investimentos" },
  { id: "casa", label: "Casa" },
  { id: "saude", label: "Saude" },
  { id: "outros", label: "Outros" },
];

export default function HistoryEditEntryModal({
  entry,
  existingCards = [],
  onClose,
  onSave,
}) {
  if (!entry) return null;

  const isIncome = entry.kind === "income";

  const [description, setDescription] = useState(entry.description || "");
  const [amount, setAmount] = useState(
    Number(entry.amount || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  );
  const [origin, setOrigin] = useState(entry.origin || "");
  const [incomeType, setIncomeType] = useState(entry.extra || "pix");
  const [method, setMethod] = useState(entry.origin || "pix");
  const [cardId, setCardId] = useState(entry.cardId || "");
  const [category, setCategory] = useState(entry.category || "outros");
  const [note, setNote] = useState(entry.note || "");

  const canSave = description.trim().length > 0 && parseCurrencyInput(amount) > 0;
  const creditCards = (existingCards || []).filter((c) => !c.kind || c.kind === "credit");
  const debitCards = (existingCards || []).filter((c) => c.kind === "debit");

  function handleSave() {
    if (!canSave) return;
    const numericAmount = parseCurrencyInput(amount);

    if (isIncome) {
      onSave?.({
        ...entry,
        description: description.trim(),
        amount: numericAmount,
        origin: origin.trim(),
        extra: incomeType,
        note: note.trim(),
      });
      return;
    }

    onSave?.({
      ...entry,
      description: description.trim(),
      amount: numericAmount,
      method,
      origin: method,
      cardId: method === "credit" || method === "debit" ? cardId || null : null,
      category,
      note: note.trim(),
    });
  }

  const visibleCards = method === "debit" ? debitCards : creditCards;

  return (
    <Overlay onClose={onClose} kind={isIncome ? "income" : "expense"}>
      <header className="finlann-modal__header">
        <div>
          <p className="finlann-modal__eyebrow">Edicao</p>
          <h2 className="finlann-modal__title">
            {isIncome ? "Editar entrada" : "Editar saida"}
          </h2>
        </div>
      </header>

      <div className="finlann-modal__body finlann-modal__body--scroll">
        <div className="finlann-field">
          <label className="finlann-field__label">Descricao</label>
          <input
            className="finlann-field__input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="finlann-field finlann-field--amount">
          <label className="finlann-field__label">Valor</label>
          <input
            className="finlann-field__input finlann-field__input--amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(formatCurrencyInput(e.target.value))}
          />
        </div>

        {isIncome ? (
          <>
            <div className="finlann-field">
              <label className="finlann-field__label">Tipo</label>
              <div className="finlann-chips">
                {incomeTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    className={
                      "finlann-chip " +
                      (incomeType === type.id
                        ? "finlann-chip--solid is-active"
                        : "finlann-chip--outline")
                    }
                    onClick={() => setIncomeType(type.id)}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="finlann-field">
              <label className="finlann-field__label">Origem</label>
              <input
                className="finlann-field__input"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
              />
            </div>
          </>
        ) : (
          <>
            <div className="finlann-field">
              <label className="finlann-field__label">Metodo</label>
              <div className="finlann-chips">
                {expenseMethods.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={
                      "finlann-chip " +
                      (method === m.id
                        ? "finlann-chip--solid is-active"
                        : "finlann-chip--outline")
                    }
                    onClick={() => setMethod(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {(method === "credit" || method === "debit") && (
              <div className="finlann-field">
                <label className="finlann-field__label">Cartao</label>
                <div className="finlann-select">
                  <select
                    value={cardId}
                    onChange={(e) => setCardId(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {visibleCards.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="finlann-field">
              <label className="finlann-field__label">Categoria</label>
              <div className="finlann-chips">
                {expenseCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={
                      "finlann-chip " +
                      (category === cat.id
                        ? "finlann-chip--solid is-active"
                        : "finlann-chip--outline")
                    }
                    onClick={() => setCategory(cat.id)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="finlann-field">
          <label className="finlann-field__label">Detalhe</label>
          <input
            className="finlann-field__input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      <footer className="finlann-modal__footer">
        <button
          type="button"
          className="finlann-modal__secondary"
          onClick={onClose}
        >
          Cancelar
        </button>
        <button
          type="button"
          className={canSave ? "finlann-modal__primary" : "finlann-modal__secondary"}
          onClick={handleSave}
          disabled={!canSave}
        >
          Salvar
        </button>
      </footer>
    </Overlay>
  );
}
