import { describe, it } from 'vitest'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { crearEntorno } from './helpers.ts'

const REGLAS = 'firestore.rules'
const entorno = crearEntorno('demo-pruebas-actuales', REGLAS)
const ADMIN_CORREO = 'pretsodatabase@gmail.com'

const sembrarDoc = () =>
  entorno.sembrar(async (db) => {
    await setDoc(doc(db, 'corpus_christi/c1'), { valor: 1 })
  })

const comoUsuario = (claims: Record<string, unknown>) =>
  entorno.env().authenticatedContext('usuario', claims).firestore()

describe('reglas actuales (firestore.rules)', () => {
  it('el correo administrador crea, actualiza y borra', async () => {
    await sembrarDoc()
    const db = comoUsuario({ email: ADMIN_CORREO })
    await assertSucceeds(setDoc(doc(db, 'corpus_christi/c2'), { valor: 2 }))
    await assertSucceeds(updateDoc(doc(db, 'corpus_christi/c1'), { valor: 3 }))
    await assertSucceeds(deleteDoc(doc(db, 'corpus_christi/c1')))
  })

  it('otro correo (sin claim) no escribe', async () => {
    await sembrarDoc()
    const db = comoUsuario({ email: 'alberdi.andres@gmail.com' })
    await assertFails(setDoc(doc(db, 'corpus_christi/c2'), { valor: 2 }))
    await assertFails(updateDoc(doc(db, 'corpus_christi/c1'), { valor: 3 }))
    await assertFails(deleteDoc(doc(db, 'corpus_christi/c1')))
  })

  for (const correo of [
    'PRETSODATABASE@gmail.com',
    'pretsodatabase@gmail.com.evil.com',
    'xpretsodatabase@gmail.com',
  ]) {
    it(`el correo parecido ${correo} no escribe`, async () => {
      await sembrarDoc()
      const db = comoUsuario({ email: correo })
      await assertFails(setDoc(doc(db, 'corpus_christi/c2'), { valor: 2 }))
      await assertFails(updateDoc(doc(db, 'corpus_christi/c1'), { valor: 3 }))
      await assertFails(deleteDoc(doc(db, 'corpus_christi/c1')))
    })
  }

  it('un token {admin:true} con otro correo no escribe (hoy el claim no da escritura)', async () => {
    await sembrarDoc()
    const db = comoUsuario({ admin: true, email: 'alberdi.andres@gmail.com' })
    await assertFails(setDoc(doc(db, 'corpus_christi/c2'), { valor: 2 }))
    await assertFails(updateDoc(doc(db, 'corpus_christi/c1'), { valor: 3 }))
    await assertFails(deleteDoc(doc(db, 'corpus_christi/c1')))
  })

  it('un token sin email no escribe', async () => {
    await sembrarDoc()
    const db = comoUsuario({})
    await assertFails(setDoc(doc(db, 'corpus_christi/c2'), { valor: 2 }))
    await assertFails(updateDoc(doc(db, 'corpus_christi/c1'), { valor: 3 }))
    await assertFails(deleteDoc(doc(db, 'corpus_christi/c1')))
  })

  it('un usuario autenticado lee', async () => {
    await sembrarDoc()
    const db = comoUsuario({ email: 'alberdi.andres@gmail.com' })
    await assertSucceeds(getDoc(doc(db, 'corpus_christi/c1')))
  })

  it('un anónimo (sin sesión) no lee ni escribe', async () => {
    await sembrarDoc()
    const db = entorno.env().unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'corpus_christi/c1')))
    await assertFails(setDoc(doc(db, 'corpus_christi/c2'), { valor: 2 }))
  })

  it('un anónimo no actualiza ni borra un documento existente', async () => {
    await sembrarDoc()
    const db = entorno.env().unauthenticatedContext().firestore()
    await assertFails(updateDoc(doc(db, 'corpus_christi/c1'), { valor: 3 }))
    await assertFails(deleteDoc(doc(db, 'corpus_christi/c1')))
  })
})
