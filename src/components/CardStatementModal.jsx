import { useState } from "react";
import Overlay from "./Overlay.jsx";
import CardModal from "./CardModal.jsx";
import ExpenseModal from "./ExpenseModal.jsx";

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

function getInstallmentLabel(expense) {
  if (!expense || !expense.totalInstallments || expense.totalInstallments === 1) {
    return "–";
  }
  const n = expense.installmentNumber || 1;
  const total = expense.totalInstallments;
  return `${n}/${total}`;
}

export default function CardStatementModal({
  card,
  expenses,
  currentMonthIndex,
  currentYear,
  allCards,
  lastUsedCardId,
  onClose,
  onUpdateCard,
  onAddExpense,
  onRemoveExpenses,
  onTransferExpenses,
  onUpdateExpenses,
}) {
  const [showEditCard, setShowEditCard] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState("");
  const [editingExpense, setEditingExpense] = useState(null);

  const toggleSelected = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setSelectionMode(false);
  };

  const accentColor = card.color || undefined;
  const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
  const invoiceDate = new Date(currentYear, currentMonthIndex, 1);
  const invoiceLabel = monthFormatter.format(invoiceDate);
  const invoiceMonthNumber = String(currentMonthIndex + 1).padStart(2, "0");
  const selectionIcon = selectionMode ? "☑" : "☐"; // caixinha marcada/vazia

  // Reconstrói a lógica de fatura para este cartão e mês/ano
  const invoiceItems = [];
  let total = 0;

  function monthsBetween(fromMonthIndex, fromYear, toMonthIndex, toYear) {
    return (toYear - fromYear) * 12 + (toMonthIndex - fromMonthIndex);
  }

  for (const e of expenses) {
    const totalInstallments = e.totalInstallments || 1;

    const refDate = new Date(e.purchaseDate || e.createdAt);
    const firstMonth =
      typeof e.firstInvoiceMonthIndex === "number"
        ? e.firstInvoiceMonthIndex
        : refDate.getMonth();
    const firstYear = e.firstInvoiceYear || refDate.getFullYear();

    const diff = monthsBetween(firstMonth, firstYear, currentMonthIndex, currentYear);
    if (diff < 0 || diff >= totalInstallments) continue; // não entra nesta fatura

    const installmentNumber = totalInstallments === 1 ? 1 : diff + 1;
    const installmentAmount =
      totalInstallments === 1 ? e.amount : e.amount / totalInstallments;

    total += installmentAmount;

    invoiceItems.push({
      ...e,
      installmentNumber,
      totalInstallments,
      installmentAmount,
    });
  }

  return (
    <>
      <Overlay onClose={onClose} accentColor={accentColor} kind="expense">
        <header className="finlann-modal__header" style={{ alignItems: "stretch" }}>
          {/* Linha 1: Fatura do cartão de mês/ano + X no canto direito */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
            }}
          >
            <p className="finlann-modal__eyebrow">
              Fatura do cartão de {invoiceLabel}
            </p>
            <button
              type="button"
              className="finlann-modal__close"
              onClick={onClose}
              aria-label="Fechar fatura"
            >
              ×
            </button>
          </div>

          {/* Linha 2: Nome do cartão | Total */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
              marginTop: 4,
            }}
          >
            <h2 className="finlann-modal__title">{card.label}</h2>
            <span className="finlann-card__value">R$ {formatCurrency(total)}</span>
          </div>

          {/* Linha 3: Datas de fechamento/vencimento */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
              marginTop: 2,
            }}
          >
            <p className="finlann-field__label" style={{ margin: 0 }}>
              Fecha dia {card.billingCloseDay || "–"}/{invoiceMonthNumber} · Vence dia {card.billingDueDay || "–"}/{invoiceMonthNumber}
            </p>
          </div>
        </header>

        <div className="finlann-modal__body finlann-modal__body--scroll">
          <div className="finlann-field" style={{ marginBottom: 8 }}>
            {/* espaço reservado, mas sem conteúdo extra aqui agora */}
          </div>

          <div className="finlann-statement-table finlann-statement-table--card">
            <div className="finlann-statement-row finlann-statement-row--header">
              <span>Dia</span>
              <span>Descrição</span>
              <span style={{ textAlign: "center" }}>Parc.</span>
              <span>Valor</span>
            </div>

            {invoiceItems.length === 0 && (
              <div className="finlann-statement-row" style={{ opacity: 0.7 }}>
                <span>–</span>
                <span>Nenhum lançamento ainda</span>
                <span>–</span>
                <span className="finlann-value-cell">
                  <span className="finlann-value-prefix">R$</span>
                  <span className="finlann-value-number">0,00</span>
                </span>
              </div>
            )}

            {invoiceItems.map((expense) => {
              const isSelected = selectedIds.includes(expense.id);
              return (
                <div
                  key={`${expense.id}-${expense.installmentNumber || 1}`}
                  className="finlann-statement-row"
                  style={selectionMode && isSelected ? { background: "rgba(37,99,235,0.15)" } : undefined}
                  onClick={() => {
                    if (selectionMode) toggleSelected(expense.id);
                  }}
                >
                  {selectionMode ? (
                    <span>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelected(expense.id);
                        }}
                        readOnly
                      />
                    </span>
                  ) : (
                    <span>{formatDate(expense.purchaseDate || expense.createdAt)}</span>
                  )}
                  <span className="finlann-statement-desc">
                    {expense.description || "(sem descrição)"}
                  </span>
                  <span style={{ textAlign: "center" }}>{getInstallmentLabel(expense)}</span>
                  <span className="finlann-value-cell">
                    <span className="finlann-value-prefix">R$</span>
                    <span className="finlann-value-number">
                      {formatCurrency(expense.installmentAmount)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <footer className="finlann-modal__footer" style={{ justifyContent: "space-between", alignItems: "center" }}>
          {/* Esquerda: seleção (sempre visível) + adicionar (apenas fora do modo seleção) */}
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="finlann-modal__close"
              onClick={() => setSelectionMode((prev) => !prev)}
              aria-label={selectionMode ? "Sair do modo seleção" : "Selecionar lançamentos"}
            >
              {selectionIcon}
            </button>
            {!selectionMode && (
              <button
                type="button"
                className="finlann-card-add"
                onClick={() => setShowAddExpense(true)}
                aria-label="Adicionar compra nesta fatura"
              >
                +
              </button>
            )}
          </div>

          {/* Direita: ações de seleção e engrenagem */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {selectionMode && (
              <div style={{ display: "flex", gap: 6 }}>
                {/* Editar */}
                <button
                  type="button"
                  className={"finlann-modal__secondary"}
                  disabled={selectedIds.length !== 1}
                  style={
                    selectedIds.length === 1
                      ? { borderColor: "rgba(96,165,250,0.8)", color: "#e5e7eb" }
                      : undefined
                  }
                  onClick={() => {
                    if (selectedIds.length !== 1) return;
                    const target = invoiceItems.find((e) => e.id === selectedIds[0]);
                    if (!target) return;
                    setEditingExpense(target);
                  }}
                >
                  Editar
                </button>

                {/* Transferir */}
                <button
                  type="button"
                  className={"finlann-modal__secondary"}
                  disabled={
                    selectedIds.length === 0 ||
                    (allCards || []).filter((c) => c.id !== card.id).length === 0
                  }
                  style={
                    selectedIds.length > 0 &&
                    (allCards || []).filter((c) => c.id !== card.id).length > 0
                      ? { borderColor: "rgba(56,189,248,0.9)", color: "#e5e7eb" }
                      : undefined
                  }
                  onClick={() => {
                    const candidates = (allCards || []).filter((c) => c.id !== card.id);
                    if (!candidates.length || !selectedIds.length) return;
                    setTransferTargetId(candidates[0].id);
                    setShowTransferModal(true);
                  }}
                >
                  Transferir
                </button>

                {/* Excluir */}
                <button
                  type="button"
                  className={"finlann-modal__secondary"}
                  disabled={selectedIds.length === 0}
                  style={
                    selectedIds.length > 0
                      ? { borderColor: "rgba(239,68,68,0.8)", color: "#e5e7eb" }
                      : undefined
                  }
                  onClick={() => {
                    if (!selectedIds.length) return;
                    onRemoveExpenses?.(selectedIds);
                    clearSelection();
                  }}
                >
                  Excluir
                </button>
              </div>
            )}

            {/* Engrenagem para editar cartão (só fora do modo seleção) */}
            {!selectionMode && (
              <button
                type="button"
                className="finlann-modal__close"
                onClick={() => setShowEditCard(true)}
                aria-label="Editar cartão"
              >
                ⚙
              </button>
            )}
          </div>
        </footer>
      </Overlay>

      {showEditCard && (
        <CardModal
          initialCard={card}
          onClose={() => setShowEditCard(false)}
          onSave={(updated) => {
            onUpdateCard?.(updated);
            setShowEditCard(false);
          }}
        />
      )}

      {showTransferModal && (
        <Overlay onClose={() => setShowTransferModal(false)}>
          <header className="finlann-modal__header">
            <div>
              <p className="finlann-modal__eyebrow">Transferir lançamentos</p>
              <h2 className="finlann-modal__title">Escolha o cartão destino</h2>
            </div>
          </header>

          <div className="finlann-modal__body">
            <div className="finlann-field">
              <label className="finlann-field__label">Cartão</label>
              <div className="finlann-select">
                <select
                  value={transferTargetId}
                  onChange={(e) => setTransferTargetId(e.target.value)}
                >
                  {(allCards || [])
                    .filter((c) => c.id !== card.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>

          <footer className="finlann-modal__footer">
            <button
              type="button"
              className="finlann-modal__secondary"
              onClick={() => setShowTransferModal(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="finlann-modal__primary"
              disabled={!transferTargetId || selectedIds.length === 0}
              onClick={() => {
                if (!transferTargetId || !selectedIds.length) return;
                onTransferExpenses?.(selectedIds, transferTargetId);
                clearSelection();
                setShowTransferModal(false);
              }}
            >
              Transferir
            </button>
          </footer>
        </Overlay>
      )}

      {showAddExpense && (
        <ExpenseModal
          onClose={() => setShowAddExpense(false)}
          onSave={(expense) => {
            onAddExpense?.(expense);
            setShowAddExpense(false);
          }}
          onAddCard={null}
          existingCards={allCards}
          lastUsedCardId={lastUsedCardId}
          initialPaymentType="credit"
          lockCardId={card.id}
          allowDateEdit
          initialDate={new Date(currentYear, currentMonthIndex, 1)
            .toISOString()
            .slice(0, 10)}
        />
      )}

      {editingExpense && (
        <ExpenseModal
          onClose={() => {
            setEditingExpense(null);
            // ao fechar o modal de edição, limpa seleção e sai do modo seleção
            clearSelection();
          }}
          onSave={(updatedExpense) => {
            // Atualiza a despesa existente em vez de criar uma nova
            onUpdateExpenses?.((expense) => {
              if (expense.id !== editingExpense.id) return undefined;
              return {
                ...expense,
                ...updatedExpense,
              };
            });
            setEditingExpense(null);
            // após salvar, também limpa seleção e volta ao modo normal
            clearSelection();
          }}
          onAddCard={null}
          existingCards={allCards}
          lastUsedCardId={lastUsedCardId}
          initialPaymentType={editingExpense.method}
          lockCardId={editingExpense.method === "credit" ? editingExpense.cardId : null}
          allowDateEdit
          initialDate={(editingExpense.purchaseDate || editingExpense.createdAt)
            .slice(0, 10)}
          initialExpense={editingExpense}
        />
      )}
    </>
  );
}
