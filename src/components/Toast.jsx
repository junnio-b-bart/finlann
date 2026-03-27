import checkIcon from "../assets/icons/check.png";

export default function Toast({ message, kind = "success" }) {
  if (!message) return null;

  const baseClass = "finlann-toast";
  const kindClass = kind === "error" ? " finlann-toast--error" : " finlann-toast--success";

  const isSuccess = kind !== "error";

  return (
    <div className={baseClass + kindClass}>
      {isSuccess && (
        <img
          src={checkIcon}
          alt="Sucesso"
          className="finlann-toast__icon"
        />
      )}
      <span className="finlann-toast__message">{message}</span>
    </div>
  );
}
