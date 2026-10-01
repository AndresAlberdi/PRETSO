import { describe, it, expect } from 'vitest';
import { assertFirebaseConfig, faltantesDeConfig } from '../utils/firebaseConfig';

const complete = {
  projectId: 'p',
  authDomain: 'p.firebaseapp.com',
  apiKey: 'k',
  appId: 'a',
};

describe('faltantesDeConfig', () => {
  it('returns an empty list for a complete config', () => {
    expect(faltantesDeConfig(complete)).toEqual([]);
  });

  it('lists empty fields', () => {
    expect(faltantesDeConfig({ ...complete, apiKey: '', appId: '' })).toEqual(['apiKey', 'appId']);
  });

  it('treats whitespace-only fields as missing', () => {
    expect(faltantesDeConfig({ ...complete, projectId: '   ' })).toEqual(['projectId']);
  });
});

describe('assertFirebaseConfig', () => {
  it('does not throw for a complete config', () => {
    expect(() => assertFirebaseConfig(complete, 'staging')).not.toThrow();
  });

  it('throws naming the missing fields and the environment', () => {
    expect(() => assertFirebaseConfig({ ...complete, apiKey: '', appId: ' ' }, 'production')).toThrow(
      /«production».*apiKey, appId/,
    );
  });
});
