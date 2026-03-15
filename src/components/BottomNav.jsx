import "../styles/globals.css";
import "../styles/tokens.css";

const items = [
  { id: "overview", label: "Resumo" },
  { id: "history", label: "Lançamentos" },
  { id: "settings", label: "Config" },
];

export default function BottomNav({ current = "overview", onChange }) {
  return (
    <nav className="finlann-bottom-nav">
      {items.map((item) => {
        const active = current === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={"finlann-bottom-nav__item" + (active ? " is-active" : "")}
            onClick={() => onChange?.(item.id)}
          >
            <span className="finlann-bottom-nav__dot" aria-hidden="true" />
            <span className="finlann-bottom-nav__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
