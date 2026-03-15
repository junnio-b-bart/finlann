export default function Overlay({ children, onClose, accentColor, kind, closeOnBackdrop = true }) {
  const panelStyle = accentColor
    ? {
        "--finlann-accent": accentColor,
        backgroundImage: `linear-gradient(135deg, rgba(2, 6, 23, 0.35), #020617 65%), ${accentColor}`,
      }
    : undefined;

  const panelClassName =
    "finlann-overlay__panel" +
    (kind === "expense" ? " finlann-overlay__panel--expense" : "") +
    (kind === "income" ? " finlann-overlay__panel--income" : "");

  const handleBackdropClick = () => {
    if (closeOnBackdrop) onClose?.();
  };

  return (
    <div className="finlann-overlay" onClick={handleBackdropClick}>
      <div
        className={panelClassName}
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
