import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [eposta, setEposta] = useState('')
  const [sifre, setSifre] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function girisYap(e) {
    e.preventDefault()
    setErr(''); setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: eposta, password: sifre })
    setBusy(false)
    if (error) setErr('Giriş yapılamadı. E-posta veya şifre hatalı.')
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div style={{ fontWeight: 600, fontSize: 20 }}>Panorama PMO</div>
        <div className="logo-bar" style={{ margin: '8px 0 22px' }}>
          <span style={{ background: '#38BDF8' }} />
          <span style={{ background: '#34D399' }} />
          <span style={{ background: '#FB923C' }} />
        </div>
        <form onSubmit={girisYap}>
          <div className="field">
            <label>E-posta</label>
            <input type="email" value={eposta} onChange={e => setEposta(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label>Şifre</label>
            <input type="password" value={sifre} onChange={e => setSifre(e.target.value)} required />
          </div>
          <button className="btn" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
          </button>
          {err && <div className="msg err">{err}</div>}
        </form>
        <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 16 }}>
          Hesabınız yoksa PMO yöneticinizden davet isteyin.
        </p>
      </div>
    </div>
  )
}
