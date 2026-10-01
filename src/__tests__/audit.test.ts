import { describe, it, expect, vi, beforeEach } from 'vitest';

const addDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
  addDoc: (...args: unknown[]) => addDoc(...args),
  collection: (_db: unknown, name: string) => ({ name }),
  serverTimestamp: () => 'TS',
}));
const authMock = vi.hoisted(() => ({ currentUser: null as { email: string } | null }));
vi.mock('../firebase', () => ({ auth: authMock, db: {} }));

import { logAction } from '../utils/audit';

beforeEach(() => addDoc.mockReset());

describe('logAction', () => {
  it('toma el autor del correo de la sesión actual', async () => {
    authMock.currentUser = { email: 'persona@example.com' };
    await logAction('CREATE', 'companias', 'x1');
    expect(addDoc.mock.calls[0][1]).toMatchObject({ user: 'persona@example.com', recordId: 'x1' });
  });

  it("usa 'desconocido' sin sesión", async () => {
    authMock.currentUser = null;
    await logAction('DELETE', 'companias', 'x2');
    expect(addDoc.mock.calls[0][1]).toMatchObject({ user: 'desconocido' });
  });

  it('escribe exactamente los campos que validan las reglas', async () => {
    authMock.currentUser = { email: 'persona@example.com' };
    await logAction('EDIT', 'companias', 'x3');
    const payload = addDoc.mock.calls[0][1];
    expect(Object.keys(payload).sort()).toEqual(['action', 'collection', 'details', 'recordId', 'timestamp', 'user']);
    expect(payload.timestamp).toBe('TS');
    expect(payload.details).toBeNull();
  });
});
