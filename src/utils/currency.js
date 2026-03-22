export function formatCurrencyInput(raw) {
  if (!raw) return "";
  // Mantém só dígitos e assume sempre 2 casas decimais (centavos)
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";

  const value = Number(digits) / 100;
  if (Number.isNaN(value)) return "";

  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function parseCurrencyInput(raw) {
  if (!raw) return 0;
  const normalized = String(raw)
    .replace(/[^0-9,\.]/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  const value = Number(normalized);
  return Number.isNaN(value) ? 0 : value;
}
