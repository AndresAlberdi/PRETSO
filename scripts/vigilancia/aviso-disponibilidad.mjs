// @ts-check
// Emisor de avisos de disponibilidad de PRETSO, contrato `avisos-correo/v1`.
//
// Es una implementación TEMPORAL de texto constante (decisión D-3): valida la
// forma del contrato en el código y deja los detectores del ADR-011 a una
// prueba exhaustiva, porque la entrada es finita (enumeraciones y números
// acotados). Cuando exista el artefacto fijado de avisos-correo, un PR
// posterior reemplaza `validarAviso`, `renderizar` y `enviar` y conserva
// `construirAviso`.
//
// Nunca se imprime la clave, el destinatario, el asunto ni el cuerpo: la única
// salida es una línea JSON con códigos.
//
// Códigos de salida: 0 enviado o sin novedad; 10 contrato inválido;
// 11 tope del proyecto (reservado); 12 reintentos o cuota agotados;
// 13 configuración o rechazo 4xx.

import process from 'node:process'
import { pathToFileURL } from 'node:url'

export const CONTRATO = 'avisos-correo/v1'
export const PROYECTO = 'pretso'
export const VERSION = 'pretso-vigilancia/1'
export const ESTADOS_SITIO = ['ok', 'sin_respuesta', 'http_error', 'contenido', 'lento', 'no_vigilado']
export const ESTADOS_FUNCION = ['ok', 'sin_respuesta', 'respuesta_inesperada', 'no_vigilado']
export const MODOS = ['ranura', 'latido', 'prueba']

const ESTADOS_URGENTES = ['sin_respuesta', 'http_error', 'contenido']
const HOSTS_ENLACE = ['github.com', 'aab1.website']
const NOMBRES_ERROR_RESEND = [
  'daily_quota_exceeded',
  'monthly_quota_exceeded',
  'rate_limit_exceeded',
  'invalid_idempotent_request',
  'concurrent_idempotent_requests',
  'validation_error',
]
const ESPERAS_MS = [1000, 4000]

const TEXTO_URGENTE =
  'Autorizar a la sesión PRETSO a diagnosticar y, si hace falta, revertir staging. Sin su «sí» no se toca nada.'

/** Error de entrada: solo lleva el nombre del campo, nunca el valor. */
export class EntradaInvalida extends Error {
  /** @param {string} campo */
  constructor(campo) {
    super(`entrada invalida: ${campo}`)
    this.name = 'EntradaInvalida'
    this.campo = campo
  }
}

/** Error de contrato: solo lleva el nombre del campo, nunca el valor. */
export class AvisoInvalido extends Error {
  /** @param {string} campo */
  constructor(campo) {
    super(`aviso invalido: ${campo}`)
    this.name = 'AvisoInvalido'
    this.campo = campo
  }
}

/**
 * @typedef {Object} Entrada
 * @property {string} modo
 * @property {string} estadoStaging
 * @property {string} httpStaging
 * @property {string} msStaging
 * @property {string} estadoProduccion
 * @property {string} httpProduccion
 * @property {string} msProduccion
 * @property {string} estadoFuncion
 * @property {string} httpFuncion
 * @property {string} ocurridoEn
 * @property {string} idEjecucion
 * @property {string} enlace
 * @property {string} ejecuciones7d
 * @property {string} fallidas7d
 */

/**
 * @typedef {Object} Aviso
 * @property {string} contrato
 * @property {string} nivel
 * @property {string} proyecto
 * @property {string} asunto
 * @property {string} que_paso
 * @property {string} que_se_espera_de_andres
 * @property {string | null} enlace
 * @property {string} ocurrido_en
 * @property {string} id_unico
 */

/**
 * Lee y valida las variables de entorno. Lanza EntradaInvalida(campo).
 * @param {Record<string, string | undefined>} env
 * @returns {Entrada}
 */
export function leerEntrada(env) {
  /**
   * @param {string} nombre
   * @param {RegExp} patron
   * @param {boolean} [opcional]
   */
  const texto = (nombre, patron, opcional = false) => {
    const valor = env[nombre] ?? (opcional ? '' : undefined)
    if (typeof valor !== 'string' || !patron.test(valor)) throw new EntradaInvalida(nombre)
    return valor
  }
  /**
   * @param {string} nombre
   * @param {string[]} permitidos
   */
  const enumeracion = (nombre, permitidos) => {
    const valor = env[nombre]
    if (typeof valor !== 'string' || !permitidos.includes(valor)) throw new EntradaInvalida(nombre)
    return valor
  }
  const http = /^[0-9]{3}$/
  const ms = /^[0-9]{1,5}$/
  return {
    modo: enumeracion('MODO', MODOS),
    estadoStaging: enumeracion('ESTADO_STAGING', ESTADOS_SITIO),
    httpStaging: texto('HTTP_STAGING', http),
    msStaging: texto('MS_STAGING', ms),
    estadoProduccion: enumeracion('ESTADO_PRODUCCION', ESTADOS_SITIO),
    httpProduccion: texto('HTTP_PRODUCCION', http),
    msProduccion: texto('MS_PRODUCCION', ms),
    estadoFuncion: enumeracion('ESTADO_FUNCION', ESTADOS_FUNCION),
    httpFuncion: texto('HTTP_FUNCION', http),
    ocurridoEn: texto('OCURRIDO_EN', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
    idEjecucion: texto('ID_EJECUCION', /^[0-9]{1,20}$/),
    enlace: texto('ENLACE', /^https:\/\/github\.com\/[A-Za-z0-9-]+\/[A-Za-z0-9._-]+\/actions\/runs\/[0-9]+$/),
    ejecuciones7d: texto('EJECUCIONES_7D', /^[0-9]{0,3}$/, true),
    fallidas7d: texto('FALLIDAS_7D', /^[0-9]{0,3}$/, true),
  }
}

/**
 * @param {string} estado
 * @param {string} http
 * @param {string} ms
 */
function describirSitio(estado, http, ms) {
  switch (estado) {
    case 'ok':
      return `responde bien (${ms} ms)`
    case 'sin_respuesta':
      return 'no responde (sin conexión o tiempo agotado)'
    case 'http_error':
      return `responde con error HTTP ${http}`
    case 'contenido':
      return 'responde, pero sin la página de PRETSO'
    case 'lento':
      return `responde lento (${ms} ms)`
    default:
      return 'no vigilado (aún no publicado)'
  }
}

/**
 * @param {string} estado
 * @param {string} http
 */
function describirFuncion(estado, http) {
  switch (estado) {
    case 'ok':
      return 'rechaza el acceso sin sesión, como se espera'
    case 'sin_respuesta':
      return 'no responde'
    default:
      return `responde HTTP ${http} en vez de 401`
  }
}

/** @param {string[]} items */
function unir(items) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`
}

/**
 * Devuelve un aviso v1 o null si no hay nada que avisar.
 * @param {Entrada} e
 * @returns {Aviso | null}
 */
export function construirAviso(e) {
  const objetivos = [
    { etiqueta: 'Staging', estado: e.estadoStaging, sitio: true },
    { etiqueta: 'Producción', estado: e.estadoProduccion, sitio: true },
    { etiqueta: 'Función de usuarios (staging)', estado: e.estadoFuncion, sitio: false },
  ]
  const fallas = objetivos.filter((o) => o.estado !== 'ok' && o.estado !== 'no_vigilado')
  const hayFalla = fallas.length > 0
  if (e.modo === 'ranura' && !hayFalla) return null

  const lineas = [
    `- Staging: ${describirSitio(e.estadoStaging, e.httpStaging, e.msStaging)}.`,
    `- Producción: ${describirSitio(e.estadoProduccion, e.httpProduccion, e.msProduccion)}.`,
  ]
  if (e.estadoFuncion !== 'no_vigilado') {
    lineas.push(`- Función de usuarios (staging): ${describirFuncion(e.estadoFuncion, e.httpFuncion)}.`)
  }
  const fecha = e.ocurridoEn.slice(0, 10)
  /** @type {Aviso} */
  const base = {
    contrato: CONTRATO,
    nivel: 'informativo',
    proyecto: PROYECTO,
    asunto: '',
    que_paso: '',
    que_se_espera_de_andres: 'nada',
    enlace: e.enlace,
    ocurrido_en: e.ocurridoEn,
    id_unico: '',
  }

  if (e.modo === 'prueba') {
    return {
      ...base,
      asunto: 'Correo de verificación de la vigilancia',
      que_paso: [
        'Prueba manual: el canal de avisos de PRETSO funciona.',
        ...lineas,
        'Solo sale un correo de prueba por día (UTC); una segunda prueba ese día falla a propósito.',
      ].join('\n'),
      que_se_espera_de_andres: 'Confirmar a la sesión PRETSO que este correo llegó y en qué carpeta.',
      id_unico: `prueba-${fecha}`,
    }
  }

  if (hayFalla) {
    const lista = unir(fallas.map((o) => o.etiqueta))
    const urgente = objetivos.some((o) => o.sitio && ESTADOS_URGENTES.includes(o.estado))
    return {
      ...base,
      nivel: urgente ? 'urgente' : 'aviso',
      asunto: `Fallo de disponibilidad: ${lista}`,
      que_paso: [
        `Falló la comprobación de ${lista} tras 3 intentos.`,
        ...lineas,
        'El correo de fallo de GitHub llega aparte (segundo canal).',
      ].join('\n'),
      que_se_espera_de_andres: urgente ? TEXTO_URGENTE : 'nada',
      id_unico: `disponibilidad-${e.idEjecucion}`,
    }
  }

  const titular =
    e.ejecuciones7d === '' || e.fallidas7d === ''
      ? 'Vigilancia activa; sin conteo de 7 días disponible.'
      : `Vigilancia activa; en 7 días, ${e.fallidas7d} de ${e.ejecuciones7d} ejecuciones terminaron en rojo.`
  return {
    ...base,
    asunto: 'PRETSO vigilado',
    que_paso: [titular, ...lineas, 'Si el próximo lunes no llega este correo, la vigilancia se detuvo.'].join('\n'),
    id_unico: `resumen-${fecha}`,
  }
}

/** @param {string} s */
const largo = (s) => [...s].length

/**
 * Valida la forma del contrato v1. Lanza AvisoInvalido(campo).
 * @param {Aviso} a
 */
export function validarAviso(a) {
  const claves = [
    'contrato',
    'nivel',
    'proyecto',
    'asunto',
    'que_paso',
    'que_se_espera_de_andres',
    'enlace',
    'ocurrido_en',
    'id_unico',
  ]
  if (a === null || typeof a !== 'object') throw new AvisoInvalido('aviso')
  const propias = Object.keys(a)
  if (propias.length !== claves.length || !claves.every((c) => propias.includes(c))) {
    throw new AvisoInvalido('claves')
  }
  if (a.contrato !== CONTRATO) throw new AvisoInvalido('contrato')
  if (!['urgente', 'aviso', 'informativo'].includes(a.nivel)) throw new AvisoInvalido('nivel')
  if (typeof a.proyecto !== 'string' || !/^[a-z][a-z0-9-]{1,29}$/.test(a.proyecto)) {
    throw new AvisoInvalido('proyecto')
  }
  if (typeof a.asunto !== 'string' || largo(a.asunto) < 3 || largo(a.asunto) > 100 || /[\r\n]/.test(a.asunto)) {
    throw new AvisoInvalido('asunto')
  }
  if (typeof a.que_paso !== 'string' || a.que_paso === '' || largo(a.que_paso) > 1500) {
    throw new AvisoInvalido('que_paso')
  }
  const lineas = a.que_paso.split('\n')
  if (lineas.length > 30 || largo(lineas[0]) > 110) throw new AvisoInvalido('que_paso')
  const espera = a.que_se_espera_de_andres
  if (typeof espera !== 'string' || largo(espera) < 1 || largo(espera) > 180 || /[\r\n]/.test(espera)) {
    throw new AvisoInvalido('que_se_espera_de_andres')
  }
  if (a.enlace !== null && !enlaceValido(a.enlace)) throw new AvisoInvalido('enlace')
  if (typeof a.ocurrido_en !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(a.ocurrido_en)) {
    throw new AvisoInvalido('ocurrido_en')
  }
  if (typeof a.id_unico !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/.test(a.id_unico)) {
    throw new AvisoInvalido('id_unico')
  }
}

/** @param {unknown} enlace */
function enlaceValido(enlace) {
  if (typeof enlace !== 'string' || largo(enlace) > 300) return false
  if (/[?#@\s]/.test(enlace) || !enlace.startsWith('https://')) return false
  let url
  try {
    url = new URL(enlace)
  } catch {
    return false
  }
  return (
    url.protocol === 'https:' &&
    HOSTS_ENLACE.includes(url.hostname) &&
    url.port === '' &&
    url.username === '' &&
    url.password === '' &&
    url.search === '' &&
    url.hash === '' &&
    // El host se compara como cadena exacta: lo que sigue a `https://` hasta la primera `/`.
    HOSTS_ENLACE.includes(enlace.slice('https://'.length).split('/')[0])
  )
}

/** @param {string} s */
function escaparHtml(s) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/**
 * Arma asunto y cuerpo según la plantilla del contrato.
 * @param {Aviso} a
 * @returns {{subject: string, text: string, html: string}}
 */
export function renderizar(a) {
  const nivel = a.id_unico.startsWith('resumen-') ? 'RESUMEN' : a.nivel.toUpperCase()
  const subject = `[AAB1 ${nivel}] ${a.proyecto} · ${a.asunto}`
  if (largo(subject) > 150) throw new AvisoInvalido('asunto')
  const [primera, ...resto] = a.que_paso.split('\n')
  const partes = [
    `${nivel} · ${a.proyecto} · ${a.ocurrido_en}`,
    `Qué se espera de Andres: ${a.que_se_espera_de_andres}`,
    `Qué pasó: ${primera}`,
    ...resto,
  ]
  if (a.enlace !== null) partes.push(`Enlace: ${a.enlace}`)
  partes.push(
    '',
    `ref ${a.proyecto}:${a.id_unico} · contrato ${CONTRATO}`,
    'Aviso automático; responder a este correo no llega a nadie.',
    'Las acciones las ejecuta Claude con la autorización de Andres.',
  )
  const text = partes.join('\n')
  return { subject, text, html: `<pre>${escaparHtml(text)}</pre>` }
}

/**
 * Envía el aviso por Resend con reintentos acotados.
 * @param {Aviso} aviso
 * @param {{apiKey?: string, de?: string, para?: string, fetchImpl?: typeof fetch, esperar?: (ms: number) => Promise<void>}} opciones
 * @returns {Promise<{resultado: string, detalle: string, codigoSalida: number}>}
 */
export async function enviar(aviso, opciones) {
  const {
    apiKey,
    de,
    para,
    fetchImpl = fetch,
    esperar = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms)),
  } = opciones
  if (
    !apiKey ||
    typeof para !== 'string' ||
    !/^[^@\s]+@[^@\s]+$/.test(para) ||
    typeof de !== 'string' ||
    !/<alertas-pretso@[^>\s]+>$/.test(de)
  ) {
    return { resultado: 'error', detalle: 'configuracion', codigoSalida: 13 }
  }
  const { subject, text, html } = renderizar(aviso)
  // Se serializa una sola vez: los reintentos reutilizan el mismo cuerpo.
  const cuerpo = JSON.stringify({ from: de, to: [para], subject, text, html })
  const cabeceras = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Idempotency-Key': `pretso:${aviso.id_unico}`,
  }
  const intentos = ESPERAS_MS.length + 1
  for (let i = 0; i < intentos; i++) {
    let reintentable = false
    try {
      const resp = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: cabeceras,
        body: cuerpo,
        signal: AbortSignal.timeout(20000),
      })
      if (resp.status >= 200 && resp.status < 300) {
        return { resultado: 'enviado', detalle: 'ok', codigoSalida: 0 }
      }
      const nombre = await leerNombreError(resp)
      if (resp.status >= 500) {
        reintentable = true
      } else if (resp.status === 429 && (nombre === 'daily_quota_exceeded' || nombre === 'monthly_quota_exceeded')) {
        return { resultado: 'error', detalle: 'cuota_equipo', codigoSalida: 12 }
      } else if (resp.status === 429 || (resp.status === 409 && nombre === 'concurrent_idempotent_requests')) {
        reintentable = true
      } else if (resp.status === 409 && nombre === 'invalid_idempotent_request') {
        return { resultado: 'error', detalle: 'idempotencia_distinta', codigoSalida: 13 }
      } else {
        return { resultado: 'error', detalle: 'rechazo_proveedor', codigoSalida: 13 }
      }
    } catch {
      reintentable = true
    }
    if (reintentable && i < ESPERAS_MS.length) await esperar(ESPERAS_MS[i])
  }
  return { resultado: 'error', detalle: 'reintentos_agotados', codigoSalida: 12 }
}

/**
 * Lee solo `name` del cuerpo de error, y solo si está en la lista cerrada.
 * @param {Response} resp
 * @returns {Promise<string>}
 */
async function leerNombreError(resp) {
  try {
    const cuerpo = await resp.json()
    const nombre = cuerpo && typeof cuerpo === 'object' ? cuerpo.name : undefined
    return typeof nombre === 'string' && NOMBRES_ERROR_RESEND.includes(nombre) ? nombre : ''
  } catch {
    return ''
  }
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{fetchImpl?: typeof fetch, esperar?: (ms: number) => Promise<void>}} deps
 * @returns {Promise<{linea: string, codigoSalida: number}>}
 */
export async function ejecutar(env, deps) {
  /**
   * @param {string | null} ref
   * @param {string | null} nivel
   * @param {string} resultado
   * @param {string} detalle
   * @param {number} codigoSalida
   */
  const salida = (ref, nivel, resultado, detalle, codigoSalida) => ({
    linea: JSON.stringify({ evento: 'aviso', proyecto: PROYECTO, ref, nivel, resultado, detalle, version: VERSION }),
    codigoSalida,
  })
  try {
    const aviso = construirAviso(leerEntrada(env))
    if (aviso === null) return salida(null, null, 'nada', 'sin_novedad', 0)
    validarAviso(aviso)
    const r = await enviar(aviso, {
      apiKey: env.AVISOS_RESEND_API_KEY,
      de: env.AVISOS_DE,
      para: env.AVISOS_PARA,
      fetchImpl: deps.fetchImpl,
      esperar: deps.esperar,
    })
    return salida(aviso.id_unico, aviso.nivel, r.resultado, r.detalle, r.codigoSalida)
  } catch (error) {
    if (error instanceof EntradaInvalida || error instanceof AvisoInvalido) {
      return salida(null, null, 'error', `contrato:${error.campo}`, 10)
    }
    throw error
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = await ejecutar(process.env, {})
  console.log(r.linea)
  process.exitCode = r.codigoSalida
}
