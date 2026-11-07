import { describe, it } from 'vitest'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { crearEntorno } from './helpers.ts'

const entorno = crearEntorno('demo-pruebas-lectura-publica', 'firestore.rules')

const PUBLICAS = [
  'bibliografia',
  'companias',
  'corpus_christi',
  'documentos',
  'indicadores',
  'manejo_de_caja',
  'salarios',
  'transacciones',
]

const sembrar = () =>
  entorno.sembrar(async (db) => {
    for (const c of PUBLICAS) await setDoc(doc(db, `${c}/d1`), { Num: 1, Doc: 1 })
    await setDoc(doc(db, 'corpus_christi/c1/sub/s1'), { valor: 1 })
    await setDoc(doc(db, 'interna/x'), { valor: 1 })
    await setDoc(doc(db, 'Corpus_Christi/x'), { valor: 1 })
    await setDoc(doc(db, 'logs/l1'), { valor: 1 })
    await setDoc(doc(db, 'users/u1'), { valor: 1 })
  })

const anonimo = () => entorno.env().unauthenticatedContext().firestore()
const con = (claims: Record<string, unknown>) =>
  entorno.env().authenticatedContext('usuario', claims).firestore()

describe('reglas: lectura pública de las colecciones del corpus', () => {
  for (const c of PUBLICAS) {
    it(`el anónimo lee ${c} con get, list y where`, async () => {
      await sembrar()
      const db = anonimo()
      await assertSucceeds(getDoc(doc(db, `${c}/d1`)))
      await assertSucceeds(getDocs(collection(db, c)))
      const filtro =
        c === 'transacciones'
          ? where('Num', '==', 1)
          : c === 'documentos'
            ? where('Doc', 'in', [1, 2])
            : where('Num', '==', 1)
      await assertSucceeds(getDocs(query(collection(db, c), filtro)))
    })

    const sinPermisoEscritura: Array<[string, () => Record<string, unknown> | undefined]> = [
      ['anónimo', () => undefined],
      ['autenticado sin claims', () => ({})],
      ['{reader:true}', () => ({ reader: true })],
    ]
    for (const [nombre, claims] of sinPermisoEscritura) {
      it(`${nombre} no escribe en ${c}`, async () => {
        await sembrar()
        const cl = claims()
        const db = cl === undefined ? anonimo() : con(cl)
        await assertFails(setDoc(doc(db, `${c}/nuevo`), { valor: 2 }))
        await assertFails(addDoc(collection(db, c), { valor: 2 }))
        await assertFails(updateDoc(doc(db, `${c}/d1`), { valor: 3 }))
        await assertFails(deleteDoc(doc(db, `${c}/d1`)))
      })
    }

    it(`el admin sigue leyendo y escribiendo en ${c}`, async () => {
      await sembrar()
      const db = con({ admin: true })
      await assertSucceeds(getDoc(doc(db, `${c}/d1`)))
      await assertSucceeds(getDocs(collection(db, c)))
      await assertSucceeds(setDoc(doc(db, `${c}/nuevo`), { valor: 2 }))
      await assertSucceeds(updateDoc(doc(db, `${c}/d1`), { valor: 3 }))
      await assertSucceeds(deleteDoc(doc(db, `${c}/d1`)))
    })
  }
})

describe('reglas: lo que sigue reservado', () => {
  const sujetos: Array<[string, () => ReturnType<typeof anonimo>]> = [
    ['anónimo', () => anonimo()],
    ['autenticado sin claims', () => con({})],
    ['{reader:true}', () => con({ reader: true })],
  ]
  for (const [nombre, ctx] of sujetos) {
    for (const c of ['logs', 'users']) {
      it(`${nombre} no lee ${c} (get)`, async () => {
        await sembrar()
        await assertFails(getDoc(doc(ctx(), `${c}/${c === 'logs' ? 'l1' : 'u1'}`)))
      })
      it(`${nombre} no lee ${c} (list)`, async () => {
        await sembrar()
        await assertFails(getDocs(collection(ctx(), c)))
      })
    }
  }

  it('el anónimo no lee una subcolección (get)', async () => {
    await sembrar()
    await assertFails(getDoc(doc(anonimo(), 'corpus_christi/c1/sub/s1')))
  })

  it('el anónimo no lee una subcolección (list)', async () => {
    await sembrar()
    await assertFails(getDocs(collection(anonimo(), 'corpus_christi/c1/sub')))
  })

  it('el anónimo no lee una colección fuera de la lista', async () => {
    await sembrar()
    await assertFails(getDoc(doc(anonimo(), 'interna/x')))
    await assertFails(getDocs(collection(anonimo(), 'interna')))
  })

  it('el anónimo no lee el nombre con otra caja', async () => {
    await sembrar()
    await assertFails(getDoc(doc(anonimo(), 'Corpus_Christi/x')))
    await assertFails(getDocs(collection(anonimo(), 'Corpus_Christi')))
  })

  it('el anónimo no consulta con collectionGroup', async () => {
    await sembrar()
    await assertFails(getDocs(query(collectionGroup(anonimo(), 'sub'))))
  })
})
