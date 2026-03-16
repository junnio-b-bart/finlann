import { createClient } from "@supabase/supabase-js";
import { normalizeState, exportState } from "./finance.sync.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// id fixo antigo; agora vamos usar um identificador configurável por conta
// mantemos um fallback para não quebrar nada se não houver conta definida
const DEFAULT_HOUSEHOLD_ID = "household_default";

export function getCurrentHouseholdId() {
  if (typeof window === "undefined") return DEFAULT_HOUSEHOLD_ID;
  const stored = window.localStorage.getItem("finlann.householdId");
  return stored && stored.trim() ? stored.trim() : DEFAULT_HOUSEHOLD_ID;
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
console.warn(
"[Finlann] Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local"
);
}

const supabase =
SUPABASE_URL && SUPABASE_ANON_KEY
? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
: null;

export async function loadStateFromBackend(householdId) {
if (!supabase) return null;

const effectiveId = householdId || getCurrentHouseholdId();

const { data, error } = await supabase
.from("finlann_state")
.select("state")
.eq("id", effectiveId)
.maybeSingle();

if (error) {
console.error("[Finlann] Erro ao carregar estado do backend:", error);
// Se não existir linha ainda, tratamos como null
if (error.code === "PGRST116") {
return null;
}
throw error;
}

if (!data || !data.state) return null;

return normalizeState(data.state);
}

export async function saveStateToBackend(financeState, householdId) {
  if (!supabase) return;

  const stateToSave = exportState(financeState);
  const effectiveId = householdId || getCurrentHouseholdId();

  const { error } = await supabase.from("finlann_state").upsert(
    {
      id: effectiveId,
      state: stateToSave,
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("[Finlann] Erro ao salvar estado no backend:", error);
    throw error;
  }

  return normalizeState(stateToSave);
}

export async function createAccount(profile) {
  if (!supabase) {
    throw new Error("Supabase não configurado");
  }

  const { data, error } = await supabase
    .from("finlann_accounts")
    .insert(profile)
    .select()
    .single();

  if (error) {
    console.error("[Finlann] Erro ao criar conta:", error);
    console.error("[Finlann] Detalhes do erro ao criar conta:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      status: error.status,
    });
    throw error;
  }

  return data;
}

export async function loginAccount({ user_id, password }) {
  if (!supabase) {
    throw new Error("Supabase não configurado");
  }

  const { data, error } = await supabase
    .from("finlann_accounts")
    .select("id, user_id, email, first_name, last_name, has_password, password, theme_color")
    .eq("user_id", user_id)
    .maybeSingle();

  if (error) {
    console.error("[Finlann] Erro ao buscar conta para login:", error);
    throw error;
  }

  if (!data) {
    throw new Error("INVALID_CREDENTIALS");
  }

  if (data.has_password) {
    if (!password || data.password !== password) {
      throw new Error("INVALID_CREDENTIALS");
    }
  }

  return data;
}
