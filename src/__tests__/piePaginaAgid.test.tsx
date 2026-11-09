import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../legal/textosLegales', async (original) => {
  const real = await original<typeof import('../legal/textosLegales')>();
  return { ...real, PIE: { ...real.PIE, urlDeclaracionAgid: 'https://form.agid.gov.it/view/ejemplo' } };
});

import PiePagina from '../components/PiePagina';

afterEach(cleanup);

describe('PiePagina con declaración AGID', () => {
  it('el enlace de Accesibilidad es externo, con noopener noreferrer', () => {
    render(<MemoryRouter><PiePagina /></MemoryRouter>);
    const enlace = screen.getByRole('link', { name: 'Accesibilidad' });
    expect(enlace.getAttribute('href')).toBe('https://form.agid.gov.it/view/ejemplo');
    expect(enlace.getAttribute('target')).toBe('_blank');
    expect(enlace.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getByRole('link', { name: 'Privacidad' }).getAttribute('href')).toBe('/privacidad');
  });
});
