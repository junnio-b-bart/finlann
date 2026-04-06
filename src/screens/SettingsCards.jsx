import { useMemo, useState } from "react";
import "../styles/globals.css";
import "../styles/tokens.css";
import "../styles/finlann.css";
import { getMonthlySummary } from "../data/finance.js";
import CardModal from "../components/CardModal.jsx";
import penIcon from "../assets/icons/pen.png";
import trashIcon from "../assets/icons/trash.png";

export default function SettingsCards({
  financeState,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onBack,
}) {
  const cards = financeState.cards || [];
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [editingCard, setEditingCard] = useState(null);

  const { cardsWithUsage } = useMemo(() => {
    const allExpenses = financeState.expenses || [];

    const now = new Date();
    const monthIndex = now.getMonth();
    const year = now.getFullYear();
    const summary = getMonthlySummary(financeState, monthIndex, year);

    const list = cards.map((card) => {
      const usageCount = allExpenses.filter(
        (expense) => expense.method === "credit" && expense.cardId === card.id
      ).length;

      const monthTotal = summary.expensesByCard?.[card.id] || 0;

      return {
        card,
        usageCount,
        monthTotal,
      };
    });

    list.sort((a, b) => b.usageCount - a.usageCount);

    return { cardsWithUsage: list };
  }, [cards, financeState]);

  return (
    <div className="finlann-dashboard">
      <div className="finlann-header-strip">
        <header className="finlann-header">
          <button
            type="button"
            className="finlann-modal__secondary"
            onClick={onBack}
            style={{ flexShrink: 0 }}
          >
            ← Voltar
          </button>
          <div className="finlann-header__left" style={{ marginLeft: 12 }}>
            <h1 className="finlann-section__title">Seus cartões</h1>
          </div>
        </header>
      </div>

      <section className="finlann-section finlann-section--history finlann-section--cards">
        <div className="finlann-section__scroll">
          {cardsWithUsage.length > 0 ? (
            <div className="finlann-list" style={{ marginTop: 12 }}>
              {cardsWithUsage.map(({ card, monthTotal }) => {
                const isExpanded = expandedCardId === card.id;

                return (
                  <article key={card.id} className="finlann-card-stack">
                    <div
                      className="finlann-card finlann-card--full"
                      style={{ background: card.color || undefined }}
                    >
                      <div className="finlann-card-full__header">
                        <span className="finlann-card-full__label">Cartão de crédito</span>
                      </div>

                      <div className="finlann-card-full__body">
                        <p className="finlann-card-full__name">{card.label}</p>
                        <p className="finlann-card-full__meta">
                          Fecha em {card.billingCloseDay || "?"} · Vence em{" "}
                          {card.billingDueDay || "?"}
                        </p>
                      </div>

                      <div className="finlann-card-full__footer-row">
                        <button
                          type="button"
                          className="finlann-card-summary__toggle"
                          onClick={() =>
                            setExpandedCardId((prev) => (prev === card.id ? null : card.id))
                          }
                        >
                          <span
                            className={
                              "finlann-card-summary__chevron" + (isExpanded ? " is-open" : "")
                            }
                          >
                            ▾
                          </span>
                          <span className="finlann-card-summary__label">Fatura do mês</span>
                        </button>

                        <div className="finlann-card-actions">
                          <button
                            type="button"
                            className="finlann-modal__secondary finlann-card-action--edit"
                            style={{ borderColor: "#ffffff", color: "#ffffff" }}
                            onClick={() => {
                              setEditingCard(card);
                            }}
                          >
                            <img
                              src={penIcon}
                              alt="Editar"
                              className="finlann-card-action__icon"
                            />
                            <span
                              className="finlann-card-action__label"
                              style={{ color: "#ffffff" }}
                            >
                              Editar
                            </span>
                          </button>
                          <button
                            type="button"
                            className="finlann-modal__secondary finlann-card-action--delete"
                            onClick={() => {
                              if (!window.confirm("Tem certeza que deseja remover este cartão?")) {
                                return;
                              }
                              onDeleteCard?.(card.id);
                            }}
                          >
                            <img
                              src={trashIcon}
                              alt="Excluir"
                              className="finlann-card-action__icon"
                            />
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="finlann-card-summary finlann-card-summary--inline">
                          <div className="finlann-card-summary__row">
                            <div>
                              <p className="finlann-card-summary__hint">
                                Total previsto neste cartão
                              </p>
                            </div>
                            <p className="finlann-card-summary__value">
                              {monthTotal.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <p className="finlann-header__subtitle">
                Nenhum cartão cadastrado ainda. Crie um cartão ao registrar uma saída no crédito.
              </p>
            </div>
          )}
        </div>
      </section>

      <button
        type="button"
        className="finlann-card-add-full"
        onClick={() => setShowAddCardModal(true)}
      >
        + Adicionar cartão
      </button>

      {showAddCardModal && (
        <CardModal
          onClose={() => setShowAddCardModal(false)}
          onSave={(card) => {
            onAddCard?.(card);
            setShowAddCardModal(false);
          }}
          initialKind="credit"
        />
      )}

      {editingCard && (
        <CardModal
          initialCard={editingCard}
          onClose={() => setEditingCard(null)}
          onSave={(updatedCard) => {
            onUpdateCard?.(updatedCard);
            setEditingCard(null);
          }}
        />
      )}
    </div>
  );
}
