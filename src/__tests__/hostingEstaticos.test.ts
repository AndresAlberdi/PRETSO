import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import firebaseJson from '../../firebase.json';

const securityTxt = readFileSync('public/security.txt', 'utf8');
const field = (name: string) => securityTxt.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))?.[1]?.trim();

describe('security.txt y robots en Hosting', () => {
  it('reescribe /.well-known/security.txt antes del comodín', () => {
    const sources = firebaseJson.hosting.rewrites.map((r) => r.source);
    const well = sources.indexOf('/.well-known/security.txt');
    expect(well).toBeGreaterThanOrEqual(0);
    expect(well).toBeLessThan(sources.indexOf('**'));
    expect(firebaseJson.hosting.rewrites[well].destination).toBe('/security.txt');
  });

  it('declara Contact y Expires', () => {
    expect(field('Contact')).toBeTruthy();
    expect(field('Expires')).toBeTruthy();
  });

  it('Expires es una fecha futura de máximo un año, salvo que sea marcador', () => {
    const expires = field('Expires') ?? '';
    if (expires.startsWith('[[PENDIENTE')) return;
    const time = Date.parse(expires);
    expect(Number.isNaN(time)).toBe(false);
    expect(time).toBeGreaterThan(Date.now());
    expect(time).toBeLessThanOrEqual(Date.now() + 366 * 24 * 3600 * 1000);
  });

  it('envía X-Robots-Tag noindex en el bloque general', () => {
    const block = firebaseJson.hosting.headers.find((h) => h.source === '**');
    const tag = block?.headers.find((h) => h.key === 'X-Robots-Tag');
    expect(tag?.value).toBe('noindex, nofollow');
  });
});
