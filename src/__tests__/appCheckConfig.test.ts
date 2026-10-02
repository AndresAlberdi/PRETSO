import { describe, it, expect } from 'vitest';
import {
  isValidRecaptchaSiteKey,
  resolveDebugToken,
  assertNoDebugTokenOutsideDevelopment,
  assertAppCheckPublishable,
} from '../utils/appCheckConfig';
import { recaptchaSiteKey as stagingKey } from '../environments/staging/firebase';

describe('isValidRecaptchaSiteKey', () => {
  it('accepts the staging key', () => {
    expect(isValidRecaptchaSiteKey(stagingKey)).toBe(true);
  });

  it.each([
    ['empty', ''],
    ['undefined', undefined],
    ['39 characters', '6L' + 'a'.repeat(37)],
    ['41 characters', '6L' + 'a'.repeat(39)],
    ['inner space', '6L' + 'a'.repeat(18) + ' ' + 'a'.repeat(19)],
    ['Firebase API key prefix', 'AIza' + 'a'.repeat(36)],
  ])('rejects %s', (_name, value) => {
    expect(isValidRecaptchaSiteKey(value)).toBe(false);
  });
});

describe('resolveDebugToken', () => {
  it('trims the value in development', () => {
    expect(resolveDebugToken({ MODE: 'development', DEV: true, VITE_APPCHECK_DEBUG_TOKEN: ' abc ' })).toBe('abc');
  });

  it('returns undefined for empty or blank values', () => {
    expect(resolveDebugToken({ MODE: 'development', DEV: true, VITE_APPCHECK_DEBUG_TOKEN: '' })).toBeUndefined();
    expect(resolveDebugToken({ MODE: 'development', DEV: true, VITE_APPCHECK_DEBUG_TOKEN: '   ' })).toBeUndefined();
  });

  it('returns undefined when DEV is false, whatever the mode', () => {
    for (const MODE of ['development', 'staging', 'production']) {
      expect(resolveDebugToken({ MODE, DEV: false, VITE_APPCHECK_DEBUG_TOKEN: 'abc' })).toBeUndefined();
    }
  });

  it('returns undefined in test mode even with DEV true', () => {
    expect(resolveDebugToken({ MODE: 'test', DEV: true, VITE_APPCHECK_DEBUG_TOKEN: 'abc' })).toBeUndefined();
  });
});

describe('assertNoDebugTokenOutsideDevelopment', () => {
  it('does not throw when allowed', () => {
    expect(() => assertNoDebugTokenOutsideDevelopment('development', 'x')).not.toThrow();
    expect(() => assertNoDebugTokenOutsideDevelopment('production', undefined)).not.toThrow();
    expect(() => assertNoDebugTokenOutsideDevelopment('production', '  ')).not.toThrow();
  });

  it('throws outside development when the variable has a value', () => {
    for (const mode of ['staging', 'production', 'test']) {
      expect(() => assertNoDebugTokenOutsideDevelopment(mode, 'x')).toThrow(/VITE_APPCHECK_DEBUG_TOKEN/);
    }
  });
});

describe('assertAppCheckPublishable', () => {
  it('blocks a tag and a dispatch of production with an empty key', () => {
    expect(() => assertAppCheckPublishable('production', 'tag', '')).toThrow(/site key/);
    expect(() => assertAppCheckPublishable('production', 'branch', '', 'workflow_dispatch')).toThrow(/site key/);
  });

  it('lets push, PR, staging and a valid key pass', () => {
    expect(() => assertAppCheckPublishable('production', 'branch', '', 'push')).not.toThrow();
    expect(() => assertAppCheckPublishable('production', 'branch', '', 'pull_request')).not.toThrow();
    expect(() => assertAppCheckPublishable('staging', 'tag', '', 'workflow_dispatch')).not.toThrow();
    expect(() => assertAppCheckPublishable('production', 'tag', stagingKey)).not.toThrow();
  });
});
