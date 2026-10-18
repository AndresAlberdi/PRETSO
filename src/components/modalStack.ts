// Lógica de la pila de ventanas modales: fondo inerte, contención de foco y Escape.
// Vive en un .ts (y no en Modal.tsx) para que Modal.tsx exporte solo el componente.

export interface ModalEntry {
  host: HTMLElement;
  panel: HTMLElement;
  overlay: HTMLElement;
  zIndex: number;
  getOnEscape: () => (() => void) | undefined;
}

const SELECTOR_ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const ETIQUETAS_OMITIDAS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE']);

const pila: ModalEntry[] = [];
// Elementos a los que la pila les puso `inert` (uno que ya lo tenía antes no se toca).
const marcadosPorPila = new Set<Element>();
let escuchando = false;

export function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(SELECTOR_ENFOCABLES)).filter(
    el => el !== root && !el.closest('[hidden]'),
  );
}

function superior(): ModalEntry | undefined {
  return pila[pila.length - 1];
}

function recalcularInert() {
  const top = superior();
  for (const hijo of Array.from(document.body.children)) {
    if (ETIQUETAS_OMITIDAS.has(hijo.tagName)) continue;
    if (top && hijo !== top.host) {
      if (!hijo.hasAttribute('inert')) {
        hijo.setAttribute('inert', '');
        marcadosPorPila.add(hijo);
      }
    } else if (marcadosPorPila.has(hijo)) {
      hijo.removeAttribute('inert');
      marcadosPorPila.delete(hijo);
    }
  }
  if (!top) {
    for (const el of marcadosPorPila) el.removeAttribute('inert');
    marcadosPorPila.clear();
  }
}

function alKeydown(e: KeyboardEvent) {
  const top = superior();
  if (!top) return;
  if (e.key === 'Escape') {
    if (e.isComposing) return;
    const alEscapar = top.getOnEscape();
    if (alEscapar) {
      e.preventDefault();
      e.stopPropagation();
      alEscapar();
    }
    return;
  }
  if (e.key !== 'Tab') return;
  const enfocables = getFocusable(top.panel);
  if (enfocables.length === 0) {
    e.preventDefault();
    top.panel.focus();
    return;
  }
  const primero = enfocables[0];
  const ultimo = enfocables[enfocables.length - 1];
  const activo = document.activeElement;
  const dentro = activo instanceof Node && top.host.contains(activo);
  if (e.shiftKey) {
    if (!dentro || activo === primero || activo === top.panel) {
      e.preventDefault();
      ultimo.focus();
    }
  } else if (!dentro || activo === ultimo) {
    e.preventDefault();
    primero.focus();
  }
}

function alFocusin(e: FocusEvent) {
  const top = superior();
  if (!top) return;
  const destino = e.target;
  if (destino instanceof Node && top.host.contains(destino)) return;
  (getFocusable(top.panel)[0] ?? top.panel).focus();
}

// Agrega la modal a la pila y devuelve la función que la retira.
export function registerModal(entry: ModalEntry): () => void {
  const debajo = superior();
  if (debajo) {
    const propio = Number(entry.overlay.style.zIndex) || entry.zIndex;
    entry.overlay.style.zIndex = String(Math.max(propio, (Number(debajo.overlay.style.zIndex) || debajo.zIndex) + 1));
  }
  pila.push(entry);
  recalcularInert();
  if (!escuchando) {
    document.addEventListener('keydown', alKeydown, true);
    document.addEventListener('focusin', alFocusin);
    escuchando = true;
  }
  return () => {
    const i = pila.indexOf(entry);
    if (i !== -1) pila.splice(i, 1);
    recalcularInert();
    if (pila.length === 0 && escuchando) {
      document.removeEventListener('keydown', alKeydown, true);
      document.removeEventListener('focusin', alFocusin);
      escuchando = false;
    }
  };
}
