import "../styles/globals.css";
import "../styles/tokens.css";
import resumoIcon from "../assets/resumo.png";
import lancamentosIcon from "../assets/lancamentos.png";
import configuracoesIcon from "../assets/configuracoes.png";

const items = [
  { id: "overview", label: "Resumo", icon: resumoIcon },
  { id: "history", label: "Lançamentos", icon: lancamentosIcon },
  { id: "settings", label: "Configurações", icon: configuracoesIcon },
];

export default function BottomNav({ current = "overview", onChange }) {
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === current)
  );

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
            <div className="finlann-bottom-nav__content">
              <img
                src={item.icon}
                alt={item.label}
                className="finlann-bottom-nav__icon"
              />
              <span className="finlann-bottom-nav__label">{item.label}</span>
            </div>
          </button>
        );
      })}
    </nav>
  );
}
