// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { generarReadmePdf } from '../../utils/dataset/readme';
import type { ResumenDataset } from '../../utils/dataset/tipos';

describe('generarReadmePdf', () => {
  it('produce un PDF real (empieza con %PDF- y pesa más de 1 KB)', async () => {
    const resumen: ResumenDataset = {
      generadoEn: new Date('2026-11-22T23:50:00Z'),
      carpetas: [
        { carpeta: 'caja', archivos: 2, registros: 3, unidadesSinRegistros: 1 },
        { carpeta: 'remuneraciones', archivos: 1, registros: 2, unidadesSinRegistros: 0 },
        { carpeta: 'corpus', archivos: 1, registros: 1, unidadesSinRegistros: 0 },
        { carpeta: 'companias', archivos: 1, registros: 4, unidadesSinRegistros: 0 },
        { carpeta: 'transacciones', archivos: 1, registros: 5, unidadesSinRegistros: 0 },
        { carpeta: 'bibliografia', archivos: 1, registros: 6, unidadesSinRegistros: 0 },
      ],
      avisos: { transaccionesNoEncontradas: 0, documentosNoEncontrados: 1, registrosSinUnidad: 0 },
    };
    const pdf = await generarReadmePdf(resumen);
    expect(pdf).toBeInstanceOf(Uint8Array);
    expect(pdf.length).toBeGreaterThan(1024);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
  }, 30000);
});
