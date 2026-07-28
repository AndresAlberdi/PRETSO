import { describe, it, expect } from 'vitest';
import { cleanFirebaseData } from '../utils';

describe('utils: cleanFirebaseData', () => {
  it('should extract the id from the Firebase document snapshot and append it to the data', () => {
    // Mock for a Firebase QueryDocumentSnapshot
    const mockDoc = {
      id: 'doc-12345',
      data: () => ({
        Nombre: 'Gonzalo',
        Ciudad: 'Toledo'
      })
    };

    const result = cleanFirebaseData(mockDoc as any);
    
    expect(result).toHaveProperty('id', 'doc-12345');
    expect(result).toHaveProperty('Nombre', 'Gonzalo');
    expect(result).toHaveProperty('Ciudad', 'Toledo');
  });

  it('should handle documents with empty or missing data fields', () => {
    const mockDoc = {
      id: 'doc-67890',
      data: () => ({})
    };

    const result = cleanFirebaseData(mockDoc as any);
    
    expect(result).toHaveProperty('id', 'doc-67890');
    expect(Object.keys(result).length).toBe(1);
  });
});
