import { useState } from "react";
import Overlay from "./Overlay.jsx";
import CardModal from "./CardModal.jsx";
import { formatCurrencyInput, parseCurrencyInput } from "../utils/currency.js";

const paymentTypes = [
  { id: "credit", label: "Crédito" },
  { id: "debit", label: "Débito" },
  { id: "pix", label: "Pix" },
  { id: "cash", label: "Dinheiro" },
];

const debitCards = [
  { id: "debito_principal", label: "Débito conta principal" },
  { id: "debito_secundario", label: "Débito conta secundária" },
];

const installments = [1, 2, 3, 4, 5, 6, 8, 10, 12];

const defaultCategories = [
  { id: "alimentacao", label: "Alimentação" },
  { id: "carro", label: "Carro" },
  { id: "lazer", label: "Lazer" },
  { id: "compras", label: "Compras" },
  { id: "investimentos", label: "Investimentos" },
  { id: "casa", label: "Casa" },
  { id: "saude", label: "Saúde" },
  { id: "outros", label: "Outros" },
];

export default function ExpenseModal({
  onClose,
  onSave,
  onAddCard,
  existingCards,
  lastUsedCardId,
  // opções extras para uso dentro da fatura do cartão
  initialPaymentType = null,
  lockCardId = null,
  allowDateEdit = false,
  initialDate = null,
  // quando presente, entra em modo edição de uma despesa existente
  initialExpense = null,
}) {
  const [paymentType, setPaymentType] = useState(
    initialExpense?.method || initialPaymentType
  );
  const [amount, setAmount] = useState(
    initialExpense
      ? initialExpense.amount.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })
      : ""
  );
  const [description, setDescription] = useState(initialExpense?.description || "");
  const [purchaseDate, setPurchaseDate] = useState(() => {
    const raw = initialExpense?.purchaseDate || initialExpense?.createdAt || initialDate || new Date();
    const baseDate = raw instanceof Date ? raw : new Date(raw);
    return baseDate.toISOString().slice(0, 10); // yyyy-mm-dd para o input[type=date]
  });
  const [hasTypedDescription, setHasTypedDescription] = useState(false);
  const [hasTypedAmount, setHasTypedAmount] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState(
    initialExpense?.cardId || lastUsedCardId || ""
  );
  const [selectedInstallment, setSelectedInstallment] = useState(
    initialExpense?.totalInstallments && initialExpense.totalInstallments > 1
      ? String(initialExpense.totalInstallments)
      : "vista"
  );
  const [isFixed, setIsFixed] = useState(!!initialExpense?.isFixed);

  // categorias de saída (local, sem backend ainda)
  const [categories, setCategories] = useState(defaultCategories);
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    initialExpense?.category || "outros"
  );

  const creditCards = (existingCards || []).filter(
    (c) => !c.kind || c.kind === "credit"
  );
  const debitCards = (existingCards || []).filter((c) => c.kind === "debit");

  const effectiveCardId = lockCardId || selectedCardId;

  const hasCards = existingCards && existingCards.length > 0;

  function handleAmountChange(e) {
    const raw = e.target.value;

    if (!hasTypedAmount && raw !== "") {
      setHasTypedAmount(true);
    }

    const formatted = formatCurrencyInput(raw);
    setAmount(formatted);
  }

  function handlePaymentClick(id) {
    // Se o cartão está travado (uso dentro de fatura), o método de pagamento
    // também fica travado em crédito.
    if (lockCardId && id !== "credit") return;

    setPaymentType((current) => {
      const next = current === id ? null : id;

      if (next === "credit" && creditCards.length) {
        setSelectedCardId((prev) => {
          if (prev && creditCards.some((c) => c.id === prev)) return prev;
          if (lastUsedCardId && creditCards.some((c) => c.id === lastUsedCardId))
            return lastUsedCardId;
          return creditCards[0]?.id || "";
        });
      }

      if (next === "debit") {
        if (debitCards.length) {
          setSelectedCardId((prev) => {
            if (prev && debitCards.some((c) => c.id === prev)) return prev;
            return debitCards[0]?.id || "";
          });
        } else {
          // nenhum cartão de débito ainda → não seleciona nenhum cartão
          setSelectedCardId("");
        }
      }

      return next;
    });
  }

  function handleCardSave(newCard) {
    onAddCard?.(newCard);
    setSelectedCardId(newCard.id);
    setShowCardModal(false);
  }

  const canSave =
    description.trim().length > 0 &&
    parseCurrencyInput(amount) > 0 &&
    !!paymentType;

  const hasAnyTyping = hasTypedDescription || hasTypedAmount;

  function handleSaveExpense() {
    if (!canSave) return;
    const numericAmount = parseCurrencyInput(amount);

    const baseDate = purchaseDate ? new Date(purchaseDate) : new Date();

    // Para compras no crédito com parcelamento, já salvamos
    // informações suficientes para futuras faturas (1/5, 2/5, 3/5...).
    const isCredit = paymentType === "credit";
    const totalInstallments =
      isCredit && selectedInstallment !== "vista"
        ? Number(selectedInstallment)
        : 1;

    const nowIso = new Date().toISOString();

    const expenseBase = initialExpense || {};

    const expense = {
      ...expenseBase,
      id:
        expenseBase.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      description: description.trim(),
      amount: numericAmount,
      method: paymentType, // credit, debit, pix, cash
      cardId: isCredit ? (lockCardId || selectedCardId || null) : null,
      isFixed,

      // novo modelo de parcelado
      totalInstallments,
      purchaseDate: baseDate.toISOString(),
      firstInvoiceMonthIndex: baseDate.getMonth(),
      firstInvoiceYear: baseDate.getFullYear(),
      category: selectedCategoryId,

      createdAt: expenseBase.createdAt || nowIso,
      updatedAt: nowIso,
    };

    onSave?.(expense);
  }

  const showCreditFields = paymentType === "credit";
  const showDebitFields = paymentType === "debit";
  const showPixFields = paymentType === "pix";

  const selectedCard = (existingCards || []).find((c) => c.id === effectiveCardId);
  const isCreditCard = selectedCard && (!selectedCard.kind || selectedCard.kind === "credit");
  const isDebitCard = selectedCard && selectedCard.kind === "debit";
  let accentColor =
    (paymentType === "credit" && isCreditCard) ||
    (paymentType === "debit" && isDebitCard)
      ? selectedCard.color
      : undefined;

  if (!accentColor && paymentType === "pix") {
    // Fundo esverdeado para Pix: claro no canto superior esquerdo → escuro no canto inferior direito
    accentColor = "linear-gradient(to bottom right, #22c55e 0%, #16a34a 40%, #020617 100%)";
  } else if (!accentColor && paymentType === "cash") {
    // Fundo esverdeado para Dinheiro: mesmo degradê, mas claro no canto superior direito → escuro no canto inferior esquerdo
    accentColor = "linear-gradient(to bottom left, #22c55e 0%, #16a34a 40%, #020617 100%)";
  }

  const isEditing = !!initialExpense;

  return (
    <>
      <Overlay
        onClose={onClose}
        accentColor={accentColor}
        kind="expense"
        closeOnBackdrop={!hasAnyTyping}
      >
        <header className="finlann-modal__header">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
            }}
          >
            <div>
              <h2 className="finlann-modal__title">
                {isEditing ? "Editar compra" : "Registrar compra"}
              </h2>
            </div>
            <button
              type="button"
              className="finlann-modal__close"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </header>

        <div className="finlann-modal__body finlann-modal__body--scroll">
          <div className="finlann-field">
            <label className="finlann-field__label">Descrição</label>
            <input
              className="finlann-field__input"
              placeholder="Ex.: mercado, gasolina, transporte..."
              value={description}
              onChange={(e) => {
                if (!hasTypedDescription && e.target.value !== "") {
                  setHasTypedDescription(true);
                }
                setDescription(e.target.value);
              }}
            />
          </div>

          {allowDateEdit && (
            <div className="finlann-field">
              <label className="finlann-field__label">Data da compra</label>
              <input
                type="date"
                className="finlann-field__input finlann-field__input--date-pill"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
          )}

          <div className="finlann-field finlann-field--amount">
            <label className="finlann-field__label">Valor</label>
            <input
              className="finlann-field__input finlann-field__input--amount"
              placeholder="R$ 0,00"
              inputMode="decimal"
              value={amount}
              onChange={handleAmountChange}
            />
          </div>

          <div className="finlann-field">
            <label className="finlann-field__label">Forma de pagamento</label>
            <div className="finlann-chips">
              {paymentTypes.map((type) => {
                const active = type.id === paymentType;
                const useAccent =
                  !!accentColor && active && (type.id === "credit" || type.id === "debit");

                const chipClassName = "finlann-chip " + "finlann-chip--outline";

                let chipStyle = undefined;

                if (useAccent) {
                  // Crédito/Débito com cartão selecionado → usa a cor do cartão
                  chipStyle = {
                    background: accentColor,
                    border: "none",
                    color: "#ecfdf5",
                  };
                } else if (active && (!accentColor || type.id === "pix" || type.id === "cash")) {
                  if (type.id === "pix") {
                    // Pix: degradê verde vindo do lado esquerdo
                    chipStyle = {
                      background:
                        "linear-gradient(135deg, #16a34a, #22c55e)",
                      border: "none",
                      color: "#ecfdf5",
                    };
                  } else if (type.id === "cash") {
                    // Dinheiro: degradê verde vindo do lado direito
                    chipStyle = {
                      background:
                        "linear-gradient(315deg, #16a34a, #22c55e)",
                      border: "none",
                      color: "#ecfdf5",
                    };
                  } else {
                    // débito/crédito selecionado sem cartão ainda → sem borda e sem fundo
                    chipStyle = {
                      border: "none",
                      background: "transparent",
                    };
                  }
                }

                return (
                  <button
                    key={type.id}
                    type="button"
                    className={chipClassName}
                    style={chipStyle}
                    onClick={() => handlePaymentClick(type.id)}
                  >
                    {type.label}
                  </button>
                );
              })}
            </div>
          </div>

          {showCreditFields && (
            <div className="finlann-conditional">
              <div className="finlann-field">
                <label className="finlann-field__label">Cartão de crédito</label>
                {creditCards.length ? (
                  <div className="finlann-card-row">
                    <div className="finlann-select finlann-select--compact">
                      <select
                        value={effectiveCardId}
                        onChange={(e) => setSelectedCardId(e.target.value)}
                        disabled={!!lockCardId}
                      >
                        {creditCards.map((card) => (
                          <option key={card.id} value={card.id}>
                            {card.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {!lockCardId && (
                      <button
                        type="button"
                        className="finlann-card-add"
                        onClick={() => setShowCardModal(true)}
                      >
                        +
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="finlann-card-row">
                    <span className="finlann-field__label" style={{ opacity: 0.8 }}>
                      Nenhum cartão cadastrado
                    </span>
                    <button
                      type="button"
                      className="finlann-card-add"
                      onClick={() => setShowCardModal(true)}
                    >
                      +
                    </button>
                  </div>
                )}
              </div>

              <div className="finlann-field">
                <label className="finlann-field__label">Parcelas</label>
                <div className="finlann-chips">
                  <button
                    type="button"
                    className={
                      "finlann-chip " +
                      (selectedInstallment === "vista" && accentColor
                        ? "finlann-chip--solid is-active"
                        : "finlann-chip--outline")
                    }
                    style={
                      selectedInstallment === "vista" && accentColor
                        ? {
                            background: accentColor,
                            border: "none",
                            color: "#ecfdf5",
                          }
                        : undefined
                    }
                    onClick={() => setSelectedInstallment("vista")}
                  >
                    À vista
                  </button>
                  {installments.map((num) => {
                    const isActive = selectedInstallment === String(num);
                    const activeStyle =
                      isActive && accentColor
                        ? {
                            background: accentColor,
                            border: "none",
                            color: "#ecfdf5",
                          }
                        : undefined;
                    return (
                      <button
                        key={num}
                        type="button"
                        className={
                          "finlann-chip " +
                          (isActive && accentColor
                            ? "finlann-chip--solid is-active"
                            : "finlann-chip--outline")
                        }
                        style={activeStyle}
                        onClick={() => setSelectedInstallment(String(num))}
                      >
                        {num}x
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {showDebitFields && (
            <div className="finlann-conditional">
              <div className="finlann-field">
                <label className="finlann-field__label">Cartão de débito</label>
                {debitCards.length ? (
                  <div className="finlann-card-row">
                    <div className="finlann-select finlann-select--compact">
                      <select
                        value={effectiveCardId}
                        onChange={(e) => setSelectedCardId(e.target.value)}
                      >
                        {debitCards.map((card) => (
                          <option key={card.id} value={card.id}>
                            {card.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {!lockCardId && (
                      <button
                        type="button"
                        className="finlann-card-add"
                        onClick={() => setShowCardModal(true)}
                      >
                        +
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="finlann-card-row">
                    <span className="finlann-field__label" style={{ opacity: 0.8 }}>
                      Nenhum cartão de débito cadastrado
                    </span>
                    <button
                      type="button"
                      className="finlann-card-add"
                      onClick={() => setShowCardModal(true)}
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {(showPixFields || paymentType === "cash") && (
            <div className="finlann-conditional">
              <div className="finlann-field">
                <label className="finlann-field__label">
                  {paymentType === "pix"
                    ? "Quem recebeu o Pix"
                    : "Onde foi pago em dinheiro"}
                </label>
                <input
                  className="finlann-field__input"
                  placeholder="Nome da pessoa ou estabelecimento"
                />
              </div>
            </div>
          )}

          <div className="finlann-field">
            <label className="finlann-field__label">Categoria</label>
            <div className="finlann-chips">
              {categories.map((cat) => {
                const active = cat.id === selectedCategoryId;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={
                      "finlann-chip " +
                      (active ? "finlann-chip--solid is-active" : "finlann-chip--outline")
                    }
                    onClick={() => setSelectedCategoryId(cat.id)}
                  >
                    {cat.label}
                  </button>
                );
              })}
              <button
                type="button"
                className="finlann-chip finlann-chip--outline"
                onClick={() => {
                  const label = window.prompt("Nome da nova categoria:");
                  if (!label) return;
                  const id = label
                    .normalize("NFD")
                    .replace(/[^\w\s-]/g, "")
                    .trim()
                    .toLowerCase()
                    .replace(/\s+/g, "_");
                  if (!id) return;
                  // evita duplicar
                  if (categories.some((c) => c.id === id)) {
                    setSelectedCategoryId(id);
                    return;
                  }
                  const next = [...categories, { id, label: label.trim() }];
                  setCategories(next);
                  setSelectedCategoryId(id);
                }}
              >
                +
              </button>
            </div>
          </div>

          <div className="finlann-field finlann-field--inline">
            <label className="finlann-field__switch-label">
              <input
                type="checkbox"
                checked={isFixed}
                onChange={(e) => setIsFixed(e.target.checked)}
              />
              <span className="finlann-field__label" style={{ marginLeft: 6 }}>
                Despesa fixa (todo mês)
              </span>
            </label>
          </div>

          {showDebitFields && (
            <div className="finlann-conditional">
              <div className="finlann-field">
                <label className="finlann-field__label">Cartão de débito</label>
                {debitCards.length ? (
                  <div className="finlann-card-row">
                    <div className="finlann-select finlann-select--compact">
                      <select
                        value={effectiveCardId}
                        onChange={(e) => setSelectedCardId(e.target.value)}
                      >
                        {debitCards.map((card) => (
                          <option key={card.id} value={card.id}>
                            {card.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {!lockCardId && (
                      <button
                        type="button"
                        className="finlann-card-add"
                        onClick={() => setShowCardModal(true)}
                      >
                        +
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="finlann-card-row">
                    <span className="finlann-field__label" style={{ opacity: 0.8 }}>
                      Nenhum cartão de débito cadastrado
                    </span>
                    <button
                      type="button"
                      className="finlann-card-add"
                      onClick={() => setShowCardModal(true)}
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {(showPixFields || paymentType === "cash") && (
            <div className="finlann-conditional">
              <div className="finlann-field">
                <label className="finlann-field__label">
                  {paymentType === "pix"
                    ? "Quem recebeu o Pix"
                    : "Onde foi pago em dinheiro"}
                </label>
                <input
                  className="finlann-field__input"
                  placeholder="Nome da pessoa ou estabelecimento"
                />
              </div>
            </div>
          )}
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
            className={
              canSave
                ? "finlann-modal__primary"
                : "finlann-modal__secondary"
            }
            onClick={handleSaveExpense}
            disabled={!canSave}
            style={!canSave ? { cursor: "not-allowed" } : undefined}
          >
            Salvar saída
          </button>
        </footer>
      </Overlay>

      {showCardModal && !lockCardId && (
        <CardModal
          onClose={() => setShowCardModal(false)}
          onSave={handleCardSave}
          initialKind={paymentType === "debit" ? "debit" : "credit"}
        />
      )}
    </>
  );
}
