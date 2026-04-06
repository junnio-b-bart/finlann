import Overlay from "./Overlay.jsx";

export default function Dialog({
  title,
  description,
  children,
  onClose,
}) {
  return (
    <Overlay onClose={onClose} closeOnBackdrop={true}>
      <header className="finlann-modal__header">
        <div>
          <h2 className="finlann-modal__title">{title}</h2>
        </div>
      </header>

      <div className="finlann-modal__body">
        {description && (
          <p
            className="finlann-header__subtitle"
            style={{ marginBottom: 10, fontSize: "var(--font-size-xs)" }}
          >
            {description}
          </p>
        )}
        {children}
      </div>
    </Overlay>
  );
}
