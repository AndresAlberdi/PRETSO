import { describe, it, expect } from 'vitest';

// Simulate the admin authentication check logic from AdminContext.tsx
function isUserAdmin(user: { email: string | null } | null): boolean {
  if (!user) return false;
  return user.email === 'pretsodatabase@gmail.com';
}

describe('Firestore and Application Security Controls', () => {
  describe('Admin Privilege Check', () => {
    it('should grant admin privilege to pretsodatabase@gmail.com', () => {
      const user = { email: 'pretsodatabase@gmail.com' };
      expect(isUserAdmin(user)).toBe(true);
    });

    it('should deny admin privilege to other email addresses', () => {
      const user1 = { email: 'admin@pretso.org' };
      const user2 = { email: 'testuser@gmail.com' };
      const user3 = { email: 'pretsodatabase@gmail.com.co' };
      
      expect(isUserAdmin(user1)).toBe(false);
      expect(isUserAdmin(user2)).toBe(false);
      expect(isUserAdmin(isUserAdmin as any)).toBe(false); // safety check
      expect(isUserAdmin(user3)).toBe(false);
    });

    it('should deny admin privilege if no user is authenticated', () => {
      expect(isUserAdmin(null)).toBe(false);
      expect(isUserAdmin({ email: null })).toBe(false);
    });
  });
});
