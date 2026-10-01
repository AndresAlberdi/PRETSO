import { defineConfig } from 'vitest/config'

// Pruebas de reglas de Firestore: corren contra el emulador (FIRESTORE_EMULATOR_HOST).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20000,
  },
})
