import { useMemo, useRef, useState } from "react";
import "../styles/globals.css";
import "../styles/tokens.css";
import "../styles/finlann.css";
import logoFinlann from "../assets/logo-f-mark.png";
import calendarioIcon from "../assets/icons/calendario.png";
import HistoryEntryModal from "../components/HistoryEntryModal.jsx";
import HistoryEditEntryModal from "../components/HistoryEditEntryModal.jsx";
import MonthPopover from "../components/MonthPopover.jsx";

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

function formatCurrency(value) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDateTime(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month} · ${hours}:${minutes}`;
}

function isSameMonthYear(isoString, monthIndex, year) {
  if (!isoString) return false;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return false;
  return d.getMonth() === monthIndex && d.getFullYear() === year;
}

export default function History({ financeState, onUpdateIncomes, onUpdateExpenses }) {
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const monthTriggerRef = useRef(null);

  const today = new Date();
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  const entries = useMemo(() => {
    const merged = [];

    for (const income of financeState.incomes || []) {
      merged.push({
        id: `income-${income.id}`,
        originalId: income.id,
        kind: "income",
        createdAt: income.createdAt,
        description: income.description || "Entrada",
        origin: income.origin || "",
        amount: income.amount,
        extra: income.type || "",
      });
    }

    for (const expense of financeState.expenses || []) {
      const card = (financeState.cards || []).find((c) => c.id === expense.cardId);
      merged.push({
        id: `expense-${expense.id}`,
        originalId: expense.id,
        kind: "expense",
        createdAt: expense.createdAt,
        description: expense.description || "Saída",
        origin: expense.method || "",
        amount: expense.amount,
        extra: card?.label || "",
        cardId: expense.cardId || null,
        category: expense.category || "outros",
      });
    }

    for (const payment of financeState.invoicePayments || []) {
      const card = (financeState.cards || []).find((c) => c.id === payment.cardId);
      const referenceMonth =
        typeof payment.monthIndex === "number"
          ? MONTH_LABELS[payment.monthIndex]
          : null;

      merged.push({
        id: `invoice-payment-${payment.id}`,
        originalId: payment.id,
        kind: "expense",
        subtype: "invoice_payment",
        createdAt: payment.paidAt || payment.createdAt,
        description:
          payment.description ||
          `Pagamento fatura ${card?.label || "Cartão"}`,
        origin: "invoice_payment",
        amount: payment.amount,
        extra: card?.label || "",
        cardId: payment.cardId || null,
        note:
          referenceMonth && payment.year
            ? `Referente a ${referenceMonth} de ${payment.year}`
            : undefined,
        readOnly: true,
      });
    }

    merged.sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return db - da;
    });

    return merged;
  }, [financeState]);

  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) =>
        isSameMonthYear(entry.createdAt, selectedMonthIndex, selectedYear)
      ),
    [entries, selectedMonthIndex, selectedYear]
  );

  const selectedMonthLabel = `${MONTH_LABELS[selectedMonthIndex]} · ${selectedYear}`;

  return (
    <div className="finlann-dashboard">
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
                ref={monthTriggerRef}
                type="button"
                className="finlann-header__subtitle finlann-header__subtitle--clickable"
                onClick={() => setShowMonthPicker(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <span>{selectedMonthLabel}</span>
                <img
                  src={calendarioIcon}
                  alt="Selecionar mês e ano"
                  className="finlann-month-trigger__icon"
                />
              </button>
            </div>
          </header>
        </div>
      </div>

      <section className="finlann-section finlann-section--history">
        <div className="finlann-section__scroll">
          <div className="finlann-list">
            <header className="finlann-section__header">
              <h2 className="finlann-section__title">Lançamentos do mês</h2>
              <span className="finlann-section__tag">{selectedMonthLabel}</span>
            </header>

            {filteredEntries.length === 0 && (
              <div className="finlann-list-item" style={{ opacity: 0.7 }}>
                <div className="finlann-list-item__left">
                  <span className="finlann-list-item__avatar" />
                  <div>
                    <p className="finlann-list-item__title">
                      Nenhum lançamento neste mês
                    </p>
                    <p className="finlann-list-item__subtitle">
                      Escolha outro mês ou registre entradas e saídas para ver o histórico aqui
                    </p>
                  </div>
                </div>
              </div>
            )}

            {filteredEntries.map((entry) => {
                const isIncome = entry.kind === "income";
                const valueClass = isIncome
                  ? "finlann-list-item__value finlann-list-item__value--positive"
                  : "finlann-list-item__value finlann-list-item__value--negative";

                const avatarClass = isIncome
                  ? "finlann-list-item__avatar finlann-list-item__avatar--income"
                  : "finlann-list-item__avatar finlann-list-item__avatar--expense";

                const subtitleParts = [];

                if (isIncome) {
                  let tipoLabel = "Entrada";
                  if (entry.extra === "pix") tipoLabel = "Pix";
                  else if (entry.extra === "salary") tipoLabel = "Salário";
                  else if (entry.extra === "freela") tipoLabel = "Freela";
                  subtitleParts.push(tipoLabel);
                } else {
                  let metodoLabel = entry.origin;
                  if (entry.origin === "credit") metodoLabel = "Crédito";
                  else if (entry.origin === "debit") metodoLabel = "Débito";
                  else if (entry.origin === "pix") metodoLabel = "Pix";
                  else if (entry.origin === "cash") metodoLabel = "Dinheiro";
                  else if (entry.origin === "invoice_payment") metodoLabel = "Pagamento de fatura";
                  if (metodoLabel) subtitleParts.push(metodoLabel);
                }

                subtitleParts.push(formatDateTime(entry.createdAt));

                return (
                  <div
                    key={entry.id}
                    className="finlann-list-item"
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedEntry(entry)}
                  >
                    <div className="finlann-list-item__left">
                      <span className={avatarClass} />
                      <div>
                        <p className="finlann-list-item__title">
                          {entry.description}
                        </p>
                        <p className="finlann-list-item__subtitle">
                          {subtitleParts.join(" • ")}
                        </p>
                      </div>
                    </div>

                    <div className="finlann-list-item__right">
                      <span className={valueClass}>
                        {formatCurrency(entry.amount)}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </section>

      {selectedEntry && (
        <HistoryEntryModal
          entry={selectedEntry}
          cards={financeState.cards}
          onClose={() => setSelectedEntry(null)}
          onEdit={(entry) => {
            if (entry.readOnly) return;
            setEditingEntry(entry);
          }}
        />
      )}

      {editingEntry && !editingEntry.readOnly && (
        <HistoryEditEntryModal
          entry={editingEntry}
          existingCards={financeState.cards}
          onClose={() => setEditingEntry(null)}
          onSave={(updated) => {
            if (updated.kind === "income") {
              onUpdateIncomes?.((income) =>
                income.id === updated.originalId
                  ? {
                      ...income,
                      description: updated.description,
                      origin: updated.origin,
                      type: updated.extra || income.type,
                      amount: updated.amount,
                      note: updated.note,
                      updatedAt: new Date().toISOString(),
                    }
                  : undefined
              );
            } else if (updated.kind === "expense") {
              onUpdateExpenses?.((expense) =>
                expense.id === updated.originalId
                  ? {
                      ...expense,
                      description: updated.description,
                      method: updated.method || expense.method,
                      cardId:
                        (updated.method || expense.method) === "credit" ||
                        (updated.method || expense.method) === "debit"
                          ? updated.cardId ?? expense.cardId ?? null
                          : null,
                      amount: updated.amount,
                      category: updated.category || expense.category || "outros",
                      note: updated.note,
                      updatedAt: new Date().toISOString(),
                    }
                  : undefined
              );
            }
            setEditingEntry(null);
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
            currentMonthIndex={selectedMonthIndex}
            currentYear={selectedYear}
            onChange={({ monthIndex, year }) => {
              const currentStamp = today.getFullYear() * 12 + today.getMonth();
              const nextStamp = year * 12 + monthIndex;
              if (nextStamp > currentStamp) return;
              setSelectedMonthIndex(monthIndex);
              setSelectedYear(year);
              setShowMonthPicker(false);
            }}
            onClose={() => setShowMonthPicker(false)}
          />
        </div>
      )}
    </div>
  );
}
