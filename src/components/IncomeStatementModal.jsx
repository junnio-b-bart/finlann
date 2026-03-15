import { useState } from "react";
import Overlay from "./Overlay.jsx";

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

export default function IncomeStatementModal({ typeLabel, typeId, incomes, onClose, onRemoveIncomes }) {
  const total = incomes.reduce((acc, i) => acc + i.amount, 0);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

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

  return (
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
              disabled={selectedIds.length === 0}
              onClick={() => {
                if (!selectedIds.length) return;
                onRemoveIncomes?.(selectedIds);
                clearSelection();
              }}
            >
              Excluir
            </button>
            <button
              type="button"
              className="finlann-modal__secondary"
              disabled={selectedIds.length === 0}
              onClick={() => {
                alert("Edição de entrada individual ainda será implementada.");
              }}
            >
              Editar
            </button>
          </div>
        )}
      </footer>
    </Overlay>
  );
}
