import { useState } from "react";
import Overlay from "./Overlay.jsx";

const baseIncomeTypes = [
  { id: "pix", label: "Pix" },
  { id: "transfer", label: "Transferência" },
  { id: "cash", label: "Dinheiro" },
];

export default function IncomeModal({ onClose, onSave }) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [origin, setOrigin] = useState("");
  const [incomeType, setIncomeType] = useState("pix");
  const [customTypes, setCustomTypes] = useState([]);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [hasTyped, setHasTyped] = useState(false);

  const incomeTypes = [...baseIncomeTypes, ...customTypes];

  function formatAmount(raw) {
    if (!raw) return "";

    const normalized = raw
      .replace(/[^0-9,\.]/g, "")
      .replace(/\./g, "")
      .replace(/,/g, ".");

    const value = Number(normalized);
    if (Number.isNaN(value)) return raw;

    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function parseAmount(raw) {
    if (!raw) return 0;
    const normalized = raw
      .replace(/[^0-9,\.]/g, "")
      .replace(/\./g, "")
      .replace(/,/g, ".");
    const value = Number(normalized);
    return Number.isNaN(value) ? 0 : value;
  }

  function handleAmountBlur() {
    if (!amount) return;
    setAmount((prev) => formatAmount(prev));
  }

  function handleAmountKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      setAmount((prev) => formatAmount(prev));
      e.currentTarget.blur();
    }
  }

  function handleAmountChange(e) {
    setAmount(e.target.value);
  }

  function handleSave() {
    const numericAmount = parseAmount(amount);
    if (!numericAmount) return;

    const nowIso = new Date().toISOString();

    const income = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      description: description.trim(),
      amount: numericAmount,
      type: incomeType,
      origin: origin.trim(),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    onSave?.(income);
  }

  function handleSaveNewType() {
    const name = newTypeName.trim();
    if (!name) return;

    const id = name.toLowerCase().replace(/\s+/g, "-").slice(0, 32);
    const exists = incomeTypes.some((t) => t.id === id);
    if (!exists) {
      const newType = { id, label: name };
      setCustomTypes((prev) => [...prev, newType]);
      setIncomeType(id);
    }
    setNewTypeName("");
    setShowTypeModal(false);
  }

  return (
    <>
      <Overlay
        onClose={onClose}
        kind="income"
        closeOnBackdrop={!hasTyped}
      >
        <header className="finlann-modal__header">
          <div>
            <p className="finlann-modal__eyebrow">Nova entrada</p>
            <h2 className="finlann-modal__title">Registrar entrada</h2>
          </div>
        </header>

        <div className="finlann-modal__body">
          <div className="finlann-field">
            <label className="finlann-field__label">Descrição</label>
            <input
              className="finlann-field__input"
              placeholder="Ex.: salário, diária hotel, freela..."
              value={description}
              onChange={(e) => {
                if (!hasTyped && e.target.value !== "") setHasTyped(true);
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
              value={amount}
              onChange={(e) => {
                if (!hasTyped && e.target.value !== "") setHasTyped(true);
                handleAmountChange(e);
              }}
              onBlur={handleAmountBlur}
              onKeyDown={handleAmountKeyDown}
            />
          </div>

          <div className="finlann-field">
            <label className="finlann-field__label">Tipo de entrada</label>
            <div className="finlann-chips">
              {incomeTypes.map((type) => {
                const active = type.id === incomeType;
                return (
                  <button
                    key={type.id}
                    type="button"
                    className={
                      "finlann-chip " +
                      (active
                        ? "finlann-chip--solid is-active"
                        : "finlann-chip--outline")
                    }
                    onClick={() => setIncomeType(type.id)}
                  >
                    {type.label}
                  </button>
                );
              })}

              <button
                type="button"
                className="finlann-chip finlann-chip--outline"
                onClick={() => setShowTypeModal(true)}
              >
                +
              </button>
            </div>
          </div>

          <div className="finlann-field">
            <label className="finlann-field__label">Origem</label>
            <input
              className="finlann-field__input"
              placeholder="Ex.: hotel, trabalho fixo, cliente X..."
              value={origin}
              onChange={(e) => {
                if (!hasTyped && e.target.value !== "") setHasTyped(true);
                setOrigin(e.target.value);
              }}
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
            className="finlann-modal__primary"
            onClick={handleSave}
          >
            Salvar entrada
          </button>
        </footer>
      </Overlay>

      {showTypeModal && (
        <Overlay onClose={() => setShowTypeModal(false)}>
          <header className="finlann-modal__header">
            <div>
              <p className="finlann-modal__eyebrow">Novo tipo de entrada</p>
              <h2 className="finlann-modal__title">Adicionar tipo</h2>
            </div>
          </header>

          <div className="finlann-modal__body">
            <div className="finlann-field">
              <label className="finlann-field__label">Nome do tipo</label>
              <input
                className="finlann-field__input"
                placeholder="Ex.: salário, freela, comissão..."
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSaveNewType();
                  }
                }}
              />
            </div>
          </div>

          <footer className="finlann-modal__footer">
            <button
              type="button"
              className="finlann-modal__secondary"
              onClick={() => setShowTypeModal(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="finlann-modal__primary"
              onClick={handleSaveNewType}
            >
              Salvar tipo
            </button>
          </footer>
        </Overlay>
      )}
    </>
  );
}
