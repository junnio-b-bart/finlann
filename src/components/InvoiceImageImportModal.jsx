import { useEffect, useMemo, useRef, useState } from "react";
import { parseInvoiceImageFiles } from "../utils/invoiceImageParser.js";
import logoMark from "../assets/logo-f-mark.png";

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

function formatInstallment(item) {
  const current = Number(item?.installmentNumber || 1);
  const total = Number(item?.totalInstallments || 1);
  if (!(total > 1)) return "-";
  return `${current}/${total}`;
}

function buildFileKey(file) {
  return `${file?.name || "foto"}-${file?.size || 0}-${file?.lastModified || 0}`;
}

function shortenFileName(fileName, maxLength = 20) {
  const name = String(fileName || "foto");
  if (name.length <= maxLength) return name;
  const extensionIndex = name.lastIndexOf(".");
  if (extensionIndex <= 0) return `${name.slice(0, maxLength - 1)}...`;
  const extension = name.slice(extensionIndex);
  const head = name.slice(0, Math.max(1, maxLength - extension.length - 3));
  return `${head}...${extension}`;
}

export default function InvoiceImageImportModal({
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
  const fileInputRef = useRef(null);

  const [selectedCardId, setSelectedCardId] = useState(creditCards[0]?.id || "");
  const [invoiceMonthIndex, setInvoiceMonthIndex] = useState(currentMonth);
  const [invoiceYear, setInvoiceYear] = useState(currentYear);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseError, setParseError] = useState("");
  const [parsedItems, setParsedItems] = useState([]);
  const [selectedItemKeys, setSelectedItemKeys] = useState([]);
  const [parseMeta, setParseMeta] = useState({ pages: 0, lines: 0 });

  useEffect(() => {
    if (selectedCardId) return;
    if (creditCards.length > 0) {
      setSelectedCardId(creditCards[0].id);
    }
  }, [creditCards, selectedCardId]);

  const allSelected =
    parsedItems.length > 0 && selectedItemKeys.length === parsedItems.length;
  const selectedCount = selectedItemKeys.length;

  const yearOptions = useMemo(() => {
    const values = [];
    for (let year = currentYear - 3; year <= currentYear + 1; year += 1) {
      values.push(year);
    }
    if (!values.includes(invoiceYear)) values.push(invoiceYear);
    return values.sort((a, b) => a - b);
  }, [currentYear, invoiceYear]);

  const selectedFilePreviews = useMemo(
    () =>
      selectedFiles.map((file) => ({
        key: buildFileKey(file),
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    [selectedFiles]
  );

  useEffect(
    () => () => {
      selectedFilePreviews.forEach((preview) => {
        URL.revokeObjectURL(preview.previewUrl);
      });
    },
    [selectedFilePreviews]
  );

  function applySelectedFiles(files) {
    const imageFiles = Array.from(files || []).filter((file) =>
      String(file?.type || "").startsWith("image/")
    );
    setSelectedFiles(imageFiles);
    setParsedItems([]);
    setSelectedItemKeys([]);
    setParseMeta({ pages: 0, lines: 0 });
    setParseError("");
  }

  function openFilePicker() {
    if (isParsing || creditCards.length === 0) return;
    fileInputRef.current?.click();
  }

  async function handleParseImages() {
    if (selectedFiles.length === 0) {
      setParseError("Selecione uma ou mais fotos da fatura para continuar.");
      return;
    }

    setIsParsing(true);
    setParseProgress(0);
    setParseError("");

    try {
      const parsed = await parseInvoiceImageFiles(
        selectedFiles,
        invoiceMonthIndex,
        invoiceYear,
        (progress) => setParseProgress(progress)
      );

      setParsedItems(parsed.items || []);
      setSelectedItemKeys((parsed.items || []).map((item) => item.key));
      setParseMeta({
        pages: parsed.pages || 0,
        lines: parsed.lines || 0,
      });

      if (!parsed.items || parsed.items.length === 0) {
        setParseError(
          "Nao encontramos lancamentos automaticamente nessas fotos. Tente fotos mais nitidas e com boa iluminacao."
        );
      }
    } catch (error) {
      console.error("[Finlann] Falha ao ler fotos da fatura:", error);
      setParsedItems([]);
      setSelectedItemKeys([]);
      setParseMeta({ pages: 0, lines: 0 });
      setParseError("Nao foi possivel analisar essas fotos. Verifique e tente novamente.");
    } finally {
      setIsParsing(false);
      setParseProgress(0);
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

  function buildExpenseFromImageItem(item, index) {
    const installmentNumber = Math.max(1, Number(item.installmentNumber || 1));
    const totalInstallments = Math.max(1, Number(item.totalInstallments || 1));
    const firstInvoiceDate = new Date(
      invoiceYear,
      invoiceMonthIndex - (installmentNumber - 1),
      1
    );
    const totalAmount =
      totalInstallments > 1
        ? Number(item.installmentAmount || 0) * totalInstallments
        : Number(item.installmentAmount || 0);

    const nowIso = new Date().toISOString();
    return {
      id: `img-import-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
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

    const payload = selected.map((item, index) => buildExpenseFromImageItem(item, index));
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
        "finlann-overlay__panel finlann-overlay__panel--invoice-import finlann-invoice-photo-modal" +
        (asPage ? " finlann-invoice-photo-modal--page" : "")
      }
    >
      {asPage && (
        <button
          type="button"
          className="finlann-invoice-photo-page-back"
          onClick={onClose}
        >
          ← Voltar
        </button>
      )}

      <header className="finlann-invoice-photo-header">
        <div className="finlann-invoice-photo-brand" aria-label="Finlann">
          <img src={logoMark} alt="" className="finlann-invoice-photo-brand__logo" />
          <span className="finlann-invoice-photo-brand__name">Finlann</span>
        </div>
        <h2 className="finlann-invoice-photo-header__title">Importar fatura</h2>
        <p className="finlann-invoice-photo-header__subtitle">Importar itens por foto</p>
      </header>

      <div className="finlann-modal__body finlann-modal__body--scroll finlann-invoice-photo-body">
        {creditCards.length === 0 && (
          <p className="finlann-settings-profile-subtitle">
            Cadastre um cartao de credito antes de importar a fatura.
          </p>
        )}

        <div className="finlann-invoice-photo-controls">
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
            <div className="finlann-invoice-photo-controls__month-row">
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
        </div>

        <section
          className={`finlann-invoice-photo-dropzone${isDragActive ? " is-drag" : ""}`}
          role="button"
          tabIndex={0}
          onClick={openFilePicker}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openFilePicker();
            }
          }}
          onDragEnter={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (isParsing) return;
            setIsDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (isParsing) return;
            setIsDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const related = event.relatedTarget;
            if (related && event.currentTarget.contains(related)) return;
            setIsDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsDragActive(false);
            if (isParsing || creditCards.length === 0) return;
            applySelectedFiles(event.dataTransfer?.files || []);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="finlann-invoice-photo-dropzone__input"
            onChange={(event) => applySelectedFiles(event.target.files || [])}
          />

          <div className="finlann-invoice-photo-dropzone__preview-list">
            {selectedFilePreviews.length === 0 && (
              <div className="finlann-invoice-photo-dropzone__empty-preview">
                <span>Adicione as screenshots da fatura aqui</span>
              </div>
            )}

            {selectedFilePreviews.slice(0, 3).map((preview) => (
              <article key={preview.key} className="finlann-invoice-photo-preview">
                <img src={preview.previewUrl} alt={preview.file.name} loading="lazy" />
                <span className="finlann-invoice-photo-preview__ok" aria-hidden>
                  ✓
                </span>
                <span className="finlann-invoice-photo-preview__name">
                  {shortenFileName(preview.file.name)}
                </span>
              </article>
            ))}

            {selectedFilePreviews.length > 3 && (
              <div className="finlann-invoice-photo-preview finlann-invoice-photo-preview--more">
                +{selectedFilePreviews.length - 3}
              </div>
            )}
          </div>

          <div className="finlann-invoice-photo-dropzone__hint">
            <span className="finlann-invoice-photo-dropzone__icon" aria-hidden>
              ⤴
            </span>
            <p>Arraste ou selecione uma foto da fatura</p>
          </div>
        </section>

        <button
          type="button"
          className="finlann-invoice-photo-analyze-btn"
          disabled={selectedFiles.length === 0 || isParsing || creditCards.length === 0}
          onClick={handleParseImages}
        >
          <span>
            {isParsing ? `Analisando... ${Math.round(parseProgress * 100)}%` : "Analisar fatura"}
          </span>
          <span aria-hidden>→</span>
        </button>

        {isParsing && (
          <div className="finlann-invoice-photo-progress">
            <span style={{ width: `${Math.round(parseProgress * 100)}%` }} />
          </div>
        )}

        {parseError && <p className="finlann-invoice-photo-error">{parseError}</p>}

        {parsedItems.length > 0 && (
          <section className="finlann-invoice-photo-results">
            <div className="finlann-invoice-photo-results__header">
              <label className="finlann-invoice-photo-results__toggle">
                <input type="checkbox" checked={allSelected} onChange={handleToggleSelectAll} />
                <span>{parsedItems.length} itens encontrados</span>
              </label>
              <span className="finlann-invoice-photo-results__meta">
                {parseMeta.pages} foto(s) · {parseMeta.lines} linha(s)
              </span>
            </div>

            <div className="finlann-invoice-photo-results__table-wrap">
              <table className="finlann-invoice-photo-table">
                <thead>
                  <tr>
                    <th className="finlann-invoice-photo-table__select">Sel.</th>
                    <th>Data</th>
                    <th>Descricao</th>
                    <th>Parc.</th>
                    <th className="finlann-invoice-photo-table__value">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedItems.map((item) => {
                    const selected = selectedItemKeys.includes(item.key);
                    return (
                      <tr
                        key={item.key}
                        className={selected ? "is-selected" : ""}
                        onClick={() => toggleSelectItem(item.key)}
                      >
                        <td className="finlann-invoice-photo-table__select">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleSelectItem(item.key)}
                            onClick={(event) => event.stopPropagation()}
                          />
                        </td>
                        <td>{formatDate(item.purchaseDateIso)}</td>
                        <td
                          title={`${item.description || "(sem descricao)"} | Foto ${item.pageNumber} / Linha ${item.lineNumber}`}
                          className="finlann-invoice-photo-table__description"
                        >
                          {item.description || "(sem descricao)"}
                        </td>
                        <td>{formatInstallment(item)}</td>
                        <td className="finlann-invoice-photo-table__value">
                          {formatMoney(item.installmentAmount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      <footer className="finlann-modal__footer finlann-modal__footer--split finlann-invoice-photo-footer">
        <button type="button" className="finlann-modal__secondary" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="finlann-invoice-photo-footer__import"
          disabled={selectedCount === 0 || !selectedCardId}
          onClick={handleImportSelected}
        >
          <span>Importar selecionados ({selectedCount})</span>
          <span aria-hidden>→</span>
        </button>
      </footer>
    </div>
  );

  if (asPage) {
    return <div className="finlann-invoice-photo-page">{panel}</div>;
  }

  return (
    <div className="finlann-overlay">
      {panel}
    </div>
  );
}
