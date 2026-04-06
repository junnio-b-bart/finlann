import { useState, useEffect } from "react";
import Overlay from "./Overlay.jsx";
import Dialog from "./Dialog.jsx";

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

  // Valores iniciais de fechamento/vencimento considerando tanto
  // os campos antigos (billingCloseDay/billingDueDay) quanto
  // os novos (closingDay/dueDay) para manter compatibilidade.
  const initialCloseDay =
    initialCard?.billingCloseDay ??
    (typeof initialCard?.closingDay === "number"
      ? String(initialCard.closingDay)
      : "");
  const initialDueDay =
    initialCard?.billingDueDay ??
    (typeof initialCard?.dueDay === "number" ? String(initialCard.dueDay) : "");

  const [closeDay, setCloseDay] = useState(initialCloseDay);
  const [dueDay, setDueDay] = useState(initialDueDay);

  // Quando o usuário altera os dias de fechamento/vencimento em um cartão
  // já existente, precisamos perguntar como aplicar essa mudança:
  // - apenas na fatura atual
  // - ou em todas a partir de agora (incluindo a atual)
  const [showScopeChoices, setShowScopeChoices] = useState(false);

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

  function buildCardPayload(scope = "all_from_now") {
    if (!name.trim()) return; // depois podemos mostrar erro visual

    const colorValue = effectiveColor;
    const nowIso = new Date().toISOString();

    const numericCloseDay = closeDay ? Number(closeDay) : undefined;
    const numericDueDay = dueDay ? Number(dueDay) : undefined;

    // converte seleção múltipla em uma string única de tipo
    let kind;
    if (kinds.credit && kinds.debit) {
      kind = "both";
    } else if (kinds.debit) {
      kind = "debit";
    } else {
      kind = "credit";
    }

    // Valores base de fechamento/vencimento no cartão
    let closingDayBase =
      typeof initialCard?.closingDay === "number"
        ? initialCard.closingDay
        : numericCloseDay;
    let dueDayBase =
      typeof initialCard?.dueDay === "number" ? initialCard.dueDay : numericDueDay;

    // Para "todas a partir de agora", atualizamos os defaults do cartão
    if (scope === "all_from_now") {
      if (typeof numericCloseDay === "number" && !Number.isNaN(numericCloseDay)) {
        closingDayBase = numericCloseDay;
      }
      if (typeof numericDueDay === "number" && !Number.isNaN(numericDueDay)) {
        dueDayBase = numericDueDay;
      }
    }

    // Override de fatura atual: usamos o mês/ano correntes como
    // "fatura atual" para simplificar o modelo.
    let currentInvoiceClosingDay = initialCard?.currentInvoiceClosingDay;
    let currentInvoiceDueDay = initialCard?.currentInvoiceDueDay;
    let currentInvoiceYear = initialCard?.currentInvoiceYear;
    let currentInvoiceMonthIndex = initialCard?.currentInvoiceMonthIndex;

    if (scope === "current_only" || scope === "all_from_now") {
      const now = new Date();
      currentInvoiceYear = now.getFullYear();
      currentInvoiceMonthIndex = now.getMonth();
      currentInvoiceClosingDay =
        typeof numericCloseDay === "number" && !Number.isNaN(numericCloseDay)
          ? numericCloseDay
          : closingDayBase;
      currentInvoiceDueDay =
        typeof numericDueDay === "number" && !Number.isNaN(numericDueDay)
          ? numericDueDay
          : dueDayBase;
    }

    return {
      id: initialCard?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      label: name.trim(),
      color: colorValue,
      // Mantemos os campos antigos para compatibilidade com dados já salvos,
      // mas passamos também os novos campos numéricos usados no motor de
      // faturas (closingDay/dueDay).
      billingCloseDay: closeDay.trim(),
      billingDueDay: dueDay.trim(),
      closingDay: closingDayBase,
      dueDay: dueDayBase,
      currentInvoiceClosingDay,
      currentInvoiceDueDay,
      currentInvoiceYear,
      currentInvoiceMonthIndex,
      kind,
      updatedAt: nowIso,
      createdAt: initialCard?.createdAt || nowIso,
    };
  }

  function handleSave(scope = "all_from_now") {
    const payload = buildCardPayload(scope);
    if (!payload) return;
    onSave?.(payload);
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
          onClick={() => {
            if (isEditing) {
              const billingChanged =
                String(closeDay || "") !== String(initialCloseDay || "") ||
                String(dueDay || "") !== String(initialDueDay || "");
              if (billingChanged) {
                setShowScopeChoices(true);
                return;
              }
            }
            handleSave("all_from_now");
          }}
        >
          {isEditing ? "Salvar alterações" : "Salvar cartão"}
        </button>
      </footer>

      {showScopeChoices && isEditing && (
        <Dialog
          title="Como aplicar mudança?"
          description="Escolha se as novas datas valem só para a fatura atual ou para este e os próximos meses."
          onClose={() => setShowScopeChoices(false)}
        >
          <div className="finlann-dialog__actions">
            <button
              type="button"
              className="finlann-modal__primary"
              onClick={() => {
                handleSave("all_from_now");
                setShowScopeChoices(false);
              }}
            >
              Todas a partir de agora (inclui a atual)
            </button>
            <button
              type="button"
              className="finlann-modal__secondary"
              onClick={() => {
                handleSave("current_only");
                setShowScopeChoices(false);
              }}
            >
              Apenas fatura atual
            </button>
            <button
              type="button"
              className="finlann-modal__secondary"
              onClick={() => setShowScopeChoices(false)}
            >
              Cancelar
            </button>
          </div>
        </Dialog>
      )}
    </Overlay>
  );
}
