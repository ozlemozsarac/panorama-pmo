import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLLER } from '../lib/supabase'

export default function Layout({ children }) {
  const { profile, seesAll, isAdmin, signOut } = useAuth()

  const item = (to, label) => (
    <NavLink to={to} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
      {label}
    </NavLink>
  )

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">Panorama PMO</div>
        <div className="logo-bar">
          <span style={{ background: '#38BDF8' }} />
          <span style={{ background: '#34D399' }} />
          <span style={{ background: '#FB923C' }} />
        </div>
        {seesAll && item('/ozet', 'Özet')}
        {item('/projeler', 'Projeler')}
        {item('/efor', 'Efor Özet')}
        {item('/izin', 'İzin')}
        {item('/ekip', 'Ekip şeması')}
        {isAdmin && item('/admin', 'Yönetim')}
        <div className="sidebar-footer">
          <div className="name">{profile.ad || profile.eposta}</div>
          <div className="role">
            {ROLLER[profile.yetki_rolu]}{profile.hubs ? ' · ' + profile.hubs.ad : ''}
          </div>
          <button onClick={signOut}>Çıkış yap</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  )
}
