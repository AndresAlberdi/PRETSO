import { describe, it } from 'vitest'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  addDoc,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { crearEntorno } from './helpers.ts'

const REGLAS = 'firestore.rules'
const entorno = crearEntorno('demo-pruebas-claim', REGLAS)

const RUTAS = ['corpus_christi/c1', 'corpus_christi/c1/sub/s1', 'logs/l1', 'users/u1']
// Rutas cubiertas por el bloque global (lectura con lector()).
const RUTAS_GLOBALES = ['corpus_christi/c1', 'corpus_christi/c1/sub/s1']
// Rutas donde el administrador escribe sin restricción adicional (logs tiene su bloque aparte).
const RUTAS_ESCRIBIBLES = ['corpus_christi/c1', 'corpus_christi/c1/sub/s1', 'users/u1']
const RUTAS_RESTRINGIDAS = ['logs/l1', 'users/u1']

const sembrarDocs = () =>
  entorno.sembrar(async (db) => {
    for (const ruta of RUTAS) await setDoc(doc(db, ruta), { valor: 1 })
  })

const contexto = (claims?: Record<string, unknown>) =>
  claims === undefined
    ? entorno.env().unauthenticatedContext().firestore()
    : entorno.env().authenticatedContext('usuario', claims).firestore()

describe('reglas: claim admin verdadero', () => {
  const variantes: Array<[string, Record<string, unknown>]> = [
    ['con correo administrador', { admin: true, email: 'pretsodatabase@gmail.com', email_verified: true }],
    ['con otro correo', { admin: true, email: 'alberdi.andres@gmail.com', email_verified: true }],
    ['sin email (el claim basta)', { admin: true }],
  ]
  for (const [nombre, claims] of variantes) {
    for (const ruta of RUTAS_ESCRIBIBLES) {
      it(`${nombre} lee, crea, actualiza y borra en ${ruta}`, async () => {
        await sembrarDocs()
        const db = contexto(claims)
        await assertSucceeds(getDoc(doc(db, ruta)))
        await assertSucceeds(setDoc(doc(db, `${ruta}-nuevo`), { valor: 2 }))
        await assertSucceeds(updateDoc(doc(db, ruta), { valor: 3 }))
        await assertSucceeds(deleteDoc(doc(db, ruta)))
      })
    }
  }
})

describe('reglas: correo administrador sin claim', () => {
  for (const ruta of RUTAS) {
    it(`no lee ni escribe en ${ruta}`, async () => {
      await sembrarDocs()
      const db = contexto({ email: 'pretsodatabase@gmail.com', email_verified: true })
      await assertFails(getDoc(doc(db, ruta)))
      await assertFails(setDoc(doc(db, `${ruta}-nuevo`), { valor: 2 }))
      await assertFails(updateDoc(doc(db, ruta), { valor: 3 }))
      await assertFails(deleteDoc(doc(db, ruta)))
    })
  }
})

describe('reglas: claims que no son admin == true', () => {
  const casos: Array<[string, Record<string, unknown>]> = [
    ["admin: 'true' (cadena)", { admin: 'true' }],
    ["admin: 'True' (cadena)", { admin: 'True' }],
    ['admin: 1', { admin: 1 }],
    ['admin: false', { admin: false }],
    ['admin: null', { admin: null }],
    ['admin: [true]', { admin: [true] }],
    ['admin: {}', { admin: {} }],
    ['reader: true', { reader: true }],
  ]
  for (const [nombre, claims] of casos) {
    for (const ruta of RUTAS) {
      it(`${nombre} no escribe en ${ruta}`, async () => {
        await sembrarDocs()
        const db = contexto(claims)
        await assertFails(setDoc(doc(db, `${ruta}-nuevo`), { valor: 2 }))
        await assertFails(updateDoc(doc(db, ruta), { valor: 3 }))
        await assertFails(deleteDoc(doc(db, ruta)))
      })
    }
  }
})

describe('reglas: lectura', () => {
  for (const ruta of RUTAS_GLOBALES) {
    it(`{reader:true} lee ${ruta}`, async () => {
      await sembrarDocs()
      await assertSucceeds(getDoc(doc(contexto({ reader: true }), ruta)))
    })
    it(`autenticado sin claims no lee ${ruta}`, async () => {
      await sembrarDocs()
      await assertFails(getDoc(doc(contexto({}), ruta)))
    })
  }

  it('{reader:true} lee por consulta getDocs(collection)', async () => {
    await sembrarDocs()
    await assertSucceeds(getDocs(collection(contexto({ reader: true }), 'corpus_christi')))
  })

  it('admin lee por consulta getDocs(collection)', async () => {
    await sembrarDocs()
    await assertSucceeds(getDocs(collection(contexto({ admin: true }), 'corpus_christi')))
  })

  it('autenticado sin claims no lee por consulta', async () => {
    await sembrarDocs()
    await assertFails(getDocs(collection(contexto({}), 'corpus_christi')))
  })

  it('anónimo no lee por consulta', async () => {
    await sembrarDocs()
    await assertFails(getDocs(collection(contexto(), 'corpus_christi')))
  })

  for (const ruta of RUTAS_RESTRINGIDAS) {
    const coleccion = ruta.split('/')[0]!
    it(`{reader:true} no lee ${ruta} ni la consulta`, async () => {
      await sembrarDocs()
      const db = contexto({ reader: true })
      await assertFails(getDoc(doc(db, ruta)))
      await assertFails(getDocs(collection(db, coleccion)))
    })
    it(`admin lee ${ruta} y la consulta`, async () => {
      await sembrarDocs()
      const db = contexto({ admin: true })
      await assertSucceeds(getDoc(doc(db, ruta)))
      await assertSucceeds(getDocs(collection(db, coleccion)))
    })
  }
})

describe('reglas: anónimo', () => {
  for (const ruta of RUTAS) {
    it(`no lee ni escribe en ${ruta}`, async () => {
      await sembrarDocs()
      const db = contexto()
      await assertFails(getDoc(doc(db, ruta)))
      await assertFails(setDoc(doc(db, `${ruta}-nuevo`), { valor: 2 }))
      await assertFails(updateDoc(doc(db, ruta), { valor: 3 }))
      await assertFails(deleteDoc(doc(db, ruta)))
    })
  }
})

describe('reglas: bitácora logs', () => {
  const ADMIN = { admin: true, email: 'admin@example.com' }
  const entrada = (user: unknown, extra: Record<string, unknown> = {}) => ({
    action: 'CREATE',
    collection: 'companias',
    recordId: 'x1',
    user,
    timestamp: serverTimestamp(),
    details: { a: 1 },
    ...extra,
  })
  const logs = (claims?: Record<string, unknown>) => collection(contexto(claims), 'logs')

  for (const action of ['CREATE', 'EDIT', 'DELETE']) {
    it(`admin crea una entrada válida con action ${action}`, async () => {
      await assertSucceeds(addDoc(logs(ADMIN), entrada(ADMIN.email, { action })))
    })
  }

  it('admin crea una entrada con details nulo', async () => {
    await assertSucceeds(addDoc(logs(ADMIN), entrada(ADMIN.email, { details: null })))
  })

  it('admin consulta la bitácora ordenada por timestamp', async () => {
    await sembrarDocs()
    await assertSucceeds(getDocs(query(logs(ADMIN), orderBy('timestamp', 'desc'))))
  })

  const invalidas: Array<[string, Record<string, unknown>]> = [
    ['user distinto del correo del token', { user: 'otra@example.com' }],
    ['timestamp del cliente', { timestamp: Timestamp.now() }],
    ["action 'PURGE'", { action: 'PURGE' }],
    ['campo extra', { extra: 1 }],
    ["details como cadena 'x'", { details: 'x' }],
    ['collection vacía', { collection: '' }],
    ['recordId que no es cadena', { recordId: 5 }],
  ]
  for (const [nombre, extra] of invalidas) {
    it(`rechaza: ${nombre}`, async () => {
      await assertFails(addDoc(logs(ADMIN), entrada(ADMIN.email, extra)))
    })
  }

  it('rechaza una entrada sin details', async () => {
    const { details: _omitido, ...sinDetails } = entrada(ADMIN.email)
    await assertFails(addDoc(logs(ADMIN), sinDetails))
  })

  it('rechaza al admin sin correo en el token', async () => {
    await assertFails(addDoc(logs({ admin: true }), entrada('desconocido')))
  })

  it('admin no actualiza ni borra una entrada existente', async () => {
    await sembrarDocs()
    const db = contexto(ADMIN)
    await assertFails(updateDoc(doc(db, 'logs/l1'), { valor: 3 }))
    await assertFails(deleteDoc(doc(db, 'logs/l1')))
  })

  it('admin no escribe en subcolecciones de logs', async () => {
    await assertFails(setDoc(doc(contexto(ADMIN), 'logs/l1/sub/s1'), { valor: 1 }))
  })

  const sinPermiso: Array<[string, Record<string, unknown> | undefined]> = [
    ['{reader:true}', { reader: true, email: 'lector@example.com' }],
    ['{} (sin claims)', { email: 'otro@example.com' }],
    ['anónimo', undefined],
  ]
  for (const [nombre, claims] of sinPermiso) {
    it(`${nombre} no crea una entrada válida`, async () => {
      const correo = (claims?.email as string | undefined) ?? 'x@example.com'
      await assertFails(addDoc(logs(claims), entrada(correo)))
    })
  }

  it('{reader:true} no consulta la bitácora', async () => {
    await sembrarDocs()
    await assertFails(getDocs(query(logs({ reader: true }), orderBy('timestamp', 'desc'))))
  })

  it('el admin conserva crear, editar y borrar en corpus_christi y users', async () => {
    await sembrarDocs()
    const db = contexto(ADMIN)
    for (const ruta of RUTAS_ESCRIBIBLES) {
      await assertSucceeds(setDoc(doc(db, `${ruta}-nuevo`), { valor: 2 }))
      await assertSucceeds(updateDoc(doc(db, ruta), { valor: 3 }))
      await assertSucceeds(deleteDoc(doc(db, ruta)))
    }
  })
})
