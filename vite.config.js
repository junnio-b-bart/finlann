import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
// Carrega todas as variáveis .env.* para o modo atual
const env = loadEnv(mode, process.cwd(), '')

return {
plugins: [react()],
define: {
__FINLANN_GOOGLE_CLIENT_ID__: JSON.stringify(env.FINLANN_GOOGLE_CLIENT_ID || ''),
},
}
})
