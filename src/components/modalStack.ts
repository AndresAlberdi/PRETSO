// Lógica de la pila de ventanas modales: fondo inerte, contención de foco y Escape.
// Vive en un .ts (y no en Modal.tsx) para que Modal.tsx exporte solo el componente.

export interface ModalEntry {
  host: HTMLElement;
  panel: HTMLElement;
  overlay: HTMLElement;
  zIndex: number;
  // Elemento que tenía el foco al abrirse; la ventana superior puede heredar el de una inferior que se cierra antes.
  opener: Element | null;
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

// Escape se atiende en la fase de burbuja: los controles internos (React delega también en el
// contenedor del portal) pueden manejar su propio Escape y marcarlo con preventDefault.
function alEscape(e: KeyboardEvent) {
  if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing || e.repeat) return;
  const alEscapar = superior()?.getOnEscape();
  if (alEscapar) {
    e.preventDefault();
    alEscapar();
  }
}

function alKeydown(e: KeyboardEvent) {
  const top = superior();
  if (!top || e.key !== 'Tab') return;
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

// Agrega la modal a la pila y devuelve la función que la retira. Esa función devuelve `true` si la
// modal era la superior: solo entonces quien llama debe devolver el foco a `entry.opener`.
export function registerModal(entry: ModalEntry): () => boolean {
  const debajo = superior();
  if (debajo) {
    const propio = Number(entry.overlay.style.zIndex) || entry.zIndex;
    entry.overlay.style.zIndex = String(Math.max(propio, (Number(debajo.overlay.style.zIndex) || debajo.zIndex) + 1));
  }
  pila.push(entry);
  recalcularInert();
  if (!escuchando) {
    document.addEventListener('keydown', alKeydown, true);
    document.addEventListener('keydown', alEscape);
    document.addEventListener('focusin', alFocusin);
    escuchando = true;
  }
  return () => {
    const i = pila.indexOf(entry);
    const eraSuperior = i !== -1 && i === pila.length - 1;
    if (i !== -1) pila.splice(i, 1);
    // Si se cierra una inferior antes que las de arriba (mismo commit), las que se abrieron desde
    // dentro de ella heredan su origen, que es adonde debe volver el foco al final.
    if (i !== -1 && !eraSuperior) {
      for (const encima of pila.slice(i)) {
        if (encima.opener && entry.host.contains(encima.opener)) encima.opener = entry.opener;
      }
    }
    recalcularInert();
    if (pila.length === 0 && escuchando) {
      document.removeEventListener('keydown', alKeydown, true);
      document.removeEventListener('keydown', alEscape);
      document.removeEventListener('focusin', alFocusin);
      escuchando = false;
    }
    return eraSuperior;
  };
}
