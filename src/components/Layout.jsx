import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLLER } from '../lib/supabase'

export default function Layout({ children }) {
  const { profile, seesAll, isAdmin, signOut } = useAuth()
  const [dark, setDark] = useState(false) // oturum-içi tema (kalıcı değil)

  // Geist fontunu bir kez yükle (index.html'e dokunmadan)
  useEffect(() => {
    const id = 'geist-font-link'
    if (!document.getElementById(id)) {
      const l = document.createElement('link')
      l.id = id
      l.rel = 'stylesheet'
      l.href = 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap'
      document.head.appendChild(l)
    }
  }, [])

  // Tema durumunu <html data-theme="..."> olarak uygula (tüm uygulama)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])

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

        {seesAll && item('/ozet', 'Genel Bakış')}
        {item('/projeler', 'Projeler')}
        {item('/efor', 'Efor Özet')}
        {item('/izin', 'İzin')}
        {item('/ekip', 'Ekip şeması')}
        {(seesAll || profile.yetki_rolu === 'hub_yon') && item('/atama-raporu', 'Atama raporu')}
        {isAdmin && item('/admin', 'Yönetim')}

        <button className="theme-toggle" style={{ marginTop: 'auto' }} onClick={() => setDark(d => !d)}>
          {dark ? '☀ Açık tema' : '☾ Koyu tema'}
        </button>

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
