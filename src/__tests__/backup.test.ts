import { describe, it, expect } from 'vitest';
import { translateField, escapeXml, COLLECTION_ELEMENT_MAP } from '../utils/backup';

describe('XML Backup Utilities', () => {
  describe('translateField', () => {
    it('should map Spanish fields to English correctly using translations map', () => {
      expect(translateField('documentos', 'Doc')).toBe('doc_id');
      expect(translateField('documentos', 'Documento')).toBe('document_text');
      expect(translateField('companias', 'Sigla Compañía')).toBe('company_code');
      expect(translateField('transacciones', 'Noticia')).toBe('transaction_news');
    });

    it('should fallback to clean ASCII snake_case when no mapping is found', () => {
      expect(translateField('any_collection', 'Campaña especial')).toBe('campana_especial');
      expect(translateField('any_collection', 'Valor de ración diario')).toBe('valor_de_racion_diario');
      expect(translateField('any_collection', 'Año del Corpus')).toBe('ano_del_corpus');
    });
  });

  describe('escapeXml', () => {
    it('should escape dangerous XML characters', () => {
      expect(escapeXml('hello <world> & "friends"')).toBe('hello &lt;world&gt; &amp; &quot;friends&quot;');
      expect(escapeXml("admin's query")).toBe('admin&apos;s query');
    });

    it('should return empty string for null and undefined', () => {
      expect(escapeXml(null)).toBe('');
      expect(escapeXml(undefined)).toBe('');
    });

    it('should convert numbers and booleans to string safely', () => {
      expect(escapeXml(123)).toBe('123');
      expect(escapeXml(true)).toBe('true');
    });
  });

  describe('COLLECTION_ELEMENT_MAP', () => {
    it('should map all 8 target collections correctly', () => {
      const collections = [
        'documentos',
        'companias',
        'transacciones',
        'manejo_de_caja',
        'salarios',
        'corpus_christi',
        'indicadores',
        'bibliografia'
      ];
      collections.forEach(coll => {
        expect(COLLECTION_ELEMENT_MAP[coll]).toBeDefined();
        expect(COLLECTION_ELEMENT_MAP[coll].root).toBeTypeOf('string');
        expect(COLLECTION_ELEMENT_MAP[coll].item).toBeTypeOf('string');
      });
    });
  });
});
