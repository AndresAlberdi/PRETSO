// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import {
  AvisoInvalido,
  EntradaInvalida,
  ESTADOS_FUNCION,
  ESTADOS_SITIO,
  MODOS,
  construirAviso,
  ejecutar,
  enviar,
  leerEntrada,
  renderizar,
  validarAviso,
} from '../../scripts/vigilancia/aviso-disponibilidad.mjs'

const AHORA = new Date('2026-11-09T17:50:00Z')
const ENLACE = 'https://github.com/AndresAlberdi/PRETSO/actions/runs/25123456789'
const CLAVE = 're_CLAVE_DE_PRUEBA_que_no_debe_aparecer'
const PARA = 'destinatario.secreto@example.org'
const DE = 'AAB1 avisos · pretso <alertas-pretso@avisos.aab1.website>'

function env(extra: Record<string, string> = {}): Record<string, string> {
  return {
    MODO: 'ranura',
    ESTADO_STAGING: 'ok',
    HTTP_STAGING: '200',
    MS_STAGING: '350',
    ESTADO_PRODUCCION: 'no_vigilado',
    HTTP_PRODUCCION: '000',
    MS_PRODUCCION: '0',
    ESTADO_FUNCION: 'ok',
    HTTP_FUNCION: '401',
    OCURRIDO_EN: '2026-11-09T17:47:03Z',
    ID_EJECUCION: '25123456789',
    ENLACE,
    EJECUCIONES_7D: '84',
    FALLIDAS_7D: '2',
    ...extra,
  }
}

const aviso = (extra: Record<string, string> = {}) => construirAviso(leerEntrada(env(extra)))

describe('construirAviso', () => {
  it('ranura con todo ok no avisa', () => {
    expect(aviso()).toBeNull()
  })

  it('latido con todo ok es informativo con resumen-<fecha>', () => {
    const a = aviso({ MODO: 'latido' })
    expect(a?.nivel).toBe('informativo')
    expect(a?.id_unico).toBe('resumen-2026-11-09')
    expect(a?.asunto).toBe('PRETSO vigilado')
    expect(a?.que_paso.split('\n')[0]).toBe(
      'Vigilancia activa; en 7 días, 2 de 84 ejecuciones terminaron en rojo.',
    )
    expect(a?.que_se_espera_de_andres).toBe('nada')
  })

  it('latido sin conteo usa el titular alterno', () => {
    const a = aviso({ MODO: 'latido', EJECUCIONES_7D: '', FALLIDAS_7D: '' })
    expect(a?.que_paso.split('\n')[0]).toBe('Vigilancia activa; sin conteo de 7 días disponible.')
  })

  it('latido con staging http_error es urgente con disponibilidad-<id>', () => {
    const a = aviso({ MODO: 'latido', ESTADO_STAGING: 'http_error', HTTP_STAGING: '503' })
    expect(a?.nivel).toBe('urgente')
    expect(a?.id_unico).toBe('disponibilidad-25123456789')
    expect(a?.asunto).toBe('Fallo de disponibilidad: Staging')
    expect(a?.que_paso).toContain('- Staging: responde con error HTTP 503.')
    expect(a?.que_se_espera_de_andres).toContain('Sin su «sí» no se toca nada.')
  })

  it('prueba usa prueba-<fecha> aunque todo esté ok', () => {
    const a = aviso({ MODO: 'prueba' })
    expect(a?.id_unico).toBe('prueba-2026-11-09')
    expect(a?.nivel).toBe('informativo')
    expect(a?.asunto).toBe('Correo de verificación de la vigilancia')
  })

  it('solo lento es aviso con «nada»', () => {
    const a = aviso({ ESTADO_STAGING: 'lento', MS_STAGING: '9000' })
    expect(a?.nivel).toBe('aviso')
    expect(a?.que_se_espera_de_andres).toBe('nada')
    expect(a?.que_paso).toContain('- Staging: responde lento (9000 ms).')
  })

  it('solo la función en respuesta_inesperada es aviso', () => {
    const a = aviso({ ESTADO_FUNCION: 'respuesta_inesperada', HTTP_FUNCION: '403' })
    expect(a?.nivel).toBe('aviso')
    expect(a?.asunto).toBe('Fallo de disponibilidad: Función de usuarios (staging)')
    expect(a?.que_paso).toContain('- Función de usuarios (staging): responde HTTP 403 en vez de 401.')
  })

  it('producción no_vigilado no cuenta como falla', () => {
    expect(aviso({ ESTADO_PRODUCCION: 'no_vigilado' })).toBeNull()
  })

  it('une varias etiquetas con coma y «y»', () => {
    const a = aviso({ ESTADO_STAGING: 'sin_respuesta', ESTADO_PRODUCCION: 'contenido', ESTADO_FUNCION: 'sin_respuesta' })
    expect(a?.asunto).toBe('Fallo de disponibilidad: Staging, Producción y Función de usuarios (staging)')
  })

  it('omite la línea de la función si no está vigilada', () => {
    const a = aviso({ MODO: 'prueba', ESTADO_FUNCION: 'no_vigilado' })
    expect(a?.que_paso).not.toContain('Función de usuarios')
  })
})

const DETECTORES: [string, RegExp][] = [
  ['prefijos de credenciales', /re_|Bearer |gh[pousr]_|github_pat_|AKIA|AIza|xox|EAA|eyJ|-----BEGIN/],
  ['palabra larga', /[A-Za-z0-9+/=_-]{32,}/],
  ['más y dígito', /\+\d/],
  ['siete dígitos', /\d{7,}/],
  ['seis dígitos aislados', /(?<!\d)\d{6}(?!\d)/],
  ['arroba', /@/],
  ['esquema', /:\/\//],
  ['www', /www\./],
  ['ipv4', /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/],
  ['localhost', /localhost/],
  ['.internal', /\.internal/],
  ['.local', /\.local/],
]

// Las aserciones de `expect` cuestan demasiado para ~15 000 combinaciones: se usa un lanzador simple.
function exigir(condicion: boolean, mensaje: string): void {
  if (!condicion) throw new Error(mensaje)
}

describe('exhaustiva de combinaciones', () => {
  it('todo aviso posible es válido, no activa detectores y cabe en 400 caracteres', () => {
    const conteos: [string, string][] = [['', ''], ['0', '0'], ['999', '999'], ['', '5']]
    let casos = 0
    let avisos = 0
    for (const MODO of MODOS)
      for (const ESTADO_STAGING of ESTADOS_SITIO)
        for (const ESTADO_PRODUCCION of ESTADOS_SITIO)
          for (const ESTADO_FUNCION of ESTADOS_FUNCION)
            for (const http of ['000', '200', '503'])
              for (const ms of ['0', '8001', '99999'])
                for (const [EJECUCIONES_7D, FALLIDAS_7D] of conteos) {
                  casos++
                  const a = aviso({
                    MODO,
                    ESTADO_STAGING,
                    ESTADO_PRODUCCION,
                    ESTADO_FUNCION,
                    HTTP_STAGING: http,
                    HTTP_PRODUCCION: http,
                    HTTP_FUNCION: http,
                    MS_STAGING: ms,
                    MS_PRODUCCION: ms,
                    EJECUCIONES_7D,
                    FALLIDAS_7D,
                  })
                  if (a === null) continue
                  avisos++
                  validarAviso(a, AHORA)
                  // `enlace` e `id_unico` tienen su propia validación de forma (el id lleva el run_id).
                  for (const campo of [a.asunto, a.que_paso, a.que_se_espera_de_andres, a.ocurrido_en]) {
                    for (const [nombre, patron] of DETECTORES) {
                      if (patron.test(campo)) throw new Error(`detector ${nombre} en caso ${JSON.stringify(a)}`)
                    }
                  }
                  const primera = a.que_paso.split('\n')[0]
                  exigir([...primera].length <= 110, 'primera línea de más de 110')
                  exigir([...a.que_se_espera_de_andres].length <= 180, 'expectativa de más de 180')
                  exigir([...a.asunto].length >= 3 && [...a.asunto].length <= 100, 'asunto fuera de rango')
                  const r = renderizar(a)
                  const inicio = r.text.slice(0, 400)
                  const nivel = a.id_unico.startsWith('resumen-') ? 'RESUMEN' : a.nivel.toUpperCase()
                  exigir(inicio.includes(nivel), 'falta el nivel en los primeros 400')
                  exigir(inicio.includes('pretso'), 'falta pretso en los primeros 400')
                  exigir(inicio.includes(a.que_se_espera_de_andres), 'falta la expectativa en los primeros 400')
                  exigir(inicio.includes(primera), 'falta el titular en los primeros 400')
                  exigir([...r.subject].length <= 150, 'asunto del correo de más de 150')
                }
    expect(casos).toBe(3 * 6 * 6 * 4 * 3 * 3 * 4)
    expect(avisos).toBeGreaterThan(0)
  })
})

describe('renderizar', () => {
  const a = aviso({ MODO: 'latido' })!
  it('usa RESUMEN si el id empieza por resumen-', () => {
    const r = renderizar(a)
    expect(r.subject).toBe('[AAB1 RESUMEN] pretso · PRETSO vigilado')
    expect(r.text.startsWith('RESUMEN · pretso · 2026-11-09T17:47:03Z\nQué se espera de Andres: nada\nQué pasó: ')).toBe(true)
    expect(r.text).toContain('ref pretso:resumen-2026-11-09 · contrato avisos-correo/v1')
  })
  it('escapa el html y conserva la línea de enlace', () => {
    const r = renderizar({ ...a, que_paso: 'Primera <b> & "x" \'y\'' })
    expect(r.html.startsWith('<pre>')).toBe(true)
    expect(r.html).toContain('&lt;b&gt; &amp; &quot;x&quot; &#39;y&#39;')
    expect(r.html).not.toContain('<b>')
    expect(r.text).toContain(`Enlace: ${ENLACE}`)
  })
  it('omite la línea Enlace con enlace null', () => {
    expect(renderizar({ ...a, enlace: null }).text).not.toContain('Enlace:')
  })
  it('falla si el asunto supera 150', () => {
    expect(() => renderizar({ ...a, asunto: 'x'.repeat(140) })).toThrow(AvisoInvalido)
  })
})

describe('validarAviso', () => {
  const base = aviso({ MODO: 'latido' })!
  const rechaza = (cambio: Record<string, unknown>, campo: string, valor?: string) => {
    let error: unknown
    try {
      validarAviso({ ...base, ...cambio } as typeof base, AHORA)
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(AvisoInvalido)
    expect((error as AvisoInvalido).campo).toBe(campo)
    if (valor) expect((error as Error).message).not.toContain(valor)
  }
  it('acepta el aviso base', () => {
    expect(() => validarAviso(base, AHORA)).not.toThrow()
  })
  it('rechaza una clave extra', () => rechaza({ extra: 'valor-secreto-extra' }, 'claves', 'valor-secreto-extra'))
  it('rechaza enlace con consulta', () => rechaza({ enlace: 'https://github.com/a/b?x=1' }, 'enlace', 'x=1'))
  it('rechaza enlace con host evil.github.com', () => rechaza({ enlace: 'https://evil.github.com/a' }, 'enlace', 'evil'))
  it('rechaza enlace http', () => rechaza({ enlace: 'http://github.com/a' }, 'enlace'))
  it('rechaza ocurrido_en con fracciones', () => rechaza({ ocurrido_en: '2026-11-09T17:47:03.123Z' }, 'ocurrido_en', '.123'))
  it('rechaza id_unico de 7 caracteres', () => rechaza({ id_unico: 'abcdefg' }, 'id_unico', 'abcdefg'))
  it('rechaza asunto con salto de línea', () => rechaza({ asunto: 'uno\ndos' }, 'asunto', 'uno'))
  it('rechaza enlaces con puerto, fragmento, usuario, mayúsculas o punto final', () => {
    for (const enlace of [
      'https://github.com:443/a/b',
      'https://github.com/a/b#frag',
      'https://usuario@github.com/a/b',
      'https://GITHUB.COM/a/b',
      'https://github.com./a/b',
    ]) {
      expect(() => validarAviso({ ...base, enlace }, AHORA), enlace).toThrow(AvisoInvalido)
    }
  })
  it('acota ocurrido_en: 30 días atrás y 10 minutos adelante', () => {
    const ok = (ocurrido_en: string) => expect(() => validarAviso({ ...base, ocurrido_en }, AHORA)).not.toThrow()
    const mal = (ocurrido_en: string) => rechaza({ ocurrido_en }, 'ocurrido_en')
    ok('2026-10-10T17:50:00Z')
    mal('2026-10-10T17:49:59Z')
    ok('2026-11-09T18:00:00Z')
    mal('2026-11-09T18:00:01Z')
  })
  it('rechaza primera línea de más de 110', () => rechaza({ que_paso: 'x'.repeat(111) }, 'que_paso'))
  it('rechaza más de 30 líneas', () => rechaza({ que_paso: Array(31).fill('a').join('\n') }, 'que_paso'))
})

describe('leerEntrada', () => {
  const rechaza = (cambio: Record<string, string | undefined>, campo: string) => {
    const e = { ...env(), ...cambio }
    let error: unknown
    try {
      leerEntrada(e)
    } catch (x) {
      error = x
    }
    expect(error).toBeInstanceOf(EntradaInvalida)
    expect((error as EntradaInvalida).campo).toBe(campo)
  }
  it('acepta una entrada válida y conteos vacíos', () => {
    expect(() => leerEntrada(env({ EJECUCIONES_7D: '', FALLIDAS_7D: '' }))).not.toThrow()
  })
  it('rechaza un estado fuera de la enumeración', () => rechaza({ ESTADO_STAGING: 'roto' }, 'ESTADO_STAGING'))
  it('rechaza HTTP no numérico', () => rechaza({ HTTP_STAGING: 'abc' }, 'HTTP_STAGING'))
  it('rechaza MS de 6 dígitos', () => rechaza({ MS_STAGING: '123456' }, 'MS_STAGING'))
  it('rechaza ENLACE de otro host', () => rechaza({ ENLACE: 'https://evil.example/a/b/actions/runs/1' }, 'ENLACE'))
  it('rechaza MODO ausente', () => rechaza({ MODO: undefined }, 'MODO'))
})

describe('enviar', () => {
  const a = aviso({ MODO: 'prueba' })!
  const resp = (status: number, cuerpo: unknown = {}) =>
    ({ status, json: async () => cuerpo }) as unknown as Response
  const opciones = (fetchImpl: unknown, esperar = vi.fn(async () => {})) => ({
    apiKey: CLAVE,
    de: DE,
    para: PARA,
    fetchImpl: fetchImpl as typeof fetch,
    esperar,
  })

  it('200: código 0 con cabeceras y destinatario como arreglo', async () => {
    const f = vi.fn(async () => resp(200))
    const r = await enviar(a, opciones(f))
    expect(r).toEqual({ resultado: 'enviado', detalle: 'ok', codigoSalida: 0 })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    const h = init.headers as Record<string, string>
    expect(h['Idempotency-Key']).toBe(`pretso:${a.id_unico}`)
    expect(h.Authorization).toBe(`Bearer ${CLAVE}`)
    const cuerpo = JSON.parse(init.body as string)
    expect(cuerpo.to).toEqual([PARA])
    expect(cuerpo.from).toBe(DE)
  })

  it('500, 500, 200: tres llamadas, misma clave y cuerpo, esperas 1000 y 4000', async () => {
    const f = vi.fn().mockResolvedValueOnce(resp(500)).mockResolvedValueOnce(resp(500)).mockResolvedValueOnce(resp(200))
    const esperar = vi.fn(async () => {})
    const r = await enviar(a, opciones(f, esperar))
    expect(r.codigoSalida).toBe(0)
    expect(f).toHaveBeenCalledTimes(3)
    const init = f.mock.calls.map((c) => c[1] as RequestInit)
    expect(new Set(init.map((i) => i.body)).size).toBe(1)
    expect(new Set(init.map((i) => (i.headers as Record<string, string>)['Idempotency-Key'])).size).toBe(1)
    expect(esperar.mock.calls.map((c) => c[0])).toEqual([1000, 4000])
  })

  it('422: una llamada, código 13', async () => {
    const f = vi.fn(async () => resp(422, { name: 'validation_error', message: 'detalle ignorado' }))
    const r = await enviar(a, opciones(f))
    expect(f).toHaveBeenCalledTimes(1)
    expect(r).toEqual({ resultado: 'error', detalle: 'rechazo_proveedor', codigoSalida: 13 })
  })

  it('429 daily_quota_exceeded: una llamada, código 12', async () => {
    const f = vi.fn(async () => resp(429, { name: 'daily_quota_exceeded' }))
    const r = await enviar(a, opciones(f))
    expect(f).toHaveBeenCalledTimes(1)
    expect(r).toEqual({ resultado: 'error', detalle: 'cuota_equipo', codigoSalida: 12 })
  })

  it('429 rate_limit_exceeded tres veces: tres llamadas, código 12', async () => {
    const f = vi.fn(async () => resp(429, { name: 'rate_limit_exceeded' }))
    const r = await enviar(a, opciones(f))
    expect(f).toHaveBeenCalledTimes(3)
    expect(r).toEqual({ resultado: 'error', detalle: 'reintentos_agotados', codigoSalida: 12 })
  })

  it('409 concurrent_idempotent_requests se reintenta', async () => {
    const f = vi.fn().mockResolvedValueOnce(resp(409, { name: 'concurrent_idempotent_requests' })).mockResolvedValueOnce(resp(200))
    const r = await enviar(a, opciones(f))
    expect(f).toHaveBeenCalledTimes(2)
    expect(r.codigoSalida).toBe(0)
  })

  it('TypeError de red se reintenta', async () => {
    const f = vi.fn().mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(resp(200))
    const r = await enviar(a, opciones(f))
    expect(f).toHaveBeenCalledTimes(2)
    expect(r.codigoSalida).toBe(0)
  })

  it('409 invalid_idempotent_request: código 13 sin reintento', async () => {
    const f = vi.fn(async () => resp(409, { name: 'invalid_idempotent_request' }))
    const r = await enviar(a, opciones(f))
    expect(f).toHaveBeenCalledTimes(1)
    expect(r).toEqual({ resultado: 'error', detalle: 'idempotencia_distinta', codigoSalida: 13 })
  })

  it('409 sin name o con name fuera de la lista: rechazo_proveedor 13', async () => {
    for (const cuerpo of [{}, { name: 'otro_error' }]) {
      const f = vi.fn(async () => resp(409, cuerpo))
      const r = await enviar(a, opciones(f))
      expect(f).toHaveBeenCalledTimes(1)
      expect(r).toEqual({ resultado: 'error', detalle: 'rechazo_proveedor', codigoSalida: 13 })
    }
  })

  it('500 tres veces: reintentos_agotados 12', async () => {
    const f = vi.fn(async () => resp(500))
    const r = await enviar(a, opciones(f))
    expect(f).toHaveBeenCalledTimes(3)
    expect(r).toEqual({ resultado: 'error', detalle: 'reintentos_agotados', codigoSalida: 12 })
  })

  it('configuración inválida: código 13 sin llamar a fetch', async () => {
    for (const malo of [
      { apiKey: '' },
      { de: 'AAB1 avisos · pretso <otra-parte@avisos.aab1.website>' },
      { para: 'sin-arroba' },
    ]) {
      const f = vi.fn(async () => resp(200))
      const r = await enviar(a, { ...opciones(f), ...malo })
      expect(r).toEqual({ resultado: 'error', detalle: 'configuracion', codigoSalida: 13 })
      expect(f).not.toHaveBeenCalled()
    }
  })
})

describe('ejecutar', () => {
  const entorno = (extra: Record<string, string> = {}) => ({
    ...env({ MODO: 'prueba', ...extra }),
    AVISOS_RESEND_API_KEY: CLAVE,
    AVISOS_PARA: PARA,
    AVISOS_DE: DE,
  })
  const deps = (f: unknown) => ({ fetchImpl: f as typeof fetch, esperar: async () => {}, ahora: AHORA })

  it('la línea tiene exactamente 7 claves y no filtra datos', async () => {
    const f = vi.fn(async () => ({ status: 200, json: async () => ({}) }) as unknown as Response)
    const r = await ejecutar(entorno(), deps(f))
    expect(r.codigoSalida).toBe(0)
    const obj = JSON.parse(r.linea)
    expect(Object.keys(obj).sort()).toEqual(['detalle', 'evento', 'nivel', 'proyecto', 'ref', 'resultado', 'version'])
    const a = aviso({ MODO: 'prueba' })!
    for (const prohibido of [CLAVE, PARA, a.asunto, a.que_paso, a.que_se_espera_de_andres, 'alertas-pretso']) {
      expect(r.linea).not.toContain(prohibido)
    }
    expect(obj.ref).toBe('prueba-2026-11-09')
  })

  it('sin novedad: resultado nada y código 0, sin llamar a fetch', async () => {
    const f = vi.fn()
    const r = await ejecutar(entorno({ MODO: 'ranura' }), deps(f))
    expect(JSON.parse(r.linea)).toMatchObject({ resultado: 'nada', detalle: 'sin_novedad' })
    expect(r.codigoSalida).toBe(0)
    expect(f).not.toHaveBeenCalled()
  })

  it('entrada inválida: código 10 con contrato:<campo>', async () => {
    const f = vi.fn()
    const r = await ejecutar(entorno({ ESTADO_STAGING: 'roto' }), deps(f))
    expect(r.codigoSalida).toBe(10)
    expect(JSON.parse(r.linea).detalle).toBe('contrato:ESTADO_STAGING')
    expect(r.linea).not.toContain('roto')
    expect(f).not.toHaveBeenCalled()
  })

  it('propaga el código de salida del envío', async () => {
    const f = vi.fn(async () => ({ status: 422, json: async () => ({}) }) as unknown as Response)
    const r = await ejecutar(entorno(), deps(f))
    expect(r.codigoSalida).toBe(13)
    expect(JSON.parse(r.linea).detalle).toBe('rechazo_proveedor')
  })
})
