// Puerta de accesibilidad en CI: esta prueba impide que se debilite `.oxlintrc.json`.
//
// Decisión sobre `jsx-a11y/control-has-associated-label` con `depth: 3`:
// con depth 2 la regla marca la `<td>` (oxlint trata `td` como control y su texto
// queda a profundidad 3: td > div > button > texto), no el botón. Con depth 3 esos
// casos se aceptan y siguen detectándose los botones sin nombre y el texto a
// profundidad 4. Por eso se exige exactamente depth 3.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const RAIZ = resolve(__dirname, '..', '..')
const config = JSON.parse(readFileSync(resolve(RAIZ, '.oxlintrc.json'), 'utf-8')) as {
  plugins: string[]
  rules: Record<string, unknown>
}

const REGLAS_A11Y = [
  'alt-text',
  'anchor-ambiguous-text',
  'anchor-has-content',
  'anchor-is-valid',
  'aria-activedescendant-has-tabindex',
  'aria-props',
  'aria-proptypes',
  'aria-role',
  'aria-unsupported-elements',
  'autocomplete-valid',
  'click-events-have-key-events',
  'control-has-associated-label',
  'heading-has-content',
  'html-has-lang',
  'iframe-has-title',
  'img-redundant-alt',
  'interactive-supports-focus',
  'label-has-associated-control',
  'lang',
  'media-has-caption',
  'mouse-events-have-key-events',
  'no-access-key',
  'no-aria-hidden-on-focusable',
  'no-autofocus',
  'no-distracting-elements',
  'no-interactive-element-to-noninteractive-role',
  'no-noninteractive-element-interactions',
  'no-noninteractive-element-to-interactive-role',
  'no-noninteractive-tabindex',
  'no-redundant-roles',
  'no-static-element-interactions',
  'prefer-tag-over-role',
  'role-has-required-aria-props',
  'role-supports-aria-props',
  'scope',
  'tabindex-no-positive',
]

function archivosTsx(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = resolve(dir, e.name)
    if (e.isDirectory()) return archivosTsx(ruta)
    return e.name.endsWith('.tsx') ? [ruta] : []
  })
}

describe('puerta de CI jsx-a11y', () => {
  it('declara 36 reglas y el plugin jsx-a11y activo', () => {
    expect(REGLAS_A11Y).toHaveLength(36)
    expect(config.plugins).toContain('jsx-a11y')
  })

  it('el JSON solo tiene las claves de primer nivel $schema, plugins y rules', () => {
    expect(Object.keys(config).sort()).toEqual(['$schema', 'plugins', 'rules'])
  })

  it('toda clave de rules con "a11y" (guion o guion bajo) es una de las 36 reglas con prefijo jsx-a11y/', () => {
    const permitidas = REGLAS_A11Y.map((r) => `jsx-a11y/${r}`)
    const claves = Object.keys(config.rules).filter((k) => k.includes('a11y'))
    expect(claves.filter((k) => !permitidas.includes(k))).toEqual([])
    expect([...claves].sort()).toEqual([...permitidas].sort())
  })

  for (const regla of REGLAS_A11Y) {
    it(`jsx-a11y/${regla} está en error`, () => {
      const valor = config.rules[`jsx-a11y/${regla}`]
      if (regla === 'control-has-associated-label') {
        expect(valor).toEqual(['error', { depth: 3 }])
      } else {
        expect(valor).toBe('error')
      }
    })
  }

  it('ninguna ventana ni página usa role="status" en lugar de <output>', () => {
    const infractores = [
      ...archivosTsx(resolve(RAIZ, 'src', 'components')),
      ...archivosTsx(resolve(RAIZ, 'src', 'pages')),
    ].filter((f) => readFileSync(f, 'utf-8').includes('role="status"'))
    expect(infractores).toEqual([])
  })
})
