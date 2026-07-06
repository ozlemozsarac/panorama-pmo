import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, haftaBasi, isoDate, fmtTarih } from '../lib/supabase'

export default function GmOzeti() {
  const [d, setD] = useState(null)

  useEffect(() => { yukle() }, [])

  async function yukle() {
    const haftaStr = isoDate(haftaBasi())
    const bugun = isoDate(new Date())
    const [hubs, customers, projects, profiles, tasks, effort, leaves] = await Promise.all([
      supabase.from('hubs').select('*').order('sira'),
      supabase.from('customers').select('id, hub_id'),
      supabase.from('projects').select('id, ad, aktif, customers ( hub_id, ad )').eq('aktif', true),
      supabase.from('profiles').select('id, ad, hub_id, aktif, yetki_rolu, job_titles ( ad )').eq('aktif', true),
      supabase.from('tasks').select('id, project_id, durum, blokaj, kritik, termin, waiting_reasons ( ad ), projects ( ad, customers ( hub_id ) )'),
      supabase.from('effort_entries').select('user_id, project_id, saat').eq('hafta_baslangici', haftaStr),
      supabase.from('leaves').select('user_id, baslangic, bitis, profiles ( ad )').lte('baslangic', bugun).gte('bitis', bugun)
    ])
    setD({
      hubs: hubs.data || [], customers: customers.data || [], projects: projects.data || [],
      profiles: profiles.data || [], tasks: tasks.data || [], effort: effort.data || [], leaves: leaves.data || []
    })
  }

  if (!d) return <p>Yükleniyor…</p>

  const acik = d.tasks.filter(t => t.durum !== 'tamamlandi')
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0)
  const geciken = acik.filter(t => t.termin && new Date(t.termin) < bugun)
  const eforSaat = d.effort.reduce((s, e) => s + Number(e.saat), 0)
  const eforGiren = new Set(d.effort.map(e => e.user_id)).size
  const eforBekleyen = d.profiles.filter(p => !['gm', 'direktor'].includes(p.yetki_rolu)).length - eforGiren

  const hubSatir = h => {
    const m = d.customers.filter(c => c.hub_id === h.id).length
    const p = d.projects.filter(pr => pr.customers?.hub_id === h.id).length
    const k = d.profiles.filter(pr => pr.hub_id === h.id).length
    return { m, p, k }
  }

  const beklemeNedenleri = {}
  acik.filter(t => t.durum === 'beklemede' && t.waiting_reasons).forEach(t => {
    beklemeNedenleri[t.waiting_reasons.ad] = (beklemeNedenleri[t.waiting_reasons.ad] || 0) + 1
  })

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Özet</h1>
          <p>Yapısal görünüm her zaman güncel; akış metrikleri ekip girdikçe dolar.</p>
        </div>
      </div>

      <h2>Yapı</h2>
      <div className="card" style={{ padding: 0, marginBottom: 22 }}>
        <table>
          <thead>
            <tr><th>Hub</th><th>Müşteri</th><th>Proje</th><th>Kişi</th></tr>
          </thead>
          <tbody>
            {d.hubs.map(h => {
              const s = hubSatir(h)
              return (
                <tr key={h.id}>
                  <td><span className="hub-dot" style={{ background: h.renk, marginRight: 7 }} /><strong>{h.ad}</strong></td>
                  <td>{s.m}</td><td>{s.p}</td><td>{s.k}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h2>Bu hafta</h2>
      <div className="grid grid-4" style={{ marginBottom: 22 }}>
        <div className="card kpi">
          <div className="num">{eforSaat || '—'}</div>
          <div className="lbl">Girilen efor (saat)</div>
          {eforSaat === 0 && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>Veri toplanıyor</div>}
        </div>
        <div className="card kpi">
          <div className="num">{eforGiren}<span style={{ fontSize: 15, color: 'var(--ink-3)' }}> / {eforGiren + eforBekleyen}</span></div>
          <div className="lbl">Efor giren kişi</div>
        </div>
        <div className="card kpi">
          <div className="num" style={{ color: acik.filter(t => t.blokaj).length ? 'var(--danger)' : undefined }}>
            {acik.filter(t => t.blokaj).length}
          </div>
          <div className="lbl">Bloklu iş</div>
        </div>
        <div className="card kpi">
          <div className="num" style={{ color: geciken.length ? 'var(--warn)' : undefined }}>{geciken.length}</div>
          <div className="lbl">Termini geçen iş</div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
        <div className="card">
          <h2>Bloklu ve kritik radar</h2>
          {acik.filter(t => t.blokaj || t.kritik).length === 0 ? (
            <div className="empty"><strong>Radar temiz</strong>Bloklu veya kritik iş bulunmuyor.</div>
          ) : (
            <table>
              <tbody>
                {acik.filter(t => t.blokaj || t.kritik).slice(0, 8).map(t => (
                  <tr key={t.id}>
                    <td>
                      <Link to={'/projeler/' + t.project_id}>{t.projects?.ad}</Link>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{t.termin ? 'Termin: ' + fmtTarih(t.termin) : ''}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {t.blokaj && <span className="chip danger">Blokaj</span>}{' '}
                      {t.kritik && <span className="chip warn">Kritik</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>Bekleyen işler neden bekliyor?</h2>
          {Object.keys(beklemeNedenleri).length === 0 ? (
            <div className="empty"><strong>Bekleyen iş yok</strong>Beklemede işaretlenen işler nedenleriyle burada kırılır.</div>
          ) : (
            <table>
              <tbody>
                {Object.entries(beklemeNedenleri).sort((a, b) => b[1] - a[1]).map(([n, c]) => (
                  <tr key={n}><td>{n}</td><td style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>{c}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          <h2 style={{ marginTop: 18 }}>Bugün izinde</h2>
          {d.leaves.length === 0
            ? <p style={{ color: 'var(--ink-3)', fontSize: 14 }}>Bugün izinde olan yok.</p>
            : <p style={{ fontSize: 14 }}>{d.leaves.map(l => l.profiles?.ad).filter(Boolean).join(', ')}</p>}
        </div>
      </div>
    </>
  )
}
