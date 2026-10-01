import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach } from 'vitest'
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'

export interface EntornoReglas {
  /** Entorno vivo; disponible una vez ejecutado beforeAll. */
  readonly env: () => RulesTestEnvironment
  /** Siembra documentos saltando las reglas. */
  sembrar: (
    escribir: (db: import('firebase/firestore').Firestore) => Promise<void>,
  ) => Promise<void>
}

/**
 * Crea el entorno de pruebas de reglas. Host y puerto se toman de
 * FIRESTORE_EMULATOR_HOST (lo define `firebase emulators:exec`).
 * El archivo de reglas se resuelve desde la raíz del repositorio.
 */
export function crearEntorno(projectId: string, archivoReglas: string): EntornoReglas {
  let env: RulesTestEnvironment | undefined

  const requerirEntorno = (): RulesTestEnvironment => {
    if (env === undefined) {
      throw new Error(
        'El entorno de pruebas de reglas no se inicializó (falló beforeAll; revise el error anterior).',
      )
    }
    return env
  }

  beforeAll(async () => {
    const ruta = new URL('../../' + archivoReglas, import.meta.url)
    env = await initializeTestEnvironment({
      projectId,
      firestore: { rules: readFileSync(ruta, 'utf8') },
    })
  })

  beforeEach(async () => {
    await requerirEntorno().clearFirestore()
  })

  afterAll(async () => {
    // Si beforeAll falló no hay nada que limpiar; el error original ya se reportó.
    if (env !== undefined) await env.cleanup()
  })

  return {
    env: requerirEntorno,
    sembrar: (escribir) =>
      requerirEntorno().withSecurityRulesDisabled(async (contexto) => {
        await escribir(contexto.firestore() as unknown as import('firebase/firestore').Firestore)
      }),
  }
}
