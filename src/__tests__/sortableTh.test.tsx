import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import SortableTh from '../components/SortableTh';

afterEach(cleanup);

type Config = { key: string; direction: 'asc' | 'desc' } | null;

function renderTabla(sortConfig: Config, onSort = vi.fn()) {
  render(
    <table>
      <thead>
        <tr>
          <SortableTh label="Ciudad" sortKey="Ciudad" sortConfig={sortConfig} onSort={onSort} />
          <SortableTh label="Año" sortKey="Año" sortConfig={sortConfig} onSort={onSort} style={{ width: '80px' }} />
        </tr>
      </thead>
    </table>,
  );
  return onSort;
}

describe('SortableTh', () => {
  it('el th contiene un botón cuyo nombre accesible es la etiqueta visible', () => {
    renderTabla(null);
    const th = screen.getByRole('columnheader', { name: 'Ciudad' });
    expect(th.querySelector('button')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Ciudad' })).toBeTruthy();
    expect(th.getAttribute('scope')).toBe('col');
  });

  it('sin orden previo ningún encabezado tiene aria-sort', () => {
    renderTabla(null);
    for (const th of screen.getAllByRole('columnheader')) {
      expect(th.hasAttribute('aria-sort')).toBe(false);
    }
  });

  it('el clic llama a onSort con la clave de orden', () => {
    const onSort = renderTabla(null);
    fireEvent.click(screen.getByRole('button', { name: 'Año' }));
    expect(onSort).toHaveBeenCalledTimes(1);
    expect(onSort).toHaveBeenCalledWith('Año');
  });

  it('activo ascendente: aria-sort="ascending" solo en la columna activa', () => {
    renderTabla({ key: 'Ciudad', direction: 'asc' });
    expect(screen.getByRole('columnheader', { name: 'Ciudad' }).getAttribute('aria-sort')).toBe('ascending');
    expect(screen.getByRole('columnheader', { name: 'Año' }).hasAttribute('aria-sort')).toBe(false);
  });

  it('activo descendente: aria-sort="descending" solo en la columna activa', () => {
    renderTabla({ key: 'Año', direction: 'desc' });
    expect(screen.getByRole('columnheader', { name: 'Año' }).getAttribute('aria-sort')).toBe('descending');
    expect(screen.getByRole('columnheader', { name: 'Ciudad' }).hasAttribute('aria-sort')).toBe(false);
  });

  it('el indicador es aria-hidden y no forma parte del nombre accesible', () => {
    renderTabla({ key: 'Ciudad', direction: 'asc' });
    const boton = screen.getByRole('button', { name: 'Ciudad' });
    const indicador = boton.querySelector('span');
    expect(indicador).not.toBeNull();
    expect(indicador?.getAttribute('aria-hidden')).toBe('true');
    expect(indicador?.textContent).toContain('▲');
    // Con nombre exacto «Ciudad» el botón se encuentra: el ▲ no se anuncia.
    expect(screen.getByRole('button', { name: 'Ciudad' })).toBe(boton);
  });

  it('sin orden activo no se dibuja indicador', () => {
    renderTabla(null);
    expect(document.querySelector('th span')).toBeNull();
  });

  it('es un botón nativo (type="button") y el th no tiene manejador de clic propio', () => {
    // jsdom no sintetiza un clic al pulsar Enter o Espacio sobre un botón; en navegadores un
    // <button> nativo los activa por sí mismo. Se verifica entonces que sea un botón nativo y que
    // el clic (lo que el navegador dispara con esas teclas) llegue a onSort.
    const onSort = renderTabla(null);
    const boton = screen.getByRole('button', { name: 'Ciudad' });
    expect(boton.tagName).toBe('BUTTON');
    expect(boton.getAttribute('type')).toBe('button');
    expect(boton.getAttribute('tabindex')).toBeNull();
    const th = boton.closest('th') as HTMLElement;
    expect(th.getAttribute('role')).toBeNull();
    expect(th.getAttribute('tabindex')).toBeNull();
    fireEvent.click(th);
    expect(onSort).not.toHaveBeenCalled();
    fireEvent.click(boton);
    expect(onSort).toHaveBeenCalledTimes(1);
  });

  it('conserva el estilo en línea recibido en el th', () => {
    renderTabla(null);
    expect(screen.getByRole('columnheader', { name: 'Año' }).style.width).toBe('80px');
  });
});

describe('estilos del botón de encabezado', () => {
  it('neutraliza el :hover global de los botones (fondo, desplazamiento y sombra)', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const css = readFileSync(resolve(__dirname, '..', 'index.css'), 'utf-8');
    const m = css.match(/th > button\.sort-header-button:hover\s*\{([^}]*)\}/);
    expect(m).not.toBeNull();
    expect(m![1]).toMatch(/background:\s*none/);
    expect(m![1]).toMatch(/transform:\s*none/);
    expect(m![1]).toMatch(/box-shadow:\s*none/);
    expect(css).not.toMatch(/sort-header-button[^{]*\{[^}]*outline/);
  });
});
