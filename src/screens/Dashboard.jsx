import { useState } from "react";
import "../styles/globals.css";
import "../styles/tokens.css";
import ExpenseModal from "../components/ExpenseModal.jsx";
import CardStatementModal from "../components/CardStatementModal.jsx";
import IncomeModal from "../components/IncomeModal.jsx";
import IncomeStatementModal from "../components/IncomeStatementModal.jsx";
import MonthPickerModal from "../components/MonthPickerModal.jsx";
import { getMonthlySummary } from "../data/finance.js";
import logoFinlann from "../assets/FinlannLogo.png";

const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function isSameMonthYear(isoDate, monthIndex, year) {
  if (!isoDate) return false;
  const d = new Date(isoDate);
  return d.getMonth() === monthIndex && d.getFullYear() === year;
}

export default function Dashboard({ financeState, onAddExpense, onAddIncome, onAddCard, onUpdateCard, onRemoveExpenses, onTransferExpenses, onRemoveIncomes, onUpdateIncomes }) {
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [statementCard, setStatementCard] = useState(null);
  const [statementIncomeType, setStatementIncomeType] = useState(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showFixedStatement, setShowFixedStatement] = useState(false);

  const today = new Date();
  const [currentMonthIndex, setCurrentMonthIndex] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const summary = getMonthlySummary(financeState, currentMonthIndex, currentYear);
  const lastCreditExpense = [...financeState.expenses]
    .filter((e) => e.method === "credit" && e.cardId)
    .slice(-1)[0];
  const lastUsedCardId = lastCreditExpense?.cardId || null;

  const format = (value) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="finlann-dashboard">
      {/* TOPO FIXO: logo + título da página (mês/ano) + cards de resumo */}
      <header className="finlann-header finlann-header--centered">
        <div className="finlann-header__left">
          <div className="finlann-logo-pill">
            <img
              src={logoFinlann}
              alt="Finlann"
              className="finlann-logo-img"
            />
          </div>
          <button
            type="button"
            className="finlann-header__subtitle finlann-header__subtitle--clickable"
            onClick={() => setShowMonthPicker(true)}
          >
            {MONTH_LABELS[currentMonthIndex]} · {currentYear}
          </button>
        </div>
      </header>

      <section className="finlann-cards-row">
        <article className="finlann-card finlann-card--income">
          <p className="finlann-card__label">Entradas</p>
          <p className="finlann-card__value">{format(summary.totalIncomes)}</p>
        </article>

        <article className="finlann-card finlann-card--expense">
          <p className="finlann-card__label">Saídas</p>
          <p className="finlann-card__value">{format(summary.totalExpenses)}</p>
        </article>

        <article className="finlann-card finlann-card--balance">
          <p className="finlann-card__label">Saldo</p>
          <p className="finlann-card__value">{format(summary.balance)}</p>
        </article>
      </section>

      {/* CONTEÚDO ROLÁVEL: gastos fixos + resumo de entradas/saídas */}
      <div className="finlann-dashboard__scroll">
        <section className="finlann-section--fixed">
          <header className="finlann-section__header finlann-section__header--fixed">
            <h2 className="finlann-section__title">Gastos fixos do mês</h2>
          </header>
          <div className="finlann-fixed-summary">
            <button
              type="button"
              className="finlann-fixed-summary__chart-button"
              onClick={() => setShowFixedStatement(true)}
            >
              <div className="finlann-fixed-summary__chart" />
            </button>
          </div>
        </section>

        <section className="finlann-section">
          <header className="finlann-section__header">
            <h2 className="finlann-section__title">Resumo de entradas</h2>
            <span className="finlann-section__tag">Mês atual</span>
          </header>

          <div className="finlann-list">
          {Object.keys(summary.incomesByType || {}).length === 0 && (
            <div className="finlann-list-item" style={{ opacity: 0.7 }}>
              <div className="finlann-list-item__left">
                <span className="finlann-list-item__avatar finlann-list-item__avatar--income" />
                <div>
                  <p className="finlann-list-item__title">Nenhuma entrada ainda</p>
                  <p className="finlann-list-item__subtitle">
                    Registre entradas para ver o resumo aqui
                  </p>
                </div>
              </div>
            </div>
          )}

          {Object.entries(summary.incomesByType || {}).map(([typeId, total]) => {
            const label =
              typeId === "pix"
                ? "Pix"
                : typeId === "transfer"
                ? "Transferência"
                : typeId === "cash"
                ? "Dinheiro"
                : typeId
                    .split("-")
                    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                    .join(" ");

            const monthlyIncomesForType = financeState.incomes
              .filter((i) => i.type === typeId)
              .filter((i) => isSameMonthYear(i.createdAt, currentMonthIndex, currentYear));

            const lastIncome = monthlyIncomesForType.slice(-1)[0];
            const subtitle = lastIncome?.origin || "Entradas registradas";

            return (
              <button
                key={typeId}
                className="finlann-list-item"
                type="button"
                onClick={() => setStatementIncomeType({ id: typeId, label })}
              >
                <div className="finlann-list-item__left">
                  <span className="finlann-list-item__avatar finlann-list-item__avatar--income" />
                  <div>
                    <p className="finlann-list-item__title">{label}</p>
                    <p className="finlann-list-item__subtitle">{subtitle}</p>
                  </div>
                </div>
                <div className="finlann-list-item__right">
                  <span className="finlann-list-item__value finlann-list-item__value--positive">
                    {format(total)}
                  </span>
                </div>
              </button>
            );
          })}
          </div>
        </section>

        <section className="finlann-section">
          <header className="finlann-section__header">
            <h2 className="finlann-section__title">Resumo de saídas</h2>
            <span className="finlann-section__tag">Mês atual</span>
          </header>

          <div className="finlann-list">
          {financeState.cards.length === 0 && (
            <div className="finlann-list-item" style={{ opacity: 0.7 }}>
              <div className="finlann-list-item__left">
                <span className="finlann-list-item__avatar finlann-list-item__avatar--credit" />
                <div>
                  <p className="finlann-list-item__title">Nenhum cartão ainda</p>
                  <p className="finlann-list-item__subtitle">
                    Crie seu primeiro cartão na hora de registrar uma saída
                  </p>
                </div>
              </div>
            </div>
          )}

          {financeState.cards.map((card) => {
            const cardTotal = summary.expensesByCard[card.id] || 0;
            if (cardTotal === 0) {
              return null; // não mostra cartões sem fatura neste mês
            }
            return (
              <button
                key={card.id}
                className="finlann-list-item"
                type="button"
                onClick={() => setStatementCard(card)}
              >
                <div className="finlann-list-item__left">
                  <span
                    className="finlann-list-item__avatar finlann-list-item__avatar--credit"
                    style={{ background: card.color || undefined }}
                  />
                  <div>
                    <p className="finlann-list-item__title">{card.label}</p>
                    <p className="finlann-list-item__subtitle">Fatura do mês</p>
                  </div>
                </div>
                <div className="finlann-list-item__right">
                  <span className="finlann-list-item__value finlann-list-item__value--negative">
                    {format(cardTotal)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
      </div>{/* fim do conteúdo rolável */}

      {/* BORDA INFERIOR FIXA DENTRO DO APP: botões + barra de menu */}
      <section className="finlann-actions">
        <button
          className="finlann-action finlann-action--income"
          type="button"
          onClick={() => setShowIncomeModal(true)}
        >
          + Entrada
        </button>
        <button
          className="finlann-action finlann-action--expense"
          type="button"
          onClick={() => setShowExpenseModal(true)}
        >
          - Saída
        </button>
      </section>

      {showExpenseModal && (
        <ExpenseModal
          onClose={() => setShowExpenseModal(false)}
          onSave={(expense) => {
            onAddExpense(expense);
            setShowExpenseModal(false);
          }}
          onAddCard={onAddCard}
          existingCards={financeState.cards}
          lastUsedCardId={lastUsedCardId}
        />
      )}

      {showIncomeModal && (
        <IncomeModal
          onClose={() => setShowIncomeModal(false)}
          onSave={(income) => {
            onAddIncome(income);
            setShowIncomeModal(false);
          }}
        />
      )}

      {statementCard && (
        <CardStatementModal
          card={statementCard}
          currentMonthIndex={currentMonthIndex}
          currentYear={currentYear}
          expenses={financeState.expenses.filter(
            (e) => e.method === "credit" && e.cardId === statementCard.id
          )}
          allCards={financeState.cards}
          lastUsedCardId={lastUsedCardId}
          onClose={() => setStatementCard(null)}
          onUpdateCard={onUpdateCard}
          onAddExpense={onAddExpense}
          onRemoveExpenses={onRemoveExpenses}
          onTransferExpenses={onTransferExpenses}
        />
      )}

      {statementIncomeType && (
        <IncomeStatementModal
          typeLabel={statementIncomeType.label}
          typeId={statementIncomeType.id}
          incomes={financeState.incomes.filter(
            (i) => i.type === statementIncomeType.id
          )}
          onClose={() => setStatementIncomeType(null)}
          onRemoveIncomes={onRemoveIncomes}
        />
      )}

      {showMonthPicker && (
        <MonthPickerModal
          initialMonthIndex={currentMonthIndex}
          initialYear={currentYear}
          onClose={() => setShowMonthPicker(false)}
          onConfirm={({ monthIndex, year }) => {
            setCurrentMonthIndex(monthIndex);
            setCurrentYear(year);
          }}
        />
      )}

      {showFixedStatement && (
        <div className="finlann-overlay">
          <div className="finlann-overlay__panel">
            <header className="finlann-modal__header">
              <p className="finlann-modal__eyebrow">Gastos fixos</p>
              <h2 className="finlann-modal__title">Resumo de saídas fixas</h2>
            </header>
            <div className="finlann-modal__body">
              <p className="finlann-settings-profile-subtitle">
                Aqui vai aparecer a lista de saídas fixas agrupadas por categoria
                (carro, streaming, internet, etc.).
              </p>
            </div>
            <div className="finlann-settings-actions" style={{ marginTop: 8 }}>
              <div className="finlann-settings-actions-row">
                <button
                  type="button"
                  className="finlann-chip finlann-chip--solid finlann-chip--accent"
                  onClick={() => setShowFixedStatement(false)}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
