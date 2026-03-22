import { useState } from "react";
import "../styles/globals.css";
import "../styles/tokens.css";
import ExpenseModal from "../components/ExpenseModal.jsx";
import CardStatementModal from "../components/CardStatementModal.jsx";
import IncomeModal from "../components/IncomeModal.jsx";
import IncomeStatementModal from "../components/IncomeStatementModal.jsx";
import MonthPickerModal from "../components/MonthPickerModal.jsx";
import Overlay from "../components/Overlay.jsx";
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

export default function Dashboard({
  financeState,
  onAddExpense,
  onAddIncome,
  onAddCard,
  onUpdateCard,
  onRemoveExpenses,
  onTransferExpenses,
  onRemoveIncomes,
  onUpdateIncomes,
  onUpdateExpenses,
}) {
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [statementCard, setStatementCard] = useState(null);
  const [statementIncomeType, setStatementIncomeType] = useState(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showFixedStatement, setShowFixedStatement] = useState(false);
  const [categoryStatement, setCategoryStatement] = useState(null); // { id, label }

  // Popups de resumo a partir dos chips superiores
  const [showIncomeSummaryModal, setShowIncomeSummaryModal] = useState(false);
  const [showExpenseSummaryModal, setShowExpenseSummaryModal] = useState(false);

  // Controle de retrátil para resumos (versão em lista dentro da página)
  const [showIncomeSummary, setShowIncomeSummary] = useState(true);
  const [showExpenseSummary, setShowExpenseSummary] = useState(true);
  const [showFixedSummarySection, setShowFixedSummarySection] = useState(true);

  const today = new Date();
  const [currentMonthIndex, setCurrentMonthIndex] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const summary = getMonthlySummary(financeState, currentMonthIndex, currentYear);

  // DEBUG TEMPORÁRIO: ajuda a entender por que o resumo de saídas está zerado
  const debugFirstExpense = financeState.expenses[0] || null;
  const lastCreditExpense = [...financeState.expenses]
    .filter((e) => e.method === "credit" && e.cardId)
    .slice(-1)[0];
  const lastUsedCardId = lastCreditExpense?.cardId || null;

  const format = (value) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Gera o estilo dinâmico do gráfico de pizza a partir das categorias do mês
  const categoryEntries = Object.entries(summary.expensesByCategory || {}).filter(
    ([, total]) => total > 0
  );
  const totalCategoriesAmount = categoryEntries.reduce(
    (acc, [, total]) => acc + total,
    0
  );

  const categoryColors = {
    alimentacao: "#22c55e",
    carro: "#3b82f6",
    lazer: "#f97316",
    compras: "#a855f7",
    investimentos: "#eab308",
    casa: "#38bdf8",
    saude: "#ef4444",
    outros: "#6b7280",
  };

  let chartStyle = undefined;
  if (categoryEntries.length > 0 && totalCategoriesAmount > 0) {
    // ordena por maior valor
    const sorted = [...categoryEntries].sort((a, b) => b[1] - a[1]);
    // pega no máximo 5 categorias, o resto vira "outros"
    const top = sorted.slice(0, 5);
    const rest = sorted.slice(5);
    const segments = [];
    let accumulated = 0;

    for (const [categoryId, total] of top) {
      const color = categoryColors[categoryId] || "#64748b";
      const start = (accumulated / totalCategoriesAmount) * 100;
      accumulated += total;
      const end = (accumulated / totalCategoriesAmount) * 100;
      segments.push(`${color} ${start.toFixed(2)}% ${end.toFixed(2)}%`);
    }

    if (rest.length > 0) {
      const restTotal = rest.reduce((acc, [, t]) => acc + t, 0);
      const color = categoryColors.outros;
      const start = (accumulated / totalCategoriesAmount) * 100;
      const end = ((accumulated + restTotal) / totalCategoriesAmount) * 100;
      segments.push(`${color} ${start.toFixed(2)}% ${end.toFixed(2)}%`);
    }

    chartStyle = {
      background: `conic-gradient(${segments.join(", ")})`,
    };
  } else {
    // placeholder quando ainda não há nenhuma saída no mês
    chartStyle = {
      background:
        "conic-gradient(#22c55e 0% 33%, #3b82f6 33% 66%, #eab308 66% 100%)",
      opacity: 0.5,
    };
  }

  return (
    <div className="finlann-dashboard">
      {/* TOPO FIXO: logo + título da página (mês/ano) + cards de resumo */}
      <div className="finlann-dashboard__top">
        <div className="finlann-header-strip">
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
        </div>

        <section className="finlann-cards-row">
          <article
            className="finlann-card finlann-card--income"
            onClick={() => setShowIncomeSummaryModal(true)}
            style={{ cursor: "pointer" }}
          >
            <p className="finlann-card__label">Entradas</p>
            <p className="finlann-card__value">{format(summary.totalIncomes)}</p>
          </article>

          <article
            className="finlann-card finlann-card--expense"
            onClick={() => setShowExpenseSummaryModal(true)}
            style={{ cursor: "pointer" }}
          >
            <p className="finlann-card__label">Saídas</p>
            <p className="finlann-card__value">{format(summary.totalExpenses)}</p>
          </article>

          <article className="finlann-card finlann-card--balance">
            <p className="finlann-card__label">Saldo</p>
            <p className="finlann-card__value">{format(summary.balance)}</p>
          </article>
        </section>
      </div>

      {/* CONTEÚDO: box grande com gastos fixos + resumos, rolando por dentro */}
      <div className="finlann-dashboard__scroll">
        <div className="finlann-summary-box">
          <div className="finlann-summary-inner">
          <section className="finlann-section--fixed">
            <div className="finlann-fixed-summary">
              <button
                type="button"
                className="finlann-fixed-summary__chart-button"
                onClick={() => setShowFixedStatement(true)}
              >
                <div
                  className="finlann-fixed-summary__chart"
                  style={chartStyle}
                />
              </button>
            </div>
          </section>

          <section className="finlann-section">
            <header
              className="finlann-section__header finlann-section__header--clickable"
              onClick={() => setShowIncomeSummary((prev) => !prev)}
            >
              <h2 className="finlann-section__title">
                <span
                  className={
                    "finlann-section__chevron" +
                    (showIncomeSummary ? " is-open" : "")
                  }
                >
                  &gt;
                </span>
                Resumo de entradas
              </h2>
              <span className="finlann-section__tag">
                {showIncomeSummary ? "Recolher" : "Mês atual"}
              </span>
            </header>

            {showIncomeSummary && (
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
                  .filter((i) =>
                    isSameMonthYear(i.createdAt, currentMonthIndex, currentYear)
                  );

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
            )}
          </section>

          <section className="finlann-section">
            <header
              className="finlann-section__header finlann-section__header--clickable"
              onClick={() => setShowExpenseSummary((prev) => !prev)}
            >
              <h2 className="finlann-section__title">
                <span
                  className={
                    "finlann-section__chevron" +
                    (showExpenseSummary ? " is-open" : "")
                  }
                >
                  &gt;
                </span>
                Resumo de saídas
              </h2>
              <span className="finlann-section__tag">
                {showExpenseSummary ? "Recolher" : "Mês atual"}
              </span>
            </header>

            {showExpenseSummary && (
              <div className="finlann-list">
                {financeState.cards.length === 0 &&
                  Object.keys(summary.expensesByCategory || {}).length === 0 && (
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

                {/* Quando não há cartões, mas já existem saídas categorizadas,
                    mostramos um resumo por categoria direto aqui */}
                {financeState.cards.length === 0 &&
                  Object.keys(summary.expensesByCategory || {}).length > 0 &&
                  Object.entries(summary.expensesByCategory || {}).map(
                    ([categoryId, total]) => {
                      const label =
                        categoryId === "alimentacao"
                          ? "Alimentação"
                          : categoryId === "carro"
                          ? "Carro"
                          : categoryId === "lazer"
                          ? "Lazer"
                          : categoryId === "compras"
                          ? "Compras"
                          : categoryId === "investimentos"
                          ? "Investimentos"
                          : categoryId === "casa"
                          ? "Casa"
                          : categoryId === "saude"
                          ? "Saúde"
                          : categoryId === "outros"
                          ? "Outros"
                          : categoryId
                              .split("_")
                              .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                              .join(" ");

                      return (
                        <div key={categoryId} className="finlann-list-item">
                          <div className="finlann-list-item__left">
                            <span className="finlann-list-item__avatar finlann-list-item__avatar--expense" />
                            <div>
                              <p className="finlann-list-item__title">{label}</p>
                              <p className="finlann-list-item__subtitle">
                                Saídas do mês nesta categoria
                              </p>
                            </div>
                          </div>
                          <div className="finlann-list-item__right">
                            <span className="finlann-list-item__value finlann-list-item__value--negative">
                              {format(total)}
                            </span>
                          </div>
                        </div>
                      );
                    }
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
            )}
          </section>

          {/* Terceiro bloco retrátil: Gastos fixos */}
          <section className="finlann-section">
            <header
              className="finlann-section__header finlann-section__header--clickable"
              onClick={() => setShowFixedSummarySection((prev) => !prev)}
            >
              <h2 className="finlann-section__title">
                <span
                  className={
                    "finlann-section__chevron" +
                    (showFixedSummarySection ? " is-open" : "")
                  }
                >
                  &gt;
                </span>
                Gastos fixos
              </h2>
              <span className="finlann-section__tag">
                {showFixedSummarySection ? "Recolher" : "Mês atual"}
              </span>
            </header>

            {showFixedSummarySection && (
              <div className="finlann-list">
                {financeState.expenses.filter((e) => {
                  if (!e.isFixed) return false;
                  const refDate = e.purchaseDate || e.createdAt;
                  return isSameMonthYear(refDate, currentMonthIndex, currentYear);
                }).length === 0 && (
                  <div className="finlann-list-item" style={{ opacity: 0.7 }}>
                    <div className="finlann-list-item__left">
                      <span className="finlann-list-item__avatar finlann-list-item__avatar--expense" />
                      <div>
                        <p className="finlann-list-item__title">Nenhum gasto fixo ainda</p>
                        <p className="finlann-list-item__subtitle">
                          Marque saídas como fixas para vê-las aqui todo mês.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {financeState.expenses
                  .filter((e) => {
                    if (!e.isFixed) return false;
                    const refDate = e.purchaseDate || e.createdAt;
                    return isSameMonthYear(refDate, currentMonthIndex, currentYear);
                  })
                  .map((expense) => (
                    <div key={expense.id} className="finlann-list-item">
                      <div className="finlann-list-item__left">
                        <span className="finlann-list-item__avatar finlann-list-item__avatar--expense" />
                        <div>
                          <p className="finlann-list-item__title">{expense.description || "(sem descrição)"}</p>
                          <p className="finlann-list-item__subtitle">Gasto fixo deste mês</p>
                        </div>
                      </div>
                      <div className="finlann-list-item__right">
                        <span className="finlann-list-item__value finlann-list-item__value--negative">
                          {format(expense.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </section>

          {/* Quarta caixa de resumo simples (sem retrátil) */}
          <section className="finlann-section finlann-section--tall">
            {/* box de conteúdo simples, sem título/aba ou seta */}
          </section>
          </div>{/* fim da finlann-summary-inner */}
        </div>{/* fim da finlann-summary-box */}
      </div>

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
          onUpdateExpenses={onUpdateExpenses}
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
          onUpdateIncomes={onUpdateIncomes}
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

      {showIncomeSummaryModal && (
        <Overlay onClose={() => setShowIncomeSummaryModal(false)} kind="income">
          <header className="finlann-modal__header">
            <p className="finlann-modal__eyebrow">Resumo</p>
            <h2 className="finlann-modal__title">Entradas do mês</h2>
          </header>
          <div className="finlann-modal__body finlann-modal__body--scroll">
            <div className="finlann-list">
              {Object.keys(summary.incomesByType || {}).length === 0 && (
                <div className="finlann-list-item" style={{ opacity: 0.7 }}>
                  <div className="finlann-list-item__left">
                    <span className="finlann-list-item__avatar finlann-list-item__avatar--income" />
                    <div>
                      <p className="finlann-list-item__title">Nenhuma entrada ainda</p>
                      <p className="finlann-list-item__subtitle">
                        Registre entradas para ver o resumo aqui.
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
                  .filter((i) =>
                    isSameMonthYear(i.createdAt, currentMonthIndex, currentYear)
                  );

                const lastIncome = monthlyIncomesForType.slice(-1)[0];
                const subtitle = lastIncome?.origin || "Entradas registradas";

                return (
                  <button
                    key={typeId}
                    className="finlann-list-item"
                    type="button"
                    onClick={() =>
                      setStatementIncomeType({ id: typeId, label })
                    }
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
          </div>
          <footer className="finlann-modal__footer">
            <button
              type="button"
              className="finlann-modal__secondary"
              onClick={() => setShowIncomeSummaryModal(false)}
            >
              Fechar
            </button>
          </footer>
        </Overlay>
      )}

      {showExpenseSummaryModal && (
        <Overlay onClose={() => setShowExpenseSummaryModal(false)} kind="expense">
          <header className="finlann-modal__header">
            <p className="finlann-modal__eyebrow">Resumo</p>
            <h2 className="finlann-modal__title">Saídas do mês</h2>
          </header>
          <div className="finlann-modal__body finlann-modal__body--scroll">
            <div className="finlann-list">
              {financeState.cards.length === 0 &&
                Object.keys(summary.expensesByCategory || {}).length === 0 && (
                  <div className="finlann-list-item" style={{ opacity: 0.7 }}>
                    <div className="finlann-list-item__left">
                      <span className="finlann-list-item__avatar finlann-list-item__avatar--credit" />
                      <div>
                        <p className="finlann-list-item__title">Nenhum cartão ainda</p>
                        <p className="finlann-list-item__subtitle">
                          Crie seu primeiro cartão na hora de registrar uma saída.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              {financeState.cards.length === 0 &&
                Object.keys(summary.expensesByCategory || {}).length > 0 &&
                Object.entries(summary.expensesByCategory || {}).map(
                  ([categoryId, total]) => {
                    const label =
                      categoryId === "alimentacao"
                        ? "Alimentação"
                        : categoryId === "carro"
                        ? "Carro"
                        : categoryId === "lazer"
                        ? "Lazer"
                        : categoryId === "compras"
                        ? "Compras"
                        : categoryId === "investimentos"
                        ? "Investimentos"
                        : categoryId === "casa"
                        ? "Casa"
                        : categoryId === "saude"
                        ? "Saúde"
                        : categoryId === "outros"
                        ? "Outros"
                        : categoryId
                            .split("_")
                            .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                            .join(" ");

                    return (
                      <button
                        key={categoryId}
                        type="button"
                        className="finlann-list-item"
                        onClick={() =>
                          setCategoryStatement({ id: categoryId, label })
                        }
                      >
                        <div className="finlann-list-item__left">
                          <span className="finlann-list-item__avatar finlann-list-item__avatar--expense" />
                          <div>
                            <p className="finlann-list-item__title">{label}</p>
                            <p className="finlann-list-item__subtitle">
                              Saídas do mês nesta categoria
                            </p>
                          </div>
                        </div>
                        <div className="finlann-list-item__right">
                          <span className="finlann-list-item__value finlann-list-item__value--negative">
                            {format(total)}
                          </span>
                        </div>
                      </button>
                    );
                  }
                )}

              {financeState.cards.map((card) => {
                const cardTotal = summary.expensesByCard[card.id] || 0;
                if (cardTotal === 0) return null;
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
          </div>
          <footer className="finlann-modal__footer">
            <button
              type="button"
              className="finlann-modal__secondary"
              onClick={() => setShowExpenseSummaryModal(false)}
            >
              Fechar
            </button>
          </footer>
        </Overlay>
      )}

      {showFixedStatement && (
        <Overlay onClose={() => setShowFixedStatement(false)} kind="expense">
          <header className="finlann-modal__header">
            <p className="finlann-modal__eyebrow">Balanço de saídas</p>
            <h2 className="finlann-modal__title">Resumo por categoria</h2>
          </header>
          <div className="finlann-modal__body finlann-modal__body--scroll">
            <div className="finlann-list">
              {Object.keys(summary.expensesByCategory || {}).length === 0 && (
                <div className="finlann-list-item" style={{ opacity: 0.7 }}>
                  <div className="finlann-list-item__left">
                    <span className="finlann-list-item__avatar finlann-list-item__avatar--expense" />
                    <div>
                      <p className="finlann-list-item__title">Nenhuma saída categorizada</p>
                      <p className="finlann-list-item__subtitle">
                        Categorias serão calculadas a partir das próximas saídas.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {Object.entries(summary.expensesByCategory || {}).map(
                  ([categoryId, total]) => {
                    const label =
                      categoryId === "alimentacao"
                        ? "Alimentação"
                        : categoryId === "carro"
                        ? "Carro"
                        : categoryId === "lazer"
                        ? "Lazer"
                        : categoryId === "compras"
                        ? "Compras"
                        : categoryId === "investimentos"
                        ? "Investimentos"
                        : categoryId === "casa"
                        ? "Casa"
                        : categoryId === "saude"
                        ? "Saúde"
                        : categoryId === "outros"
                        ? "Outros"
                        : categoryId
                            .split("_")
                            .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                            .join(" ");

                    return (
                      <button
                        key={categoryId}
                        type="button"
                        className="finlann-list-item"
                        onClick={() => setCategoryStatement({ id: categoryId, label })}
                      >
                        <div className="finlann-list-item__left">
                          <span className="finlann-list-item__avatar finlann-list-item__avatar--expense" />
                          <div>
                            <p className="finlann-list-item__title">{label}</p>
                            <p className="finlann-list-item__subtitle">
                              Saídas do mês nesta categoria
                            </p>
                          </div>
                        </div>
                        <div className="finlann-list-item__right">
                          <span className="finlann-list-item__value finlann-list-item__value--negative">
                            {format(total)}
                          </span>
                        </div>
                      </button>
                    );
                  }
                )}
            </div>
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
        </Overlay>
      )}

      {categoryStatement && (
        <Overlay onClose={() => setCategoryStatement(null)} kind="expense">
          <header className="finlann-modal__header">
            <p className="finlann-modal__eyebrow">Saídas por categoria</p>
            <h2 className="finlann-modal__title">{categoryStatement.label}</h2>
          </header>
          <div className="finlann-modal__body finlann-modal__body--scroll">
            <div className="finlann-statement-table">
                <div className="finlann-statement-row finlann-statement-row--header">
                  <span>Data</span>
                  <span>Descrição</span>
                  <span>Origem</span>
                  <span>Parc.</span>
                  <span>Valor</span>
                </div>

                {financeState.expenses
                  .filter((e) => {
                    if (e.category !== categoryStatement.id) return false;
                    const refDate = e.purchaseDate || e.createdAt;
                    return isSameMonthYear(refDate, currentMonthIndex, currentYear);
                  })
                  .map((e) => {
                    const refDate = e.purchaseDate || e.createdAt;
                    const d = new Date(refDate);
                    const day = String(d.getDate()).padStart(2, "0");
                    const month = String(d.getMonth() + 1).padStart(2, "0");
                    const dateLabel = `${day}/${month}`;

                    const totalInstallments = e.totalInstallments || 1;
                    const installmentLabel =
                      totalInstallments === 1
                        ? "–"
                        : `${e.installmentNumber || 1}/${totalInstallments}`;

                    const perInstallmentAmount =
                      totalInstallments === 1
                        ? e.amount
                        : e.amount / totalInstallments;

                    // Origem: cartão, Pix, dinheiro, débito
                    let originLabel = "";
                    if (e.method === "credit" || e.method === "debit") {
                      const card = financeState.cards.find((c) => c.id === e.cardId);
                      originLabel = card?.label || (e.method === "credit" ? "Crédito" : "Débito");
                    } else if (e.method === "pix") {
                      originLabel = "Pix";
                    } else if (e.method === "cash") {
                      originLabel = "Dinheiro";
                    } else {
                      originLabel = "–";
                    }

                    return (
                      <div key={e.id} className="finlann-statement-row">
                        <span>{dateLabel}</span>
                        <span className="finlann-statement-desc">
                          {e.description || "(sem descrição)"}
                        </span>
                        <span className="finlann-statement-desc">{originLabel}</span>
                        <span style={{ textAlign: "center" }}>{installmentLabel}</span>
                        <span className="finlann-value-cell">
                          <span className="finlann-value-prefix">R$</span>
                          <span className="finlann-value-number">
                            {perInstallmentAmount.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          <footer className="finlann-modal__footer">
            <button
              type="button"
              className="finlann-modal__secondary"
              onClick={() => setCategoryStatement(null)}
            >
              Voltar
            </button>
          </footer>
        </Overlay>
      )}
    </div>
  );
}
