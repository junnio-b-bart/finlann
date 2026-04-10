import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega todas as variaveis .env.* para o modo atual
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: "/finlann/", // TODO: se o repositorio tiver outro nome, trocar aqui pelo nome do repo
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL("./index.html", import.meta.url)),
          loadingPreview: fileURLToPath(new URL("./loading-preview.html", import.meta.url)),
        },
      },
    },
    define: {
      __FINLANN_GOOGLE_CLIENT_ID__: JSON.stringify(env.FINLANN_GOOGLE_CLIENT_ID || ""),
    },
  };
});
