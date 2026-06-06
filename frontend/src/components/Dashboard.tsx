import { useEffect, useState } from 'react'
import { api } from '../api/client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'

interface StatsData {
  cities: { name: string, value: number }[]
  years: { name: string, value: number }[]
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF19A3']

export default function Dashboard() {
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<StatsData>('/search/stats')
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p>Cargando estadísticas...</p>
  if (!data) return <p>Error al cargar estadísticas.</p>

  return (
    <div style={{ marginTop: '3rem', padding: '1.5rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px' }}>
      <h3 style={{ marginBottom: '2rem', textAlign: 'center' }}>Estadísticas del Corpus Publicado</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
        
        {/* Gráfico de Años */}
        <div style={{ flex: '1 1 400px', height: 300 }}>
          <h4 style={{ textAlign: 'center', marginBottom: '1rem' }}>Registros por Año</h4>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.years}>
              <XAxis dataKey="name" stroke="#ccc" />
              <YAxis stroke="#ccc" />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.1)' }} contentStyle={{ backgroundColor: '#222', border: 'none', borderRadius: '8px' }} />
              <Bar dataKey="value" fill="var(--primary-color, #ffaa00)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico de Ciudades */}
        <div style={{ flex: '1 1 300px', height: 300 }}>
          <h4 style={{ textAlign: 'center', marginBottom: '1rem' }}>Registros por Ciudad</h4>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.cities}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {data.cities.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#222', border: 'none', borderRadius: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  )
}
