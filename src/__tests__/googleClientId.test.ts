import { describe, it, expect } from 'vitest';
import { DEFAULT_GOOGLE_CLIENT_ID, resolveGoogleClientId } from '../utils/googleClientId';

describe('utils: resolveGoogleClientId', () => {
  it('uses the built-in Client ID when nothing is saved', () => {
    expect(resolveGoogleClientId(null)).toBe(DEFAULT_GOOGLE_CLIENT_ID);
    expect(resolveGoogleClientId(undefined)).toBe(DEFAULT_GOOGLE_CLIENT_ID);
  });

  it('uses the built-in Client ID when the saved value is blank', () => {
    expect(resolveGoogleClientId('')).toBe(DEFAULT_GOOGLE_CLIENT_ID);
    expect(resolveGoogleClientId('   ')).toBe(DEFAULT_GOOGLE_CLIENT_ID);
  });

  it('prefers a Client ID saved in the browser, trimmed', () => {
    expect(resolveGoogleClientId('  123-abc.apps.googleusercontent.com ')).toBe('123-abc.apps.googleusercontent.com');
  });

  it('ships a well-formed web Client ID of the pretso-database project', () => {
    expect(DEFAULT_GOOGLE_CLIENT_ID).toMatch(/^48942361199-[a-z0-9]+\.apps\.googleusercontent\.com$/);
  });
});
