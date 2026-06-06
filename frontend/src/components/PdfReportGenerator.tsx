import { useState } from 'react'
import { api } from '../api/client'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function PdfReportGenerator() {
  const [generating, setGenerating] = useState(false)

  const generatePDF = async () => {
    setGenerating(true)
    try {
      const res = await api.get('/search/stats')
      const { cities, years } = res.data

      const doc = new jsPDF()

      // Header
      doc.setFontSize(22)
      doc.setTextColor(40, 40, 40)
      doc.text('Reporte Analítico - PRETSO', 14, 22)
      
      doc.setFontSize(11)
      doc.setTextColor(100, 100, 100)
      doc.text(`Generado el: ${new Date().toLocaleDateString()} a las ${new Date().toLocaleTimeString()}`, 14, 30)
      
      doc.setLineWidth(0.5)
      doc.line(14, 34, 196, 34)

      // Section: Ciudades
      doc.setFontSize(14)
      doc.setTextColor(0, 0, 0)
      doc.text('Distribución por Ciudad', 14, 45)

      const cityData = cities.map((c: any) => [c.name, c.value])
      
      autoTable(doc, {
        startY: 50,
        head: [['Ciudad', 'Documentos Publicados']],
        body: cityData,
        theme: 'striped',
        headStyles: { fillColor: [46, 125, 50] },
      })

      // Section: Años
      const finalY = (doc as any).lastAutoTable.finalY || 50
      
      doc.setFontSize(14)
      doc.text('Distribución por Año', 14, finalY + 15)
      
      const yearData = years.map((y: any) => [y.name, y.value])

      autoTable(doc, {
        startY: finalY + 20,
        head: [['Año', 'Documentos Publicados']],
        body: yearData,
        theme: 'striped',
        headStyles: { fillColor: [21, 101, 192] },
      })

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages()
      doc.setFontSize(10)
      doc.setTextColor(150, 150, 150)
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.text(`Página ${i} de ${pageCount}`, 196 / 2, 285, { align: 'center' })
      }

      // Download
      doc.save('reporte_pretso.pdf')

    } catch (e) {
      alert('Error al generar el PDF. Verifica tu conexión.')
      console.error(e)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <button
      onClick={generatePDF}
      disabled={generating}
      style={{
        padding: '0.6rem 1.2rem',
        background: '#1976d2',
        color: 'white',
        border: 'none',
        borderRadius: 6,
        cursor: generating ? 'not-allowed' : 'pointer',
        fontWeight: 'bold',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}
    >
      {generating ? 'Generando PDF...' : '📄 Descargar Reporte en PDF'}
    </button>
  )
}
