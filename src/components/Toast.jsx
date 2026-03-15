export default function Toast({ message, kind = "success" }) {
  if (!message) return null;

  const baseClass = "finlann-toast";
  const kindClass = kind === "error" ? " finlann-toast--error" : " finlann-toast--success";

  return (
    <div className={baseClass + kindClass}>
      <span>{message}</span>
    </div>
  );
}
