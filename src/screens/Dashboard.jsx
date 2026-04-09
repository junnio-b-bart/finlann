import { useRef, useState } from "react";
import "../styles/globals.css";
import "../styles/tokens.css";
import ExpenseModal from "../components/ExpenseModal.jsx";
import CardStatementModal from "../components/CardStatementModal.jsx";
import IncomeModal from "../components/IncomeModal.jsx";
import IncomeStatementModal from "../components/IncomeStatementModal.jsx";
import MonthPickerModal from "../components/MonthPickerModal.jsx";
import MonthPopover from "../components/MonthPopover.jsx";
import Overlay from "../components/Overlay.jsx";
import { getMonthlySummary, getCardInvoiceForMonth, getCardInvoiceItemsForMonth, getCardInvoiceCycleDates, isInvoicePaid } from "../data/finance.js";
import logoFinlann from "../assets/logo-f-mark.png";
import calendarioIcon from "../assets/icons/calendario.png";

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

function formatDayMonth(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function toMoneyNumber(value) {
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  if (typeof value === "string") {
    const normalized = value.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
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
  onPayInvoice,
}) {
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  // statementCard mantém o cartão e qual fatura queremos ver:
  // scope: "current" (mês vigente) ou "previous" (mês anterior em aberto)
  const [statementCard, setStatementCard] = useState(null);
  const [statementIncomeType, setStatementIncomeType] = useState(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showFixedStatement, setShowFixedStatement] = useState(false);
  const [categoryStatement, setCategoryStatement] = useState(null); // { id, label }

  // Seleção/edição dentro do popup "Saídas por categoria"
  const [categorySelectionMode, setCategorySelectionMode] = useState(false);
  const [categorySelectedIds, setCategorySelectedIds] = useState([]);
  const [categoryEditingExpense, setCategoryEditingExpense] = useState(null);
  const [openColorCategory, setOpenColorCategory] = useState(null);

  // Popups de resumo a partir dos chips superiores
  const [showIncomeSummaryModal, setShowIncomeSummaryModal] = useState(false);
  const [showExpenseSummaryModal, setShowExpenseSummaryModal] = useState(false);
  const monthTriggerRef = useRef(null);

  // Controle de retrátil para resumos (versão em lista dentro da página)
  const [showIncomeSummary, setShowIncomeSummary] = useState(true);
  const [showExpenseSummary, setShowExpenseSummary] = useState(true);
  const [showFixedSummarySection, setShowFixedSummarySection] = useState(true);

  const today = new Date();
  const [currentMonthIndex, setCurrentMonthIndex] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const summary = getMonthlySummary(financeState, currentMonthIndex, currentYear);
  const expensesByCategoryFromEntries = summary.expensesByCategory || {};
  // Total de saídas exibido no card "Saídas":
  // - inclui as saídas do mês selecionado (cartões + pix + débito + dinheiro);
  // - soma também as faturas em aberto do mês anterior (cartões) que ainda não
  //   foram quitadas (paid !== true).
  const previousMonthDate = new Date(currentYear, currentMonthIndex - 1, 1);
  const previousMonthIndex = previousMonthDate.getMonth();
  const previousYear = previousMonthDate.getFullYear();

  let openFromPrevious = 0;
  for (const card of financeState.cards) {
    if (isInvoicePaid(financeState, card.id, previousMonthIndex, previousYear)) {
      continue;
    }
    const { total: prevTotal } = getCardInvoiceForMonth(
      financeState,
      card.id,
      previousMonthIndex,
      previousYear
    );
    openFromPrevious += prevTotal;
  }

  const totalExpensesForMonth = summary.totalExpenses + openFromPrevious;
  const displayedBalance = summary.totalIncomes - totalExpensesForMonth;

  function buildInvoiceCycleEntry(card, monthIdx, year) {
    if (!card) return null;
    if (isInvoicePaid(financeState, card.id, monthIdx, year)) return null;

    const { total } = getCardInvoiceForMonth(financeState, card.id, monthIdx, year);
    if (total <= 0) return null;

    const { closingDate, dueDate } = getCardInvoiceCycleDates(card, monthIdx, year);

    let status = "open";
    if (closingDate && today >= closingDate) {
      status = dueDate && today > dueDate ? "overdue" : "closed";
    }

    return {
      card,
      total,
      monthIdx,
      year,
      status,
      closingDate,
      dueDate,
      referenceLabel: `${MONTH_LABELS[monthIdx]} ${year}`,
      closingLabel: formatDayMonth(closingDate),
      dueLabel: formatDayMonth(dueDate),
    };
  }

  // Paleta de cores configurável por categoria (usada no gráfico de pizza e nos círculos do resumo)
  const CATEGORY_COLOR_OPTIONS = [
    "#22c55e",
    "#3b82f6",
    "#f97316",
    "#a855f7",
    "#eab308",
    "#38bdf8",
    "#ef4444",
    "#6b7280",
  ];

  const [categoryColors, setCategoryColors] = useState(() => {
    if (typeof window === "undefined") return {
      alimentacao: "#22c55e",
      carro: "#3b82f6",
      lazer: "#f97316",
      compras: "#a855f7",
      investimentos: "#eab308",
      casa: "#38bdf8",
      saude: "#ef4444",
      outros: "#6b7280",
    };
    try {
      const raw = window.localStorage.getItem("finlann.categoryColors");
      return raw ? JSON.parse(raw) : {
        alimentacao: "#22c55e",
        carro: "#3b82f6",
        lazer: "#f97316",
        compras: "#a855f7",
        investimentos: "#eab308",
        casa: "#38bdf8",
        saude: "#ef4444",
        outros: "#6b7280",
      };
    } catch {
      return {
        alimentacao: "#22c55e",
        carro: "#3b82f6",
        lazer: "#f97316",
        compras: "#a855f7",
        investimentos: "#eab308",
        casa: "#38bdf8",
        saude: "#ef4444",
        outros: "#6b7280",
      };
    }
  });

  // Último cartão de crédito usado — sugestão no modal de nova saída
  const lastCreditExpense = [...financeState.expenses]
    .filter((e) => e.method === "credit" && e.cardId)
    .slice(-1)[0];
  const lastUsedCardId = lastCreditExpense?.cardId || null;

  const format = (value) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Gera o estilo dinâmico do gráfico de pizza a partir das categorias do mês
  const categoryEntries = Object.entries(expensesByCategoryFromEntries || {}).filter(
    ([, total]) => total > 0
  );
  const totalCategoriesAmount = categoryEntries.reduce(
    (acc, [, total]) => acc + total,
    0
  );

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
    <div className="finlann-dashboard finlann-dashboard--ambient finlann-dashboard--summary">
      {/* TOPO FIXO: logo + título da página (mês/ano) + cards de resumo */}
      <div className="finlann-dashboard__top">
        <div className="finlann-header-strip">
          <header className="finlann-header finlann-header--centered">
            <div className="finlann-header__left">
              <div className="finlann-logo-pill">
                <img
                  src={logoFinlann}
                  alt=""
                  className="finlann-logo-img"
                />
                <span className="finlann-logo-wordmark">Finlann</span>
              </div>
              <button
                ref={monthTriggerRef}
                type="button"
                className="finlann-header__subtitle finlann-header__subtitle--clickable"
                onClick={() => setShowMonthPicker((prev) => !prev)}
                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <span>{MONTH_LABELS[currentMonthIndex]} · {currentYear}</span>
                <img
                  src={calendarioIcon}
                  alt="Selecionar mês e ano"
                  className="finlann-month-trigger__icon"
                />
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
            <p className="finlann-card__value">
              {format(totalExpensesForMonth)}
            </p>
          </article>

          <article className="finlann-card finlann-card--balance">
            <p className="finlann-card__label">Saldo</p>
            <p className="finlann-card__value">{format(displayedBalance)}</p>
          </article>

          {/* Cartões em aberto: soma de todas as despesas de cartão de crédito
              (method === "credit" && cardId) que ainda não foram marcadas
              como pagas (paid !== true). Mostra a dívida total atual nos
              cartões, independente do mês. */}
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

          {/* Resumo de entradas oculto (mantido no código para possível uso futuro) */}
          {false && (
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
                        isSameMonthYear(
                          i.createdAt,
                          currentMonthIndex,
                          currentYear
                        )
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
              )}
            </section>
          )}

          {/* Resumo de saídas oculto (mantido no código para possível uso futuro) */}
          {false && (
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
                  Object.keys(expensesByCategoryFromEntries || {}).length === 0 && (
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
                  Object.keys(expensesByCategoryFromEntries || {}).length > 0 &&
                  Object.entries(expensesByCategoryFromEntries || {}).map(
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
                      onClick={() => setStatementCard({ card, scope: "current", monthIdx: currentMonthIndex, year: currentYear })}
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
          )}

          {/* Bloco de Gastos fixos (sempre aberto) */}
          <section className="finlann-section">
            <header className="finlann-section__header">
              <h2 className="finlann-section__title">Gastos fixos</h2>
            </header>

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


      {showMonthPicker && (
        <div
          className="finlann-month-popover-overlay"
          onClick={() => setShowMonthPicker(false)}
        >
          <MonthPopover
            anchor={monthTriggerRef}
            currentMonthIndex={currentMonthIndex}
            currentYear={currentYear}
            onChange={({ monthIndex, year }) => {
              setCurrentMonthIndex(monthIndex);
              setCurrentYear(year);
            }}
            onClose={() => setShowMonthPicker(false)}
          />
        </div>
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
              {/* ────────────────────────────────────────────────────────────
                  SEÇÃO A · À VISTA
                  Pix, Débito, Dinheiro e Transferência ficam presos no mês
                  em que aconteceram — não rolam para o mês seguinte.
                  ──────────────────────────────────────────────────────────── */}
              {(() => {

                // Filtra despesas à vista do mês sendo visualizado
                const vistaExpenses = financeState.expenses.filter((e) => {
                  const dt = e.purchaseDate || e.createdAt;
                  if (!isSameMonthYear(dt, currentMonthIndex, currentYear)) return false;
                  // Tudo que não for crédito em cartão de crédito
                  return !(e.method === "credit" && e.cardId);
                });

                if (vistaExpenses.length === 0) return null;

                // Agrupa por método + cardId (para débito em cartão)
                const groups = {};

                for (const e of vistaExpenses) {
                  let key, label, color;
                  if (e.method === "debit" && e.cardId) {
                    const c = (financeState.cards || []).find((c) => c.id === e.cardId);
                    key = `debit-${e.cardId}`;
                    label = c ? `${c.label} · Débito` : "Cartão · Débito";
                    color = c?.color || null;
                  } else if (e.method === "pix") {
                    key = "pix"; label = "Pix"; color = "#22d3ee";
                  } else if (e.method === "debit") {
                    key = "debit"; label = "Débito"; color = "#818cf8";
                  } else if (e.method === "cash") {
                    key = "cash"; label = "Dinheiro"; color = "#4ade80";
                  } else if (e.method === "transfer") {
                    key = "transfer"; label = "Transferência"; color = "#a78bfa";
                  } else {
                    key = e.method || "outros"; label = "Outros"; color = null;
                  }

                  if (!groups[key]) {
                    groups[key] = {
                      label,
                      color,
                      total: 0,
                      count: 0,
                      cardId: e.cardId,
                      method: e.method,
                    };
                  }
                  groups[key].total += toMoneyNumber(e.amount);
                  groups[key].count += 1;
                }

                const entries = Object.entries(groups);
                if (entries.length === 0) return null;

                return (
                  <>
                    {entries.length > 1 && (
                      <div className="finlann-list-separator">
                        <span className="finlann-list-separator__label">À vista</span>
                      </div>
                    )}
                    {entries.map(([key, g]) => (
                      <button
                        key={key}
                        type="button"
                        className="finlann-list-item"
                        onClick={() => {
                          // Abre extrato por método (via categoryStatement como filtro)
                          setCategoryStatement({
                            label: g.label,
                            methodKey: g.method,
                            cardId: g.cardId || null,
                            color: g.color || undefined,
                          });
                        }}
                      >
                        <div className="finlann-list-item__left">
                          <span
                            className="finlann-list-item__avatar finlann-list-item__avatar--expense"
                            style={g.color ? { background: g.color } : undefined}
                          />
                          <div>
                            <p className="finlann-list-item__title">{g.label}</p>
                            <p className="finlann-list-item__subtitle">
                              {g.count === 1 ? "1 lançamento" : `${g.count} lançamentos`}
                            </p>
                          </div>
                        </div>
                        <div className="finlann-list-item__right">
                          <span className="finlann-list-item__value finlann-list-item__value--negative">
                            {format(g.total)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </>
                );
              })()}

              {/* ────────────────────────────────────────────────────────────
                  SEÇÃO B · FATURAS ABERTAS (TOPO)
                  Regra de fechamento (baseada na relação closingDay × dueDay):
                  · closingDay < dueDay → fechamento e vencimento no MESMO mês calendário
                    ex: closing=4, due=11 → fatura de março fecha em 4/abril, vence 11/abril
                  · closingDay > dueDay → fechamento e vencimento em meses DIFERENTES
                    ex: closing=30, due=11 → fatura de março fecha em 30/março, vence 11/abril
                  Verificamos SE a fatura de previousMonth JÁ fechou para decidir
                  qual ciclo está aberto agora.
                  ──────────────────────────────────────────────────────────── */}
              {(() => {

                // Retorna a data real de fechamento da fatura de monthIdx/year.
                // cd = closingDay, dd = dueDay (necessário para determinar se fecha no mesmo mês ou no seguinte)
                // Se closingDay < dueDay → fechamento e vencimento ficam no mesmo mês → fecha em M+1
                // Se closingDay > dueDay → fechamento e vencimento em meses diferentes → fecha em M
                function getInvoiceClosingDate(monthIdx, year, cd, dd) {
                  if (!cd) return null;
                  if (cd < dd) {
                    // Fecha no mês seguinte (M+1)
                    const nm = monthIdx + 1 > 11 ? 0 : monthIdx + 1;
                    const ny = monthIdx + 1 > 11 ? year + 1 : year;
                    return new Date(ny, nm, cd);
                  }
                  // Fecha no próprio mês (M)
                  return new Date(year, monthIdx, cd);
                }

                const openCards = financeState.cards
                  .map((card) => buildInvoiceCycleEntry(card, currentMonthIndex, currentYear))
                  .filter((entry) => entry && entry.status === "open");

                if (openCards.length === 0) return null;

                return (
                  <>
                    <div className="finlann-list-separator">
                      <span className="finlann-list-separator__label">Faturas abertas</span>
                    </div>
                    {openCards.map(({ card, total, monthIdx, year, referenceLabel, closingLabel, dueLabel }) => (
                      <button
                        key={`open-${card.id}-${monthIdx}-${year}`}
                        type="button"
                        className="finlann-list-item finlann-invoice--open"
                        onClick={() => setStatementCard({ card, scope: "open", monthIdx, year })}
                      >
                        <div className="finlann-list-item__left">
                          <span
                            className="finlann-list-item__avatar finlann-list-item__avatar--credit"
                            style={{ background: card.color || undefined }}
                          />
                          <div>
                            <p className="finlann-list-item__title">{card.label}</p>
                            <p className="finlann-list-item__subtitle">
                              {referenceLabel} · Fecha {closingLabel || "--/--"}
                              {dueLabel ? ` · Vence ${dueLabel}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="finlann-list-item__right">
                          <span className="finlann-list-item__value">{format(total)}</span>
                        </div>
                      </button>
                    ))}
                  </>
                );
              })()}

              {/* ────────────────────────────────────────────────────────────
                  SEÇÃO C · FATURAS FECHADAS / ALERTA (BAIXO)
                  Verifica previousMonthIndex E currentMonthIndex (quando este
                  também já fechou).
                  Regra de fechamento/vencimento:
                  · closingDay < dueDay → fechamento e vencimento no MESMO mês (M+1)
                  · closingDay > dueDay → fechamento em M, vencimento em M+1
                  ──────────────────────────────────────────────────────────── */}
              {(() => {
                const alertCards = financeState.cards.flatMap((card) => {
                  const entries = [
                    buildInvoiceCycleEntry(card, previousMonthIndex, previousYear),
                    buildInvoiceCycleEntry(card, currentMonthIndex, currentYear),
                  ];

                  return entries.filter(
                    (entry) => entry && (entry.status === "closed" || entry.status === "overdue")
                  );
                });

                if (alertCards.length === 0) return null;

                return (
                  <>
                    <div className="finlann-list-separator">
                      <span className="finlann-list-separator__label" style={{ color: "#fde047" }}>
                        Aguardando pagamento
                      </span>
                    </div>
                    {alertCards.map(({ card, total, status, closingLabel, dueLabel, referenceLabel, monthIdx, year }) => (
                      <button
                        key={`alert-${card.id}-${monthIdx}-${year}`}
                        type="button"
                        className={`finlann-list-item ${status === "overdue" ? "finlann-invoice--overdue" : "finlann-invoice--closed"}`}
                        onClick={() => setStatementCard({ card, scope: "previous", monthIdx, year })}
                      >
                        <div className="finlann-list-item__left">
                          <span
                            className="finlann-list-item__avatar finlann-list-item__avatar--credit"
                            style={{ background: card.color || undefined }}
                          />
                          <div>
                            <p className="finlann-list-item__title">{card.label}</p>
                            <p className="finlann-list-item__subtitle">
                              {referenceLabel} · {status === "overdue" ? "Venceu" : "Fechou"} {status === "overdue" ? (dueLabel || "--/--") : (closingLabel || "--/--")}
                              {dueLabel ? ` · Vence ${dueLabel}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="finlann-list-item__right">
                          <span className="finlann-list-item__value">{format(total)}</span>
                        </div>
                      </button>
                    ))}
                  </>
                );
              })()}

              {/* Estado vazio */}
              {financeState.expenses.filter((e) => {
                const dt = e.purchaseDate || e.createdAt;
                return isSameMonthYear(dt, currentMonthIndex, currentYear) ||
                  (e.method === "credit" && e.cardId && e.paid !== true);
              }).length === 0 && financeState.cards.length === 0 && (
                <div className="finlann-list-item" style={{ opacity: 0.6 }}>
                  <div className="finlann-list-item__left">
                    <span className="finlann-list-item__avatar finlann-list-item__avatar--expense" />
                    <div>
                      <p className="finlann-list-item__title">Nenhuma saída ainda</p>
                      <p className="finlann-list-item__subtitle">
                        Registre uma saída para ela aparecer aqui.
                      </p>
                    </div>
                  </div>
                </div>
              )}
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

      {statementCard && (
        <CardStatementModal
          card={statementCard.card}
          currentMonthIndex={statementCard.monthIdx ?? currentMonthIndex}
          currentYear={statementCard.year ?? currentYear}
          expenses={financeState.expenses.filter(
            (e) => e.method === "credit" && e.cardId === statementCard.card.id
          )}
          allCards={financeState.cards}
          lastUsedCardId={lastUsedCardId}
          onClose={() => setStatementCard(null)}
          onUpdateCard={onUpdateCard}
          onAddExpense={onAddExpense}
          onRemoveExpenses={onRemoveExpenses}
          onTransferExpenses={onTransferExpenses}
          onUpdateExpenses={onUpdateExpenses}
          onPayInvoice={onPayInvoice}
          paidInvoices={financeState.paidInvoices || []}
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

      {showFixedStatement && (
        <Overlay
          onClose={() => setShowFixedStatement(false)}
          kind="expense"
          accentColor={categoryStatement?.color || undefined}
        >
          <header className="finlann-modal__header" style={{ marginBottom: 16 }}>
            <h2 className="finlann-modal__title">Saídas por categoria</h2>
          </header>
          <div className="finlann-modal__body finlann-modal__body--scroll">
            <div className="finlann-list">
              {Object.keys(expensesByCategoryFromEntries || {}).length === 0 && (
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

              {Object.entries(expensesByCategoryFromEntries || {}).map(
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
                      <div
                        key={categoryId}
                        className="finlann-list-item finlann-list-item--stacked"
                        role="button"
                        onClick={() => setCategoryStatement({ id: categoryId, label, color: categoryColors[categoryId] })}
                      >
                        <div className="finlann-list-item__top-row">
                          <div className="finlann-list-item__left">
                          <button
                            type="button"
                            className="finlann-color-dot"
                            style={{
                              background: categoryColors[categoryId] || "#64748b",
                              borderColor: "#020617",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenColorCategory((prev) =>
                                prev === categoryId ? null : categoryId
                              );
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setOpenColorCategory((prev) =>
                                prev === categoryId ? null : categoryId
                              );
                            }}
                            aria-label={`Escolher cor da categoria ${label}`}
                          />

                          <div>
                            <p className="finlann-list-item__title">{label}</p>
                          </div>
                        </div>
                          <div className="finlann-list-item__right">
                            <span className="finlann-list-item__value finlann-list-item__value--negative">
                              {format(total)}
                            </span>
                          </div>
                        </div>

                        {openColorCategory === categoryId && (
                          <div
                            className="finlann-color-row finlann-color-row--inline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* 5 cores pré-definidas */}
                            {CATEGORY_COLOR_OPTIONS.slice(0, 5).map((color) => (
                              <button
                                key={color}
                                type="button"
                                className={
                                  "finlann-color-dot" +
                                  ((categoryColors[categoryId] || "#64748b") === color
                                    ? " is-active"
                                    : "")
                                }
                                style={{ background: color }}
                                onClick={() => {
                                  setCategoryColors((prev) => {
                                    const next = {
                                      ...prev,
                                      [categoryId]: color,
                                    };
                                    try {
                                      if (typeof window !== "undefined") {
                                        window.localStorage.setItem("finlann.categoryColors", JSON.stringify(next));
                                      }
                                    } catch {}
                                    return next;
                                  });
                                  setOpenColorCategory(null);
                                }}
                              />
                            ))}

                            {/* 6ª bolinha: cor customizada via seletor nativo */}
                            <label
                              className="finlann-color-dot finlann-color-dot--custom"
                              style={{
                                background: categoryColors[categoryId] || "#64748b",
                              }}
                            >
                              <input
                                type="color"
                                value={categoryColors[categoryId] || "#64748b"}
                                onChange={(e) => {
                                  const color = e.target.value;
                                  setCategoryColors((prev) => {
                                    const next = {
                                      ...prev,
                                      [categoryId]: color,
                                    };
                                    try {
                                      if (typeof window !== "undefined") {
                                        window.localStorage.setItem("finlann.categoryColors", JSON.stringify(next));
                                      }
                                    } catch {}
                                    return next;
                                  });
                                  // não fecha o seletor aqui, pra você poder arrastar
                                }}
                              />
                            </label>
                          </div>
                        )}
                      </div>
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
        <Overlay
          onClose={() => {
            setCategoryStatement(null);
            setCategorySelectionMode(false);
            setCategorySelectedIds([]);
          }}
          kind="expense"
          accentColor={categoryStatement.color || undefined}
        >
          <header className="finlann-modal__header">
            <p className="finlann-modal__eyebrow">Saídas por categoria</p>
            <h2 className="finlann-modal__title">{categoryStatement.label}</h2>
          </header>
          <div className="finlann-modal__body finlann-modal__body--scroll">
            <div className="finlann-statement-scroll">
              <div className="finlann-statement-table finlann-statement-table--category">
              <div className="finlann-statement-row finlann-statement-row--header">
                <span>Data</span>
                <span>Desc.</span>
                <span>Orig</span>
                <span>Parc.</span>
                <span>Valor</span>
              </div>

              {(() => {
                const categoryId = categoryStatement.id;
                const items = [];

                // 1) Cartao (usa competencia de fatura)
                for (const card of financeState.cards) {
                  if (isInvoicePaid(financeState, card.id, currentMonthIndex, currentYear)) {
                    continue;
                  }
                  const invoiceItems = getCardInvoiceItemsForMonth(
                    financeState,
                    card.id,
                    currentMonthIndex,
                    currentYear
                  );

                  for (const e of invoiceItems) {
                    if ((e.category || "outros") !== categoryId) continue;
                    items.push(e);
                  }
                }

                // 2) A vista (pix, debito, dinheiro, credito sem cardId)
                for (const e of financeState.expenses) {
                  if (e.method === "credit" && e.cardId) continue; // ja tratado
                  const refDate = e.purchaseDate || e.createdAt;
                  if (!isSameMonthYear(refDate, currentMonthIndex, currentYear)) continue;
                  if ((e.category || "outros") !== categoryId) continue;
                  items.push(e);
                }

                items.sort(
                  (a, b) =>
                    new Date(b.purchaseDate || b.createdAt) -
                    new Date(a.purchaseDate || a.createdAt)
                );

                if (items.length === 0) {
                  return (
                    <div className="finlann-statement-row" style={{ opacity: 0.7 }}>
                      <span>–</span>
                      <span className="finlann-statement-desc">Nenhuma saída nesta categoria</span>
                      <span>–</span>
                      <span>–</span>
                      <span className="finlann-value-cell">
                        <span className="finlann-value-prefix">R$</span>
                        <span className="finlann-value-number">0,00</span>
                      </span>
                    </div>
                  );
                }

                return items.map((e) => {
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

                  const perInstallmentAmount = toMoneyNumber(
                    typeof e.installmentAmount !== "undefined"
                      ? e.installmentAmount
                      : e.amount
                  );

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
                    <div
                      key={e.id}
                      className={
                        "finlann-statement-row" +
                        (categorySelectionMode && categorySelectedIds.includes(e.id)
                          ? " finlann-statement-row--selected"
                          : "")
                      }
                      onClick={() => {
                        if (!categorySelectionMode) return;
                        setCategorySelectedIds((prev) =>
                          prev.includes(e.id)
                            ? prev.filter((id) => id !== e.id)
                            : [...prev, e.id]
                        );
                      }}
                    >
                      <span onClick={(ev) => ev.stopPropagation()}>
                        {categorySelectionMode ? (
                          <input
                            type="checkbox"
                            checked={categorySelectedIds.includes(e.id)}
                            onChange={(ev) => {
                              const checked = ev.target.checked;
                              setCategorySelectedIds((prev) =>
                                checked
                                  ? [...prev, e.id]
                                  : prev.filter((id) => id !== e.id)
                              );
                            }}
                          />
                        ) : (
                          dateLabel
                        )}
                      </span>
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
                });
              })()}
              </div>
            </div>
          </div>
          <footer className="finlann-modal__footer" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className="finlann-modal__close"
                onClick={() => {
                  setCategorySelectionMode((prev) => !prev);
                  if (categorySelectionMode) {
                    setCategorySelectedIds([]);
                  }
                }}
                aria-label={
                  categorySelectionMode ? "Sair do modo seleção" : "Selecionar saídas"
                }
              >
                {categorySelectionMode ? "☑" : "☐"}
              </button>
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              {categorySelectionMode && (
                <>
                  <button
                    type="button"
                    className="finlann-modal__secondary"
                    disabled={categorySelectedIds.length !== 1}
                    onClick={() => {
                      if (categorySelectedIds.length !== 1) return;
                      const target = financeState.expenses.find(
                        (exp) => exp.id === categorySelectedIds[0]
                      );
                      if (!target) return;
                      setCategoryEditingExpense(target);
                    }}
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    className={
                      categorySelectedIds.length === 0
                        ? "finlann-modal__secondary"
                        : "finlann-modal__danger"
                    }
                    disabled={categorySelectedIds.length === 0}
                    onClick={() => {
                      if (!categorySelectedIds.length) return;
                      onRemoveExpenses?.(categorySelectedIds);
                      setCategorySelectedIds([]);
                      setCategorySelectionMode(false);
                    }}
                  >
                    Excluir
                  </button>
                </>
              )}

              <button
                type="button"
                className="finlann-modal__secondary"
                onClick={() => {
                  setCategoryStatement(null);
                  setCategorySelectionMode(false);
                  setCategorySelectedIds([]);
                }}
              >
                Voltar
              </button>
            </div>
          </footer>
        </Overlay>
      )}

      {categoryEditingExpense && (
        <ExpenseModal
          onClose={() => {
            setCategoryEditingExpense(null);
            setCategorySelectionMode(false);
            setCategorySelectedIds([]);
          }}
          onSave={(updatedExpense) => {
            onUpdateExpenses?.((expense) => {
              if (expense.id !== categoryEditingExpense.id) return undefined;
              return {
                ...expense,
                ...updatedExpense,
              };
            });
            setCategoryEditingExpense(null);
            setCategorySelectionMode(false);
            setCategorySelectedIds([]);
          }}
          onAddCard={onAddCard}
          existingCards={financeState.cards}
          lastUsedCardId={lastUsedCardId}
          initialPaymentType={categoryEditingExpense.method}
          lockCardId={
            categoryEditingExpense.method === "credit"
              ? categoryEditingExpense.cardId
              : null
          }
          allowDateEdit
          initialDate={
            (categoryEditingExpense.purchaseDate ||
              categoryEditingExpense.createdAt
            ).slice(0, 10)
          }
          initialExpense={categoryEditingExpense}
        />
      )}
    </div>
  );
}
