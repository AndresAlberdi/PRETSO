import { describe, it } from 'vitest'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { crearEntorno } from './helpers.ts'

const REGLAS = 'firestore.rules'
const entorno = crearEntorno('demo-pruebas-claim', REGLAS)

const RUTAS = ['corpus_christi/c1', 'corpus_christi/c1/sub/s1', 'logs/l1', 'users/u1']
// Rutas cubiertas por el bloque global (lectura con lector()).
const RUTAS_GLOBALES = ['corpus_christi/c1', 'corpus_christi/c1/sub/s1']
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
    for (const ruta of RUTAS) {
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
