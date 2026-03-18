import { useState } from "react";
import "../styles/globals.css";
import "../styles/tokens.css";
import "../styles/finlann.css";
import logoFinlann from "../assets/FinlannLogo.png";
import HistoryEntryModal from "../components/HistoryEntryModal.jsx";
import HistoryEditEntryModal from "../components/HistoryEditEntryModal.jsx";

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

export default function History({ financeState, onUpdateIncomes, onUpdateExpenses }) {
  // Constrói uma lista unificada de lançamentos (entradas + saídas),
  // ordenada do mais recente para o mais antigo.

  const [selectedEntry, setSelectedEntry] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);

  const entries = [];

  for (const income of financeState.incomes || []) {
    entries.push({
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
    entries.push({
      id: `expense-${expense.id}`,
      originalId: expense.id,
      kind: "expense",
      createdAt: expense.createdAt,
      description: expense.description || "Saída",
      origin: expense.method || "",
      amount: expense.amount,
      extra: card?.label || "",
      cardId: expense.cardId || null,
    });
  }

  entries.sort((a, b) => {
    const da = new Date(a.createdAt).getTime();
    const db = new Date(b.createdAt).getTime();
    return db - da; // mais recente primeiro
  });

  return (
    <div className="finlann-dashboard">
      <header className="finlann-header finlann-header--centered">
        <div className="finlann-header__left">
          <div className="finlann-logo-pill">
            <img
              src={logoFinlann}
              alt="Finlann"
              className="finlann-logo-img"
            />
          </div>
          <h1 className="finlann-section__title">Últimos lançamentos</h1>
        </div>
      </header>

      <section className="finlann-section finlann-section--history">

        <div className="finlann-section__scroll">
          <div className="finlann-list">
          {entries.length === 0 && (
            <div className="finlann-list-item" style={{ opacity: 0.7 }}>
              <div className="finlann-list-item__left">
                <span className="finlann-list-item__avatar" />
                <div>
                  <p className="finlann-list-item__title">
                    Nenhum lançamento ainda
                  </p>
                  <p className="finlann-list-item__subtitle">
                    Registre entradas ou saídas para ver o histórico aqui
                  </p>
                </div>
              </div>
            </div>
          )}

          {entries.map((entry) => {
            const isIncome = entry.kind === "income";
            const valueClass = isIncome
              ? "finlann-list-item__value finlann-list-item__value--positive"
              : "finlann-list-item__value finlann-list-item__value--negative";

            const avatarClass = isIncome
              ? "finlann-list-item__avatar finlann-list-item__avatar--income"
              : "finlann-list-item__avatar finlann-list-item__avatar--expense";

            const subtitleParts = [];

            if (isIncome) {
              // Entradas: forma de recebimento + data/hora
              // extra: tipo interno (pix, salário, freela...)
              let tipoLabel = "Entrada";
              if (entry.extra === "pix") tipoLabel = "Pix";
              else if (entry.extra === "salary") tipoLabel = "Salário";
              else if (entry.extra === "freela") tipoLabel = "Freela";

              subtitleParts.push(tipoLabel);
            } else {
              // Saídas: forma de pagamento + data/hora
              let metodoLabel = entry.origin;
              if (entry.origin === "credit") metodoLabel = "Crédito";
              else if (entry.origin === "debit") metodoLabel = "Débito";
              else if (entry.origin === "pix") metodoLabel = "Pix";
              else if (entry.origin === "cash") metodoLabel = "Dinheiro";

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

        {selectedEntry && (
          <HistoryEntryModal
            entry={selectedEntry}
            cards={financeState.cards}
            onClose={() => setSelectedEntry(null)}
            onEdit={(entry) => setEditingEntry(entry)}
          />
        )}

        {editingEntry && (
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
                        type: updated.extra,
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
                          (updated.method || expense.method) === "credit"
                            ? updated.cardId ?? expense.cardId ?? null
                            : null,
                        amount: updated.amount,
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
      </section>
    </div>
  );
}
