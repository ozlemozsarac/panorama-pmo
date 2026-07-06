import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Projelerim from './pages/Projelerim'
import ProjeDetay from './pages/ProjeDetay'
import Efor from './pages/Efor'
import Izin from './pages/Izin'
import GmOzeti from './pages/GmOzeti'
import EkipSemasi from './pages/EkipSemasi'
import Admin from './pages/Admin'

export default function App() {
  const { session, profile, seesAll, isAdmin } = useAuth()

  if (session === undefined) return null
  if (!session) return <Login />
  if (!profile) return <div style={{ padding: 40 }}>Profil yükleniyor…</div>

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to={seesAll ? '/ozet' : '/projeler'} replace />} />
        <Route path="/projeler" element={<Projelerim />} />
        <Route path="/projeler/:id" element={<ProjeDetay />} />
        <Route path="/efor" element={<Efor />} />
        <Route path="/izin" element={<Izin />} />
        <Route path="/ekip" element={<EkipSemasi />} />
        {seesAll && <Route path="/ozet" element={<GmOzeti />} />}
        {isAdmin && <Route path="/admin" element={<Admin />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
