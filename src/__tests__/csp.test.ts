import { describe, it, expect } from 'vitest';
import firebaseJson from '../../firebase.json';

const EXPECTED_CSP =
  "default-src 'self'; script-src 'self' https://accounts.google.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firebasestorage.googleapis.com https://www.google.com/recaptcha/; frame-src https://accounts.google.com https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

const block = firebaseJson.hosting.headers.find((entry) => entry.source === '**');
const headers = new Map((block?.headers ?? []).map((header) => [header.key, header.value]));
const csp = headers.get('Content-Security-Policy') ?? '';

describe('Content-Security-Policy de firebase.json', () => {
  it('matches the expected policy exactly', () => {
    expect(csp).toBe(EXPECTED_CSP);
  });

  it('keeps script-src free of unsafe-inline and unsafe-eval', () => {
    const scriptSrc = csp.split(';').find((directive) => directive.trim().startsWith('script-src')) ?? '';
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it('forbids framing and does not allow recaptcha.net', () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('recaptcha.net');
  });

  it('keeps the other security headers', () => {
    expect(headers.get('Strict-Transport-Security')).toBeTruthy();
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Referrer-Policy')).toBeTruthy();
    expect(headers.get('Permissions-Policy')).toBeTruthy();
  });
});
