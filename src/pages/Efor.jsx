import { useEffect, useMemo, useState } from 'react'
import { supabase, haftaBasi, isoDate } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const GUN_ADLARI = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

export default function Efor() {
  const { profile } = useAuth()
  const [hafta, setHafta] = useState(haftaBasi())
  const [mod, setMod] = useState('haftalik') // haftalik | gunluk
  const [projeler, setProjeler] = useState([])
  const [kayitlar, setKayitlar] = useState([])
  const [taslak, setTaslak] = useState({}) // { "projeId" | "projeId|gun" : "saat" }
  const [msg, setMsg] = useState(null)

  const haftaStr = isoDate(hafta)
  const gunler = useMemo(
    () => Array.from({ length: 7 }, (_, i) => { const d = new Date(hafta); d.setDate(d.getDate() + i); return d }),
    [hafta]
  )

  useEffect(() => { yukle() }, [haftaStr])

  async function yukle() {
    const [{ data: atamalar }, { data: entries }] = await Promise.all([
      supabase.from('project_assignments')
        .select('projects ( id, ad, customers ( ad, hubs ( renk ) ) )')
        .eq('user_id', profile.id),
      supabase.from('effort_entries').select('*')
        .eq('user_id', profile.id).eq('hafta_baslangici', haftaStr)
    ])
    setProjeler((atamalar || []).map(a => a.projects).filter(Boolean).sort((a, b) => a.ad.localeCompare(b.ad, 'tr')))
    setKayitlar(entries || [])
    setTaslak({})
    setMsg(null)
  }

  function mevcut(projeId, gun = null) {
    const e = kayitlar.find(k => k.project_id === projeId && (gun ? k.gun === gun : k.gun === null))
    return e ? String(e.saat) : ''
  }

  function deger(projeId, gun = null) {
    const key = gun ? projeId + '|' + gun : projeId
    return key in taslak ? taslak[key] : mevcut(projeId, gun)
  }

  function setDeger(projeId, gun, v) {
    const key = gun ? projeId + '|' + gun : projeId
    setTaslak(t => ({ ...t, [key]: v }))
  }

  async function hucreyiKaydet(projeId, gun = null) {
    const key = gun ? projeId + '|' + gun : projeId
    if (!(key in taslak)) return
    const v = parseFloat(String(taslak[key]).replace(',', '.'))
    const eski = kayitlar.find(k => k.project_id === projeId && (gun ? k.gun === gun : k.gun === null))

    let error = null
    if (!v || v <= 0) {
      if (eski) ({ error } = await supabase.from('effort_entries').delete().eq('id', eski.id))
    } else if (eski) {
      ({ error } = await supabase.from('effort_entries').update({ saat: v }).eq('id', eski.id))
    } else {
      ({ error } = await supabase.from('effort_entries').insert({
        user_id: profile.id, project_id: projeId, hafta_baslangici: haftaStr, gun, saat: v
      }))
    }
    if (error) { setMsg({ tip: 'err', metin: 'Kaydedilemedi: ' + error.message }); return }
    setMsg({ tip: 'ok', metin: 'Kaydedildi' })
    const { data } = await supabase.from('effort_entries').select('*')
      .eq('user_id', profile.id).eq('hafta_baslangici', haftaStr)
    setKayitlar(data || [])
    setTaslak(t => { const c = { ...t }; delete c[key]; return c })
  }

  function haftaKaydir(n) {
    const d = new Date(hafta); d.setDate(d.getDate() + 7 * n); setHafta(d)
  }

  const projeToplam = pid => kayitlar.filter(k => k.project_id === pid).reduce((s, k) => s + Number(k.saat), 0)
  const haftaToplam = kayitlar.reduce((s, k) => s + Number(k.saat), 0)
  const sonGun = new Date(gunler[6])

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Efor girişi</h1>
          <p>Saat cinsinden girin. Haftalık toplam yeterli; isterseniz günlük detaya geçebilirsiniz.</p>
        </div>
        <div className="week-nav">
          <button className="btn ghost sm" onClick={() => haftaKaydir(-1)}>←</button>
          <span className="label">
            {hafta.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })} – {sonGun.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
          <button className="btn ghost sm" onClick={() => haftaKaydir(1)}>→</button>
        </div>
      </div>

      <div className="filters">
        <button className={'filter-chip' + (mod === 'haftalik' ? ' active' : '')} onClick={() => setMod('haftalik')}>Haftalık</button>
        <button className={'filter-chip' + (mod === 'gunluk' ? ' active' : '')} onClick={() => setMod('gunluk')}>Günlük detay</button>
        <span className="chip" style={{ marginLeft: 'auto' }}>Hafta toplamı: {haftaToplam} saat</span>
      </div>

      {projeler.length === 0 ? (
        <div className="empty">
          <strong>Atandığınız proje yok</strong>
          Efor girebilmeniz için hub yöneticinizin sizi bir projeye ataması gerekiyor.
        </div>
      ) : (
        <div className="card efor-grid" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Proje</th>
                {mod === 'haftalik'
                  ? <th>Saat</th>
                  : gunler.slice(0, 5).map((g, i) => (
                      <th key={i}>{GUN_ADLARI[i]} {g.getDate()}</th>
                    ))}
                <th>Toplam</th>
              </tr>
            </thead>
            <tbody>
              {projeler.map(p => (
                <tr key={p.id}>
                  <td>
                    <span className="hub-dot" style={{ background: p.customers.hubs.renk, marginRight: 7 }} />
                    <span style={{ fontWeight: 500 }}>{p.ad}</span>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginLeft: 15 }}>{p.customers.ad}</div>
                  </td>
                  {mod === 'haftalik' ? (
                    <td>
                      <input inputMode="decimal" placeholder="0"
                        value={deger(p.id)}
                        onChange={e => setDeger(p.id, null, e.target.value)}
                        onBlur={() => hucreyiKaydet(p.id)} />
                    </td>
                  ) : gunler.slice(0, 5).map((g, i) => {
                    const gs = isoDate(g)
                    return (
                      <td key={i}>
                        <input inputMode="decimal" placeholder="0"
                          value={deger(p.id, gs)}
                          onChange={e => setDeger(p.id, gs, e.target.value)}
                          onBlur={() => hucreyiKaydet(p.id, gs)} />
                      </td>
                    )
                  })}
                  <td style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{projeToplam(p.id) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {msg && <div className={'msg ' + (msg.tip === 'err' ? 'err' : 'ok')}>{msg.metin}</div>}
      {mod === 'gunluk' && (
        <p style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
          Not: Haftalık ve günlük girişler ayrı kayıtlardır; aynı proje için ikisini birden doldurursanız toplama ikisi de dahil olur.
        </p>
      )}
    </>
  )
}
