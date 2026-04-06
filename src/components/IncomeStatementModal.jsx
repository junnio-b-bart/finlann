import { useState } from "react";
import Overlay from "./Overlay.jsx";
import { formatCurrencyInput, parseCurrencyInput } from "../utils/currency.js";

function formatCurrency(value) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

export default function IncomeStatementModal({ typeLabel, typeId, incomes, onClose, onRemoveIncomes, onUpdateIncomes }) {
  const total = incomes.reduce((acc, i) => acc + i.amount, 0);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  // Edição de uma entrada específica
  const [editingIncome, setEditingIncome] = useState(null);
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editOrigin, setEditOrigin] = useState("");
  const [hasEditTyped, setHasEditTyped] = useState(false);

  function toggleSelected(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function clearSelection() {
    setSelectedIds([]);
    setSelectionMode(false);
  }

  const selectionIcon = selectionMode ? "☑" : "☐";

  function openEditForSelected() {
    if (selectedIds.length !== 1) {
      // por enquanto, edição só funciona com uma entrada selecionada
      return;
    }
    const income = incomes.find((i) => i.id === selectedIds[0]);
    if (!income) return;
    setEditingIncome(income);
    setEditDescription(income.description || "");
    setEditOrigin(income.origin || "");
    setHasEditTyped(false);
    // mostra já em formato de dinheiro
    setEditAmount(
      income.amount.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })
    );
  }

  function handleSaveEdit() {
    if (!editingIncome) return;
    const numericAmount = parseCurrencyInput(editAmount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return;
    }
    const desc = editDescription.trim();
    const origin = editOrigin.trim();

    onUpdateIncomes?.((income) => {
      if (income.id !== editingIncome.id) return undefined;
      return {
        ...income,
        description: desc || income.description,
        origin: origin,
        amount: numericAmount,
        updatedAt: new Date().toISOString(),
      };
    });

    setEditingIncome(null);
    clearSelection();
  }

  return (
    <>
    <Overlay onClose={onClose} kind="income">
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
            <p className="finlann-modal__eyebrow">Entradas</p>
            <h2 className="finlann-modal__title">{typeLabel}</h2>
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

      <div className="finlann-modal__body finlann-modal__body--scroll">
        <div className="finlann-field" style={{ marginBottom: 8 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span className="finlann-field__label">Total em {typeLabel}</span>
            <span className="finlann-card__value" style={{ textAlign: "right", minWidth: 90 }}>
              R$ {formatCurrency(total)}
            </span>
          </div>
        </div>

        <div className="finlann-statement-scroll">
          <div className="finlann-statement-table">
          <div className="finlann-statement-row finlann-statement-row--header">
            <span>Data</span>
            <span>Descrição</span>
            <span />
            <span>Valor</span>
          </div>

          {incomes.length === 0 && (
            <div className="finlann-statement-row" style={{ opacity: 0.7 }}>
              <span>–</span>
              <span>Nenhuma entrada ainda</span>
              <span />
              <span className="finlann-value-cell">
                <span className="finlann-value-prefix">R$</span>
                <span className="finlann-value-number">0,00</span>
              </span>
            </div>
          )}

          {incomes.map((income) => {
            const isSelected = selectedIds.includes(income.id);
            return (
              <div
                key={income.id}
                className="finlann-statement-row"
                style={selectionMode && isSelected ? { background: "rgba(37,99,235,0.15)" } : undefined}
                onClick={() => {
                  if (selectionMode) toggleSelected(income.id);
                }}
              >
                {selectionMode ? (
                  <span>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelected(income.id);
                      }}
                      readOnly
                    />
                  </span>
                ) : (
                  <span>{formatDate(income.createdAt)}</span>
                )}
                <span className="finlann-statement-desc">
                  {income.description || "(sem descrição)"}
                </span>
                <span />
                <span className="finlann-value-cell">
                  <span className="finlann-value-prefix">R$</span>
                  <span className="finlann-value-number">
                    {formatCurrency(income.amount)}
                  </span>
                </span>
              </div>
            );
          })}
          </div>
        </div>
      </div>

      <footer className="finlann-modal__footer" style={{ justifyContent: "space-between", alignItems: "center" }}>
        {/* Esquerda: seleção */}
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className="finlann-modal__close"
            onClick={() => setSelectionMode((prev) => !prev)}
            aria-label={selectionMode ? "Sair do modo seleção" : "Selecionar entradas"}
          >
            {selectionIcon}
          </button>
        </div>

        {selectionMode && (
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="finlann-modal__secondary"
              disabled={selectedIds.length !== 1}
              onClick={openEditForSelected}
            >
              Editar
            </button>
            <button
              type="button"
              className="finlann-modal__secondary"
              disabled={selectedIds.length === 0}
              onClick={() => {
                if (!selectedIds.length) return;
                onRemoveIncomes?.(selectedIds);
                clearSelection();
              }}
            >
              Excluir
            </button>
          </div>
        )}
      </footer>
    </Overlay>

    {editingIncome && (
      <Overlay
        onClose={() => setEditingIncome(null)}
        kind="income"
        closeOnBackdrop={!hasEditTyped}
      >
        <header className="finlann-modal__header">
          <div>
            <p className="finlann-modal__eyebrow">Editar entrada</p>
            <h2 className="finlann-modal__title">Ajustar dados</h2>
          </div>
        </header>

        <div className="finlann-modal__body">
          <div className="finlann-field">
            <label className="finlann-field__label">Descrição</label>
            <input
              className="finlann-field__input"
              value={editDescription}
              onChange={(e) => {
                if (!hasEditTyped && e.target.value !== "") setHasEditTyped(true);
                setEditDescription(e.target.value);
              }}
            />
          </div>

          <div className="finlann-field finlann-field--amount">
            <label className="finlann-field__label">Valor</label>
            <input
              className="finlann-field__input finlann-field__input--amount"
              placeholder="R$ 0,00"
              inputMode="decimal"
              value={editAmount}
              onChange={(e) => {
                if (!hasEditTyped && e.target.value !== "") setHasEditTyped(true);
                setEditAmount(formatCurrencyInput(e.target.value));
              }}
            />
          </div>

          <div className="finlann-field">
            <label className="finlann-field__label">Origem</label>
            <input
              className="finlann-field__input"
              value={editOrigin}
              onChange={(e) => {
                if (!hasEditTyped && e.target.value !== "") setHasEditTyped(true);
                setEditOrigin(e.target.value);
              }}
            />
          </div>
        </div>

        <footer className="finlann-modal__footer">
          <button
            type="button"
            className="finlann-modal__secondary"
            onClick={() => setEditingIncome(null)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="finlann-modal__primary"
            onClick={handleSaveEdit}
          >
            Salvar alterações
          </button>
        </footer>
      </Overlay>
    )}
    </>
  );
}
