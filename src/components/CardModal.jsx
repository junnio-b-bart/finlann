import { useState, useEffect } from "react";
import Overlay from "./Overlay.jsx";

const COLORS = [
  { id: "purple", label: "Roxo", value: "#a855f7" },
  { id: "blue", label: "Azul", value: "#3b82f6" },
  { id: "green", label: "Verde", value: "#22c55e" },
  { id: "orange", label: "Laranja", value: "#f97316" },
  { id: "pink", label: "Rosa", value: "#ec4899" },
];

export default function CardModal({ onClose, onSave, initialCard, initialKind = "credit" }) {
  const isEditing = Boolean(initialCard);

  const [name, setName] = useState(initialCard?.label || "");
  const [colorId, setColorId] = useState(COLORS[0].id);
  const [customColor, setCustomColor] = useState(null);
  const [useCustomColor, setUseCustomColor] = useState(false);
  const [closeDay, setCloseDay] = useState(initialCard?.billingCloseDay || "");
  const [dueDay, setDueDay] = useState(initialCard?.billingDueDay || "");

  const presetColor = COLORS.find((c) => c.id === colorId)?.value || COLORS[0].value;
  const effectiveColor = useCustomColor && customColor ? customColor : presetColor;

  // seleção independente de Crédito e Débito; no save convertemos para kind: "credit" | "debit" | "both"
  const [kinds, setKinds] = useState(() => {
    const initial = initialCard?.kind || initialKind;
    if (initial === "both") {
      return { credit: true, debit: true };
    }
    if (initial === "debit") {
      return { credit: false, debit: true };
    }
    // default: crédito
    return { credit: true, debit: false };
  });

  useEffect(() => {
    if (initialCard?.color) {
      const found = COLORS.find((c) => c.value === initialCard.color);
      if (found) {
        setColorId(found.id);
        setCustomColor(null);
        setUseCustomColor(false);
      } else {
        setColorId(COLORS[0].id);
        setCustomColor(initialCard.color);
        setUseCustomColor(true);
      }
    }
  }, [initialCard]);

  function handleSave() {
    if (!name.trim()) return; // depois podemos mostrar erro visual

    const colorValue = effectiveColor;
    const nowIso = new Date().toISOString();

    // converte seleção múltipla em uma string única de tipo
    let kind;
    if (kinds.credit && kinds.debit) {
      kind = "both";
    } else if (kinds.debit) {
      kind = "debit";
    } else {
      kind = "credit";
    }

    onSave?.({
      id: initialCard?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      label: name.trim(),
      color: colorValue,
      billingCloseDay: closeDay.trim(),
      billingDueDay: dueDay.trim(),
      kind,
      updatedAt: nowIso,
      createdAt: initialCard?.createdAt || nowIso,
    });
  }

  return (
    <Overlay onClose={onClose} closeOnBackdrop={false} accentColor={effectiveColor}>
      <header className="finlann-modal__header finlann-card-modal__header">
        <div>
          <h2 className="finlann-modal__title">
            {isEditing ? "Editar cartão" : "Cadastrar novo cartão"}
          </h2>
        </div>
        <button
          type="button"
          className="finlann-modal__close"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className="finlann-modal__body">
        <div className="finlann-field">
          <label className="finlann-field__label">Nome do cartão</label>
          <input
            className="finlann-field__input"
            placeholder="Ex.: Nubank roxo, Itaú Visa, C6..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="finlann-field">
          <label className="finlann-field__label">Tipo de cartão</label>
          <div className="finlann-chips">
            {[{ id: "credit", label: "Crédito" }, { id: "debit", label: "Débito" }].map(
              (option) => {
                const isActive = kinds[option.id];
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={
                      "finlann-chip " +
                      (isActive
                        ? "finlann-chip--solid is-active"
                        : "finlann-chip--outline")
                    }
                    onClick={() =>
                      setKinds((prev) => {
                        const next = { ...prev, [option.id]: !prev[option.id] };
                        // garante que pelo menos um fique selecionado
                        if (!next.credit && !next.debit) {
                          return prev;
                        }
                        return next;
                      })
                    }
                  >
                    {option.label}
                  </button>
                );
              }
            )}
          </div>
        </div>

        <div className="finlann-field">
          <label className="finlann-field__label">Cor para identificar</label>
          <div className="finlann-color-row">
            {COLORS.map((color) => (
              <button
                key={color.id}
                type="button"
                className={
                  "finlann-color-dot" +
                  (color.id === colorId && !useCustomColor ? " is-active" : "")
                }
                style={{ background: color.value }}
                onClick={() => {
                  setColorId(color.id);
                  setUseCustomColor(false);
                }}
              />
            ))}

            {/* 6ª bolinha: cor customizada via seletor nativo */}
            <label
              className={
                "finlann-color-dot finlann-color-dot--custom" +
                (useCustomColor ? " is-active" : "")
              }
              style={{
                background: customColor || presetColor,
              }}
            >
              <input
                type="color"
                value={customColor || presetColor}
                onChange={(e) => {
                  const value = e.target.value;
                  setCustomColor(value);
                  setUseCustomColor(true);
                }}
              />
            </label>
          </div>
        </div>

        <div className="finlann-field finlann-field--inline">
          <div>
            <label className="finlann-field__label">Fecha fatura em</label>
            <input
              className="finlann-field__input"
              placeholder="Dia"
              inputMode="numeric"
              value={closeDay}
              onChange={(e) => setCloseDay(e.target.value)}
            />
          </div>
          <div>
            <label className="finlann-field__label">Vence em</label>
            <input
              className="finlann-field__input"
              placeholder="Dia"
              inputMode="numeric"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
            />
          </div>
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
          {isEditing ? "Salvar alterações" : "Salvar cartão"}
        </button>
      </footer>
    </Overlay>
  );
}
