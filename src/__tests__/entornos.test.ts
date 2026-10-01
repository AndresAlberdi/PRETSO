import { describe, it, expect } from 'vitest';
import { firebaseConfig as staging } from '../environments/staging/firebase';
import { firebaseConfig as production } from '../environments/production/firebase';
import { googleClientId as productionClientId } from '../environments/production/google';
import { assertFirebaseConfig, assertPublishable } from '../utils/firebaseConfig';

describe('environment configs', () => {
  it('staging points to pretso-database', () => {
    expect(staging.projectId).toBe('pretso-database');
  });

  it('production points to pretso-prod', () => {
    expect(production.projectId).toBe('pretso-prod');
    expect(production.authDomain).toBe('pretso-prod.firebaseapp.com');
  });

  it('does not mix project ids between environments', () => {
    expect(JSON.stringify(production)).not.toContain('pretso-database');
    expect(JSON.stringify(staging)).not.toContain('pretso-prod');
  });

  it('staging config is complete', () => {
    expect(() => assertFirebaseConfig(staging, 'staging')).not.toThrow();
  });

  it('production config is complete', () => {
    expect(() => assertFirebaseConfig(production, 'production')).not.toThrow();
  });

  // Este test se invierte cuando se cree el cliente OAuth de producción (paso 3 del plan, parte manual).
  it('production has no Google Client ID until its OAuth client is created', () => {
    expect(productionClientId).toBe('');
  });
});

describe('publishing gate', () => {
  // Configuración incompleta sintética: la de producción ya está completa desde el paso 3.
  const incomplete = { ...production, apiKey: '', appId: '' };

  it('blocks a production build of a tag while the config is incomplete', () => {
    expect(() => assertPublishable('production', 'tag', incomplete)).toThrow(/apiKey, appId/);
  });

  it('blocks a manual workflow_dispatch even when the ref is a branch', () => {
    expect(() => assertPublishable('production', 'branch', incomplete, 'workflow_dispatch')).toThrow(/apiKey, appId/);
  });

  it('lets PR and branch builds of production compile even if incomplete', () => {
    expect(() => assertPublishable('production', 'branch', incomplete)).not.toThrow();
    expect(() => assertPublishable('production', undefined, incomplete)).not.toThrow();
    expect(() => assertPublishable('production', 'branch', incomplete, 'push')).not.toThrow();
    expect(() => assertPublishable('production', 'branch', incomplete, 'pull_request')).not.toThrow();
  });

  it('never blocks the staging build, not even for a tag', () => {
    expect(() => assertPublishable('staging', 'tag', incomplete)).not.toThrow();
    expect(() => assertPublishable('staging', 'branch', incomplete, 'workflow_dispatch')).not.toThrow();
  });

  it('does not block a tag or a dispatch once the production config is complete', () => {
    expect(() => assertPublishable('production', 'tag', production)).not.toThrow();
    expect(() => assertPublishable('production', 'branch', production, 'workflow_dispatch')).not.toThrow();
  });
});
