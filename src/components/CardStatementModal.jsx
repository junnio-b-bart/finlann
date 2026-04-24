import { useState } from "react";
import Overlay from "./Overlay.jsx";
import CardModal from "./CardModal.jsx";
import ExpenseModal from "./ExpenseModal.jsx";
import { getCardInvoiceCycleDates, getCardInvoiceForMonth } from "../data/finance.js";
import penIcon from "../assets/icons/pen.png";

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
  onPayInvoice,
  paidInvoices,
}) {
  const [showEditCard, setShowEditCard] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState("");
  const [editingExpense, setEditingExpense] = useState(null);
  const [showPayConfirm, setShowPayConfirm] = useState(false);

  // Verifica se esta fatura já foi marcada como paga
  const isThisInvoicePaid = (paidInvoices || []).some(
    (p) => p.cardId === card.id && p.monthIndex === currentMonthIndex && p.year === currentYear
  );

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
  const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long" });
  const invoiceDate = new Date(currentYear, currentMonthIndex, 1);
  const invoiceMonthLabel = monthFormatter.format(invoiceDate).toUpperCase();
  const invoiceYearShort = String(invoiceDate.getFullYear()).slice(-2);
  const invoiceLabel = `${invoiceMonthLabel} de ${invoiceYearShort}`;
  const selectionIcon = selectionMode ? "☑" : "☐"; // caixinha marcada/vazia

  // Reconstrói a lógica de fatura para este cartão e mês/ano
  const _legacyInvoiceItems = [];
  let _legacyTotal = 0;

  function _monthsBetween(fromMonthIndex, fromYear, toMonthIndex, toYear) {
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

    const diff = _monthsBetween(firstMonth, firstYear, currentMonthIndex, currentYear);
    if (diff < 0 || diff >= totalInstallments) continue; // não entra nesta fatura

    const installmentNumber = totalInstallments === 1 ? 1 : diff + 1;
    const installmentAmount =
      totalInstallments === 1 ? e.amount : e.amount / totalInstallments;

    _legacyTotal += installmentAmount;

    _legacyInvoiceItems.push({
      ...e,
      installmentNumber,
      totalInstallments,
      installmentAmount,
    });
  }

  const invoiceState = { cards: allCards || [], expenses, paidInvoices: paidInvoices || [] };
  const { items: invoiceItems, total } = getCardInvoiceForMonth(
    invoiceState,
    card.id,
    currentMonthIndex,
    currentYear
  );
  const { closingDate, dueDate } = getCardInvoiceCycleDates(card, currentMonthIndex, currentYear);
  const closingLabel = closingDate ? formatDate(closingDate.toISOString()) : "â€“";
  const dueLabel = dueDate ? formatDate(dueDate.toISOString()) : "â€“";

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
              Fatura de {invoiceLabel}
            </p>
            <button
              type="button"
              className="finlann-modal__secondary finlann-statement-edit-card-btn"
              onClick={() => setShowEditCard(true)}
              aria-label="Editar cartao"
            >
              <img src={penIcon} alt="" className="finlann-statement-edit-card-btn__icon" />
              <span>Editar cartao</span>
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
            <p className="finlann-field__label" style={{ margin: 0, display: "none" }}>
              Datas do ciclo
            </p>
            <p className="finlann-field__label" style={{ margin: 0 }}>
              Fecha dia {closingLabel} · Vence dia {dueLabel}
            </p>
          </div>
        </header>

        <div className="finlann-modal__body finlann-modal__body--scroll">
          <div className="finlann-field" style={{ marginBottom: 8 }}>
            {/* espaço reservado, mas sem conteúdo extra aqui agora */}
          </div>

          <div className="finlann-statement-scroll finlann-statement-scroll--card-limit">
            <div className="finlann-statement-table finlann-statement-table--card">
            <div className="finlann-statement-row finlann-statement-row--header">
              <span>Data</span>
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
        </div>

        <footer className="finlann-modal__footer" style={{ justifyContent: "space-between", alignItems: "center" }}>
          {/* Esquerda: seleção (sempre visível) + adicionar (apenas fora do modo seleção) */}
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="finlann-modal__close finlann-statement-icon-btn"
              onClick={() => setSelectionMode((prev) => !prev)}
              aria-label={selectionMode ? "Sair do modo seleção" : "Selecionar lançamentos"}
            >
              {selectionIcon}
            </button>
            {!selectionMode && (
              <>
                <button
                  type="button"
                  className="finlann-statement-add-row-btn"
                  onClick={() => setShowAddExpense(true)}
                  aria-label="Adicionar item nesta fatura"
                >
                  + Adicionar item
                </button>
                {invoiceItems.length > 0 && !isThisInvoicePaid && onPayInvoice && (
                  <button
                    type="button"
                    className="finlann-statement-add-row-btn finlann-statement-add-row-btn--pay"
                    onClick={() => setShowPayConfirm(true)}
                    aria-label="Marcar fatura como paga"
                  >
                    Pagar fatura
                  </button>
                )}
              </>
            )}
          </div>

          {/* Direita: ações de seleção e engrenagem */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {selectionMode && (
              <div style={{ display: "flex", gap: 6 }}>
                {/* Editar (esquerda) */}
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

                {/* Transferir (meio) */}
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

                {/* Excluir (direita) */}
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

            {/* Botão de pagar fatura + engrenagem (fora do modo seleção) */}
            {false && (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {/* Pagar fatura: só aparece quando há itens e a fatura não foi paga */}
                {false && invoiceItems.length > 0 && !isThisInvoicePaid && onPayInvoice && (
                  <button
                    type="button"
                    className="finlann-modal__secondary finlann-statement-pay-btn"
                    onClick={() => setShowPayConfirm(true)}
                    aria-label="Marcar fatura como paga"
                  >
                    ✓ Pagar fatura
                  </button>
                )}
                {false && isThisInvoicePaid && (
                  <span className="finlann-statement-paid-label">
                    ✓ Paga
                  </span>
                )}
                <button
              type="button"
              className="finlann-modal__secondary finlann-statement-edit-card-btn"
              onClick={() => setShowEditCard(true)}
              aria-label="Editar cartao"
            >
              <img src={penIcon} alt="" className="finlann-statement-edit-card-btn__icon" />
              <span>Editar cartao</span>
            </button>
              </div>
            )}
          </div>
        </footer>
      </Overlay>

      {/* Modal de confirmação: pagar fatura */}
      {showPayConfirm && (
        <div className="finlann-overlay">
          <div className="finlann-overlay__panel">
            <header className="finlann-modal__header">
              <p className="finlann-modal__eyebrow">Fatura do cartão</p>
              <h2 className="finlann-modal__title">Marcar como paga?</h2>
            </header>
            <div className="finlann-modal__body">
              <p style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.6 }}>
                A fatura de <strong>{card.label}</strong> com total de{" "}
                <strong>R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> será marcada como paga e
                desaparecerá do resumo de saídas.
              </p>
              <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 8 }}>
                Os lançamentos continuam no histórico para consulta.
              </p>
            </div>
            <div className="finlann-settings-actions" style={{ marginTop: 8 }}>
              <div className="finlann-settings-actions-row">
                <button
                  type="button"
                  className="finlann-chip finlann-chip--outline"
                  onClick={() => setShowPayConfirm(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="finlann-chip finlann-chip--solid"
                  style={{ background: "#16a34a", borderColor: "#16a34a" }}
                  onClick={() => {
                    onPayInvoice?.(card.id, currentMonthIndex, currentYear);
                    setShowPayConfirm(false);
                    onClose?.();
                  }}
                >
                  Confirmar pagamento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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


