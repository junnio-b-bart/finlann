import { useEffect, useRef, useState } from "react";
import Overlay from "./Overlay.jsx";

const MONTHS = [
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

const YEARS = [
  2015, 2016, 2017, 2018, 2019,
  2020, 2021, 2022, 2023, 2024,
  2025, 2026, 2027, 2028, 2029,
  2030, 2031, 2032, 2033, 2034,
  2035,
];

const ITEM_HEIGHT = 32; // precisa bater com o CSS
const PADDING_TOP_ROWS = 2; // linhas vazias antes do primeiro item real
const PADDING_BOTTOM_ROWS = 1; // linha vazia depois do último item

export default function MonthPickerModal({ onClose, initialMonthIndex, initialYear, onConfirm }) {
  const fallbackToday = new Date();
  const safeInitialMonth =
    typeof initialMonthIndex === "number" ? initialMonthIndex : fallbackToday.getMonth();
  const safeInitialYear = initialYear || fallbackToday.getFullYear();

  const [monthIndex, setMonthIndex] = useState(safeInitialMonth);
  const [yearIndex, setYearIndex] = useState(
    YEARS.findIndex((y) => y === safeInitialYear) || 0
  );

  const monthWheelRef = useRef(null);
  const yearWheelRef = useRef(null);
  const monthScrollTimeoutRef = useRef(null);
  const yearScrollTimeoutRef = useRef(null);

  function getItemClass(baseIndex, selectedIndex) {
    const distance = Math.abs(baseIndex - selectedIndex);
    if (distance === 0) return "finlann-monthpicker__item is-selected";
    if (distance === 1) return "finlann-monthpicker__item is-near";
    return "finlann-monthpicker__item is-far";
  }

  // centraliza um índice específico no meio da wheel
  function centerOnIndex(ref, index, behavior = "smooth") {
    if (!ref.current) return;
    const container = ref.current;
    const targetRow = index + PADDING_TOP_ROWS;
    const targetScrollTop =
      targetRow * ITEM_HEIGHT - container.clientHeight / 2 + ITEM_HEIGHT / 2;
    container.scrollTo({ top: Math.max(targetScrollTop, 0), behavior });
  }

  // Scroll da rodinha do mouse: anda poucos itens por vez para não "disparar" demais
  function handleWheelStep(setIndex, length, deltaY) {
    if (!deltaY) return;
    const baseStep = deltaY > 0 ? 1 : -1;
    // reduzimos bastante a sensibilidade: 1 item na maioria dos scrolls, 2 se for MUITO forte
    const magnitude = Math.max(1, Math.round(Math.abs(deltaY) / 160));
    const step = baseStep * magnitude;

    setIndex((current) => {
      const next = Math.min(Math.max(current + step, 0), length - 1);
      return next;
    });
  }

  // Quando o usuário faz scroll (touch/mouse), após um pequeno delay usamos o item
  // que ficou mais próximo do centro da coluna como selecionado.
  function syncIndexToCenter(ref, setIndex, length, timeoutRef) {
    if (!ref.current) return;
    const container = ref.current;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const centerY = container.scrollTop + container.clientHeight / 2;
      // converte posição do centro em índice lógico aproximado
      const approxRow = Math.round(centerY / ITEM_HEIGHT - 0.5);
      const logicalIndex = approxRow - PADDING_TOP_ROWS;
      const clampedIndex = Math.min(Math.max(logicalIndex, 0), length - 1);
      setIndex(clampedIndex);
      centerOnIndex(ref, clampedIndex, "smooth");
    }, 80);
  }

  // Toda vez que o índice de mês/ano muda, centraliza o item selecionado
  useEffect(() => {
    centerOnIndex(monthWheelRef, monthIndex, "smooth");
  }, [monthIndex]);

  useEffect(() => {
    centerOnIndex(yearWheelRef, yearIndex, "smooth");
  }, [yearIndex]);

  // Ao abrir o modal, já centraliza o mês/ano atuais sem animação
  useEffect(() => {
    centerOnIndex(monthWheelRef, monthIndex, "auto");
    centerOnIndex(yearWheelRef, yearIndex, "auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Overlay onClose={onClose}>
      <header className="finlann-modal__header">
        <div>
          <p className="finlann-modal__eyebrow">Selecionar período</p>
          <h2 className="finlann-modal__title">Mês e ano</h2>
        </div>
      </header>

      <div className="finlann-modal__body">
        <div className="finlann-monthpicker">
          <div className="finlann-monthpicker__column">
            <div
              ref={monthWheelRef}
              className="finlann-monthpicker__wheel"
              onWheel={(e) => {
                e.preventDefault();
                handleWheelStep(setMonthIndex, MONTHS.length, e.deltaY);
              }}
              onScroll={() =>
                syncIndexToCenter(
                  monthWheelRef,
                  setMonthIndex,
                  MONTHS.length,
                  monthScrollTimeoutRef
                )
              }
            >
              {Array.from(
                { length: MONTHS.length + PADDING_TOP_ROWS + PADDING_BOTTOM_ROWS },
                (_, rowIndex) => {
                  const logicalIndex = rowIndex - PADDING_TOP_ROWS;
                  const isRealItem =
                    logicalIndex >= 0 && logicalIndex < MONTHS.length;
                  const label = isRealItem ? MONTHS[logicalIndex] : "";

                  return (
                    <button
                      key={`month-${rowIndex}`}
                      type="button"
                      className={
                        isRealItem
                          ? getItemClass(logicalIndex, monthIndex)
                          : "finlann-monthpicker__item is-far"
                      }
                      onClick={() => {
                        if (!isRealItem) return;
                        setMonthIndex(logicalIndex);
                      }}
                      disabled={!isRealItem}
                    >
                      {label}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          <div className="finlann-monthpicker__column">
            <div
              ref={yearWheelRef}
              className="finlann-monthpicker__wheel"
              onWheel={(e) => {
                e.preventDefault();
                handleWheelStep(setYearIndex, YEARS.length, e.deltaY);
              }}
              onScroll={() =>
                syncIndexToCenter(
                  yearWheelRef,
                  setYearIndex,
                  YEARS.length,
                  yearScrollTimeoutRef
                )
              }
            >
              {Array.from(
                { length: YEARS.length + PADDING_TOP_ROWS + PADDING_BOTTOM_ROWS },
                (_, rowIndex) => {
                  const logicalIndex = rowIndex - PADDING_TOP_ROWS;
                  const isRealItem =
                    logicalIndex >= 0 && logicalIndex < YEARS.length;
                  const label = isRealItem ? YEARS[logicalIndex] : "";

                  return (
                    <button
                      key={`year-${rowIndex}`}
                      type="button"
                      className={
                        isRealItem
                          ? getItemClass(logicalIndex, yearIndex)
                          : "finlann-monthpicker__item is-far"
                      }
                      onClick={() => {
                        if (!isRealItem) return;
                        setYearIndex(logicalIndex);
                      }}
                      disabled={!isRealItem}
                    >
                      {label}
                    </button>
                  );
                }
              )}
            </div>
          </div>
        </div>
      </div>

      <footer className="finlann-modal__footer">
        <button
          type="button"
          className="finlann-modal__secondary"
          onClick={onClose}
        >
          Fechar
        </button>
        <button
          type="button"
          className="finlann-modal__primary finlann-modal__primary--success"
          onClick={() => {
            if (onConfirm) {
              onConfirm({
                monthIndex,
                year: YEARS[yearIndex],
              });
            }
            onClose();
          }}
        >
          OK
        </button>
      </footer>
    </Overlay>
  );
}
