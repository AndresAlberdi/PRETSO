import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { assertPublishable } from './src/utils/firebaseConfig.ts'
import { assertAppCheckPublishable, assertNoDebugTokenOutsideDevelopment } from './src/utils/appCheckConfig.ts'
import {
  firebaseConfig as productionConfig,
  recaptchaSiteKey as productionSiteKey,
} from './src/environments/production/firebase.ts'

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
  // El token de depuración de App Check es un secreto: solo se admite en desarrollo local.
  const viteEnv = loadEnv(mode, process.cwd(), 'VITE_')
  assertNoDebugTokenOutsideDevelopment(mode, viteEnv.VITE_APPCHECK_DEBUG_TOKEN)
  assertPublishable(mode, process.env.GITHUB_REF_TYPE, productionConfig, process.env.GITHUB_EVENT_NAME)
  assertAppCheckPublishable(mode, process.env.GITHUB_REF_TYPE, productionSiteKey, process.env.GITHUB_EVENT_NAME)
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@entorno': fileURLToPath(new URL(`./src/environments/${folder}`, import.meta.url)),
      },
    },
    test: {
      environment: 'jsdom',
      // Las pruebas de reglas requieren el emulador: se ejecutan con `npm run test:rules`.
      exclude: [...configDefaults.exclude, 'tests/rules/**'],
    },
  }
})
