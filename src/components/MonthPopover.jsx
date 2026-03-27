import React from "react";
import "../styles/finlann.css";

const MONTH_LABELS_SHORT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export default function MonthPopover({
  anchor, // opcional, por enquanto não usamos para posicionar exatamente
  currentMonthIndex,
  currentYear,
  onChange,
  onClose,
}) {
  const [year, setYear] = React.useState(currentYear);

  return (
    <div className="finlann-month-popover" onClick={(e) => e.stopPropagation()}>
      <div className="finlann-month-popover__header">
        <button
          type="button"
          className="finlann-month-popover__nav"
          onClick={() => setYear((y) => y - 1)}
        >
          {"<"}
        </button>
        <span className="finlann-month-popover__year">{year}</span>
        <button
          type="button"
          className="finlann-month-popover__nav"
          onClick={() => setYear((y) => y + 1)}
        >
          {">"}
        </button>
      </div>

      <div className="finlann-month-popover__grid">
        {MONTH_LABELS_SHORT.map((label, index) => {
          const isActive = index === currentMonthIndex && year === currentYear;
          return (
            <button
              key={label}
              type="button"
              className={
                "finlann-month-popover__month" + (isActive ? " is-active" : "")
              }
              onClick={() => {
                onChange?.({ monthIndex: index, year });
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
