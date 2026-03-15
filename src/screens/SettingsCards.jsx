import { useState, useMemo } from "react";
import "../styles/globals.css";
import "../styles/tokens.css";
import "../styles/finlann.css";
import { getMonthlySummary } from "../data/finance.js";

export default function SettingsCards({ financeState, onUpdateCard, onDeleteCard, onBack }) {
  const cards = financeState.cards || [];
  const [index, setIndex] = useState(0);

  const current = cards[index] || null;

  const invoiceInfo = useMemo(() => {
    if (!current) return { total: 0 };
    const now = new Date();
    const monthIndex = now.getMonth();
    const year = now.getFullYear();

    const summary = getMonthlySummary(financeState, monthIndex, year);
    const total = summary.expensesByCard?.[current.id] || 0;
    return { total, monthIndex, year };
  }, [current, financeState]);

  function goPrev() {
    if (!cards.length) return;
    setIndex((prev) => (prev - 1 + cards.length) % cards.length);
  }

  function goNext() {
    if (!cards.length) return;
    setIndex((prev) => (prev + 1) % cards.length);
  }

  return (
    <div className="finlann-dashboard">
      <header className="finlann-header" style={{ justifyContent: "flex-start", columnGap: 8 }}>
        <button
          type="button"
          className="finlann-modal__close"
          onClick={onBack}
          aria-label="Voltar"
          style={{ fontSize: 18 }}
        >
          ‹
        </button>
        <div className="finlann-header__left" style={{ marginLeft: 8 }}>
          <h1 className="finlann-section__title">Cartões</h1>
        </div>
      </header>

      {current && (
        <section className="finlann-section" style={{ marginTop: 8 }}>
          {/* Cardão do cartão atual */}
          <div className="finlann-card finlann-card--full" style={{ background: current.color || undefined }}>
            <div className="finlann-card-full__header">
              <span className="finlann-card-full__label">Cartão de crédito</span>
              {cards.length > 1 && (
                <span className="finlann-card-full__counter">
                  {index + 1} / {cards.length}
                </span>
              )}
            </div>
            <div className="finlann-card-full__body">
              <p className="finlann-card-full__name">{current.label}</p>
              <p className="finlann-card-full__meta">
                Fecha em {current.billingCloseDay || "?"} · Vence em {current.billingDueDay || "?"}
              </p>
            </div>
            {cards.length > 1 && (
              <div className="finlann-card-full__nav">
                <button type="button" onClick={goPrev}>
                  ◀
                </button>
                <button type="button" onClick={goNext}>
                  ▶
                </button>
              </div>
            )}
          </div>

          {/* Resumo simples da fatura atual */}
          <div className="finlann-card-summary">
            <div className="finlann-card-summary__row">
              <div>
                <p className="finlann-card-summary__label">Fatura do mês</p>
                <p className="finlann-card-summary__hint">Total previsto para este cartão</p>
              </div>
              <p className="finlann-card-summary__value">
                {invoiceInfo.total.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </p>
            </div>
          </div>

          {/* Ações do cartão */}
          <div className="finlann-card-actions">
            <button
              type="button"
              className="finlann-modal__secondary"
              onClick={() => {
                alert("Em breve: edição completa do cartão a partir desta tela.");
              }}
            >
              Editar cartão
            </button>
            <button
              type="button"
              className="finlann-modal__secondary"
              onClick={() => {
                if (!window.confirm("Tem certeza que deseja remover este cartão?")) return;
                onDeleteCard?.(current.id);
              }}
            >
              Excluir cartão
            </button>
          </div>
        </section>
      )}

      {!current && (
        <section className="finlann-section">
          <p className="finlann-header__subtitle">
            Nenhum cartão cadastrado ainda. Crie um cartão ao registrar uma saída no crédito.
          </p>
        </section>
      )}
    </div>
  );
}
