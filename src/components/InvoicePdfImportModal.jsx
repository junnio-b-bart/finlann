import { useEffect, useMemo, useState } from "react";
import { parseInvoicePdfFile } from "../utils/invoicePdfParser.js";

const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Marco",
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

function formatMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(isoDate) {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "--/--";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

export default function InvoicePdfImportModal({
  cards,
  onClose,
  onImportExpenses,
  onSettingsToast,
  asPage = false,
}) {
  const creditCards = useMemo(
    () => (cards || []).filter((card) => !card?.kind || card.kind === "credit"),
    [cards]
  );

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const [selectedCardId, setSelectedCardId] = useState(creditCards[0]?.id || "");
  const [invoiceMonthIndex, setInvoiceMonthIndex] = useState(currentMonth);
  const [invoiceYear, setInvoiceYear] = useState(currentYear);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [parsedItems, setParsedItems] = useState([]);
  const [selectedItemKeys, setSelectedItemKeys] = useState([]);
  const [parseMeta, setParseMeta] = useState({ pages: 0, lines: 0 });
  const [activeTab, setActiveTab] = useState("upload");

  useEffect(() => {
    if (selectedCardId) return;
    if (creditCards.length > 0) {
      setSelectedCardId(creditCards[0].id);
    }
  }, [creditCards, selectedCardId]);

  const allSelected =
    parsedItems.length > 0 && selectedItemKeys.length === parsedItems.length;

  const selectedCount = selectedItemKeys.length;
  const isSelectionTab = asPage && activeTab === "select";
  const showUploadSection = !asPage || activeTab === "upload";
  const showSelectionSection = parsedItems.length > 0 && (!asPage || activeTab === "select");

  const yearOptions = useMemo(() => {
    const values = [];
    for (let year = currentYear - 3; year <= currentYear + 1; year += 1) {
      values.push(year);
    }
    if (!values.includes(invoiceYear)) values.push(invoiceYear);
    return values.sort((a, b) => a - b);
  }, [currentYear, invoiceYear]);

  async function handleParsePdf() {
    if (!selectedFile) {
      setParseError("Selecione um PDF da fatura para continuar.");
      return;
    }

    setIsParsing(true);
    setParseError("");

    try {
      const parsed = await parseInvoicePdfFile(selectedFile, invoiceMonthIndex, invoiceYear);
      setParsedItems(parsed.items || []);
      setSelectedItemKeys((parsed.items || []).map((item) => item.key));
      setParseMeta({
        pages: parsed.pages || 0,
        lines: parsed.lines || 0,
      });

      if (!parsed.items || parsed.items.length === 0) {
        setParseError(
          "Nao encontramos lancamentos automaticamente neste PDF. Tente outro arquivo ou outra fatura."
        );
      } else if (asPage) {
        setActiveTab("select");
      }
    } catch (error) {
      console.error("[Finlann] Falha ao ler PDF da fatura:", error);
      setParsedItems([]);
      setSelectedItemKeys([]);
      setParseMeta({ pages: 0, lines: 0 });
      setParseError("Nao foi possivel ler esse PDF. Verifique o arquivo e tente novamente.");
      setActiveTab("upload");
    } finally {
      setIsParsing(false);
    }
  }

  function toggleSelectItem(itemKey) {
    setSelectedItemKeys((previous) =>
      previous.includes(itemKey)
        ? previous.filter((key) => key !== itemKey)
        : [...previous, itemKey]
    );
  }

  function handleToggleSelectAll() {
    if (allSelected) {
      setSelectedItemKeys([]);
      return;
    }
    setSelectedItemKeys(parsedItems.map((item) => item.key));
  }

  function buildExpenseFromPdfItem(item, index) {
    const installmentNumber = Math.max(1, Number(item.installmentNumber || 1));
    const totalInstallments = Math.max(1, Number(item.totalInstallments || 1));
    const firstInvoiceDate = new Date(invoiceYear, invoiceMonthIndex - (installmentNumber - 1), 1);
    const totalAmount =
      totalInstallments > 1
        ? Number(item.installmentAmount || 0) * totalInstallments
        : Number(item.installmentAmount || 0);

    const nowIso = new Date().toISOString();
    return {
      id: `pdf-import-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
      description: item.description || "(sem descricao)",
      amount: Number(totalAmount.toFixed(2)),
      method: "credit",
      cardId: selectedCardId || null,
      isFixed: false,
      totalInstallments,
      purchaseDate: item.purchaseDateIso || nowIso,
      firstInvoiceMonthIndex: firstInvoiceDate.getMonth(),
      firstInvoiceYear: firstInvoiceDate.getFullYear(),
      category: "outros",
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }

  function handleImportSelected() {
    if (!selectedCardId) {
      setParseError("Escolha o cartao para importar os itens.");
      return;
    }

    const selected = parsedItems.filter((item) => selectedItemKeys.includes(item.key));
    if (selected.length === 0) {
      setParseError("Selecione pelo menos um item para importar.");
      return;
    }

    const payload = selected.map((item, index) => buildExpenseFromPdfItem(item, index));
    const result = onImportExpenses?.(payload) || { added: payload.length, skipped: 0 };

    if (result.added > 0) {
      onSettingsToast?.(
        `${result.added} item(ns) importado(s) da fatura com sucesso.`,
        "success"
      );
    } else {
      onSettingsToast?.("Nenhum item novo foi importado (possiveis duplicados).", "error");
    }

    if (result.skipped > 0) {
      onSettingsToast?.(
        `${result.skipped} item(ns) ja existiam e foram ignorados.`,
        "error"
      );
    }

    onClose?.();
  }

  const panel = (
    <div
      className={
        "finlann-overlay__panel finlann-overlay__panel--invoice-import" +
        (asPage ? " finlann-overlay__panel--invoice-import-page" : "")
      }
    >
      {asPage && (
        <button
          type="button"
          className="finlann-invoice-pdf-page-back"
          onClick={onClose}
        >
          {"<- Voltar"}
        </button>
      )}

      <header className="finlann-modal__header">
        <p className="finlann-modal__eyebrow">
          {isSelectionTab ? "Itens extraidos do PDF" : "Importacao da fatura"}
        </p>
        <h2 className="finlann-modal__title">
          {isSelectionTab ? "Escolha os itens para importar" : "Selecionar itens do PDF"}
        </h2>
      </header>

      <div className="finlann-modal__body finlann-modal__body--scroll">
        {creditCards.length === 0 && (
          <p className="finlann-settings-profile-subtitle">
            Cadastre um cartao de credito antes de importar a fatura.
          </p>
        )}

        {showUploadSection && (
          <>
            <div className="finlann-invoice-import__filters">
              <div className="finlann-field">
                <label className="finlann-field__label">Cartao</label>
                <div className="finlann-select finlann-select--compact">
                  <select
                    value={selectedCardId}
                    onChange={(event) => setSelectedCardId(event.target.value)}
                    disabled={creditCards.length === 0}
                  >
                    {creditCards.length === 0 && <option value="">Sem cartao</option>}
                    {creditCards.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="finlann-field">
                <label className="finlann-field__label">Mes de referencia</label>
                <div className="finlann-invoice-import__month-row">
                  <div className="finlann-select finlann-select--compact">
                    <select
                      value={invoiceMonthIndex}
                      onChange={(event) => setInvoiceMonthIndex(Number(event.target.value))}
                    >
                      {MONTH_LABELS.map((label, index) => (
                        <option key={`${label}-${index}`} value={index}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="finlann-select finlann-select--compact">
                    <select
                      value={invoiceYear}
                      onChange={(event) => setInvoiceYear(Number(event.target.value))}
                    >
                      {yearOptions.map((year) => (
                        <option key={`year-${year}`} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="finlann-field">
                <label className="finlann-field__label">PDF da fatura</label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setSelectedFile(file);
                    setParseError("");
                    setParsedItems([]);
                    setSelectedItemKeys([]);
                    setParseMeta({ pages: 0, lines: 0 });
                    setActiveTab("upload");
                  }}
                />
              </div>
            </div>

            <div className="finlann-settings-actions-row">
              <button
                type="button"
                className="finlann-chip finlann-chip--solid finlann-chip--accent"
                disabled={!selectedFile || isParsing || creditCards.length === 0}
                onClick={handleParsePdf}
              >
                {isParsing ? "Lendo PDF..." : "Ler PDF e abrir selecao"}
              </button>
            </div>
          </>
        )}

        {showSelectionSection && (
          <>
            <div className="finlann-invoice-import__summary">
              <span>{parsedItems.length} item(ns) encontrados</span>
              <span>{parseMeta.pages} pagina(s) lidas</span>
              <span>{parseMeta.lines} linha(s) analisadas</span>
            </div>

            <label className="finlann-invoice-import__check-all">
              <input type="checkbox" checked={allSelected} onChange={handleToggleSelectAll} />
              <span>Selecionar todos</span>
            </label>

            <div className="finlann-invoice-import__list" role="list">
              {parsedItems.map((item) => {
                const installmentLabel =
                  item.totalInstallments > 1
                    ? `${item.installmentNumber}/${item.totalInstallments}`
                    : "-";

                return (
                  <label
                    key={item.key}
                    className={
                      "finlann-invoice-import__item" +
                      (selectedItemKeys.includes(item.key) ? " is-selected" : "")
                    }
                    role="listitem"
                  >
                    <input
                      type="checkbox"
                      checked={selectedItemKeys.includes(item.key)}
                      onChange={() => toggleSelectItem(item.key)}
                    />
                    <div className="finlann-invoice-import__item-main">
                      <div className="finlann-invoice-import__item-title">
                        <span>{item.description || "(sem descricao)"}</span>
                        <strong>{formatMoney(item.installmentAmount)}</strong>
                      </div>
                      <div className="finlann-invoice-import__item-subtitle">
                        <span>Data: {formatDate(item.purchaseDateIso)}</span>
                        <span>Parcela: {installmentLabel}</span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </>
        )}

        {parseError && (
          <p className="finlann-settings-profile-subtitle" style={{ color: "#fecaca" }}>
            {parseError}
          </p>
        )}
      </div>

      <footer className="finlann-modal__footer finlann-modal__footer--split">
        {isSelectionTab ? (
          <button
            type="button"
            className="finlann-modal__secondary"
            onClick={() => setActiveTab("upload")}
          >
            Voltar para PDF
          </button>
        ) : (
          <button type="button" className="finlann-modal__secondary" onClick={onClose}>
            Cancelar
          </button>
        )}

        {showSelectionSection && (
          <button
            type="button"
            className="finlann-modal__primary"
            disabled={selectedCount === 0 || !selectedCardId}
            onClick={handleImportSelected}
          >
            Importar selecionados ({selectedCount})
          </button>
        )}
      </footer>
    </div>
  );

  if (asPage) {
    return <div className="finlann-invoice-pdf-page">{panel}</div>;
  }

  return (
    <div className="finlann-overlay">
      {panel}
    </div>
  );
}
