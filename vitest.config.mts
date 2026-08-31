import 'dotenv/config'
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Les tests d'intégration visent la branche Neon `dev` lue depuis `.env` —
// jamais la production. Ils créent leurs propres fixtures sous un préfixe
// dédié et les suppriment ensuite ; ils ne touchent pas aux données du seed.
export default defineConfig({
  test: {
    environment: 'node',
    // Prisma 7 charge son compilateur de requêtes en WebAssembly. Passé par le
    // pipeline de transformation de Vite, le module WASM ressort corrompu
    // (« expected type f64, found i32 ») et le client échoue à l'instanciation.
    // On l'externalise pour qu'il soit chargé nativement par Node.
    server: {
      deps: {
        external: [/@prisma\/client/, /\.prisma\/client/, /@prisma\/adapter-pg/],
      },
    },
    // Les tests de concurrence écrivent sur les mêmes lignes : les faire
    // tourner en parallèle les ferait s'interférer entre fichiers.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
})
