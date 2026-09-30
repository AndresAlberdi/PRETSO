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

  // Los dos tests siguientes se invierten en el paso 3 del plan, cuando se completen apiKey, appId y el
  // Client ID de producción.
  it('production is not publishable until step 3 fills apiKey and appId', () => {
    expect(() => assertFirebaseConfig(production, 'production')).toThrow(/apiKey, appId/);
  });

  it('production has no Google Client ID until step 3', () => {
    expect(productionClientId).toBe('');
  });
});

describe('publishing gate', () => {
  it('blocks a production build of a tag while the config is incomplete', () => {
    expect(() => assertPublishable('production', 'tag', production)).toThrow(/apiKey, appId/);
  });

  it('blocks a manual workflow_dispatch even when the ref is a branch', () => {
    expect(() => assertPublishable('production', 'branch', production, 'workflow_dispatch')).toThrow(/apiKey, appId/);
  });

  it('lets PR and branch builds of production compile', () => {
    expect(() => assertPublishable('production', 'branch', production)).not.toThrow();
    expect(() => assertPublishable('production', undefined, production)).not.toThrow();
    expect(() => assertPublishable('production', 'branch', production, 'push')).not.toThrow();
    expect(() => assertPublishable('production', 'branch', production, 'pull_request')).not.toThrow();
  });

  it('never blocks the staging build, not even for a tag', () => {
    expect(() => assertPublishable('staging', 'tag', production)).not.toThrow();
    expect(() => assertPublishable('staging', 'branch', production, 'workflow_dispatch')).not.toThrow();
  });
});
