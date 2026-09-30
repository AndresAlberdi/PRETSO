import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { assertPublishable } from './src/utils/firebaseConfig.ts'
import { firebaseConfig as productionConfig } from './src/environments/production/firebase.ts'

// Modo de Vite -> carpeta de src/environments con la configuración del ambiente.
const ENVIRONMENT_FOLDERS: Record<string, string> = {
  development: 'staging',
  test: 'staging',
  staging: 'staging',
  production: 'production',
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const folder = ENVIRONMENT_FOLDERS[mode]
  if (!folder) {
    throw new Error(
      `Modo de build desconocido «${mode}». Modos válidos: ${Object.keys(ENVIRONMENT_FOLDERS).join(', ')}.`,
    )
  }
  assertPublishable(mode, process.env.GITHUB_REF_TYPE, productionConfig)
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@entorno': fileURLToPath(new URL(`./src/environments/${folder}`, import.meta.url)),
      },
    },
    test: {
      environment: 'jsdom',
    },
  }
})
