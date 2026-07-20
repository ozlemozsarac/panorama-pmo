import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLLER } from '../lib/supabase'

export default function Layout({ children }) {
  const { profile, seesAll, isAdmin, kisitliGorunum, signOut } = useAuth()
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

        {kisitliGorunum ? (
          item('/projeler', 'Projeler')
        ) : (
          <>
            {seesAll && item('/ozet', 'Genel Bakış')}
            {item('/projeler', 'Projeler')}
            {item('/efor', 'Efor Özet')}
            {item('/izin', 'İzin')}
            {item('/ekip', 'Ekip şeması')}
            {(seesAll || profile.yetki_rolu === 'hub_yon') && item('/atama-raporu', 'Atama raporu')}
            {isAdmin && item('/admin', 'Yönetim')}
          </>
        )}

        <div className="sidebar-footer">
          <div className="name">{profile.ad || profile.eposta}</div>
          <div className="role">
            {ROLLER[profile.yetki_rolu]}{profile.hubs ? ' · ' + profile.hubs.ad : ''}
          </div>
          <div className="footer-actions">
            <button onClick={signOut}>Çıkış yap</button>
            <button
              className="theme-toggle"
              onClick={() => setDark(d => !d)}
              title={dark ? 'Açık temaya geç' : 'Koyu temaya geç'}
              aria-label={dark ? 'Açık temaya geç' : 'Koyu temaya geç'}
            >
              {dark ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  )
}
