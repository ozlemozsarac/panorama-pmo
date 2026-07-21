import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, haftaBasi, isoDate, parseISO, fmtTarih, urunChip, ceyrek, SAGLIK_SKORLARI, DURUMLAR } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import EforModal from '../components/EforModal'

export default function GmOzeti() {
  const { seesAll, isHubYon } = useAuth()
  const [gorunum, setGorunum] = useState('ozet')  // 'ozet' | 'islerim'
  // Yönetim (direktör/GM/hub yöneticisi) → toggle ile hem Genel Bakış hem İşlerim
  // Diğer herkes → doğrudan kişisel işler tezgahı
  const yonetim = seesAll || isHubYon
  if (!yonetim) return <Islerim />

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
        <div style={{ display: 'inline-flex', background: 'var(--paper)', borderRadius: 8, padding: 3 }}>
          {[['ozet', 'Genel Bakış'], ['islerim', 'İşlerim']].map(([v, l]) => (
            <button key={v} onClick={() => setGorunum(v)}
              style={{
                fontSize: 12.5, padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                border: gorunum === v ? '1px solid var(--line)' : '1px solid transparent',
                background: gorunum === v ? 'var(--card)' : 'transparent',
                color: gorunum === v ? 'var(--ink)' : 'var(--ink-3)'
              }}>{l}</button>
          ))}
        </div>
      </div>
      {gorunum === 'ozet' ? <YoneticiOzeti /> : <Islerim />}
    </>
  )
}

function YoneticiOzeti() {
  const { seesAll, profile } = useAuth()
  const [d, setD] = useState(null)
  const [hata, setHata] = useState('')

  useEffect(() => { yukle() }, [])

  async function yukle() {
    const haftaStr = isoDate(haftaBasi())
    const bugun = isoDate(new Date())
    const sonuclar = await Promise.all([
      supabase.from('hubs').select('*').order('sira'),
      supabase.from('customers').select('id, hub_id'),
      supabase.from('projects').select('id, ad, aktif, customers ( hub_id, ad )').eq('aktif', true),
      supabase.from('profiles').select('id, ad, hub_id, aktif, yetki_rolu, job_titles ( ad )').eq('aktif', true),
      supabase.from('tasks').select('id, project_id, durum, blokaj, kritik, bitis_tarihi, waiting_reasons ( ad ), projects ( ad, customers ( hub_id ) )'),
      supabase.from('effort_entries').select('user_id, project_id, saat').eq('hafta_baslangici', haftaStr),
      supabase.from('leaves').select('user_id, baslangic, bitis, profiles ( ad )').lte('baslangic', bugun).gte('bitis', bugun),
      supabase.from('project_health').select('project_id, kanal, skor, projects ( ad, aktif, customers ( hubs ( ad ) ) )').eq('donem', ceyrek())
    ])
    const ilkHata = sonuclar.find(r => r.error)
    if (ilkHata) { setHata('Veri yüklenemedi: ' + ilkHata.error.message); return }
    const [hubs, customers, projects, profiles, tasks, effort, leaves, health] = sonuclar
    setD({
      hubs: hubs.data || [], customers: customers.data || [], projects: projects.data || [],
      profiles: profiles.data || [], tasks: tasks.data || [], effort: effort.data || [], leaves: leaves.data || [],
      health: health.data || []
    })
  }

  if (hata) return <div className="card" style={{ borderLeft: '3px solid var(--danger)', color: 'var(--danger)', fontSize: 13.5 }}>{hata}</div>
  if (!d) return <p>Yükleniyor…</p>

  const acik = d.tasks.filter(t => t.durum !== 'tamamlandi')
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0)
  const geciken = acik.filter(t => t.bitis_tarihi && parseISO(t.bitis_tarihi) < bugun)
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

  // --- SAĞLIK KATMANI ---
  // Proje bazında kanalları topla → en kötü kanal + uyuşmazlık
  const projeSaglik = {}
  d.health.forEach(h => {
    if (!h.projects?.aktif) return
    if (!projeSaglik[h.project_id]) projeSaglik[h.project_id] = { ad: h.projects?.ad, hub: h.projects?.customers?.hubs?.ad, skorlar: [] }
    projeSaglik[h.project_id].skorlar.push(h.skor)
  })
  const saglikListe = Object.entries(projeSaglik).map(([pid, v]) => ({
    pid,
    ad: v.ad,
    hub: v.hub,
    enKotu: Math.min(...v.skorlar),
    uyusmazlik: v.skorlar.length >= 2 && (Math.max(...v.skorlar) - Math.min(...v.skorlar) >= 2)
  }))
  const dagilim = { 1: 0, 2: 0, 3: 0, 4: 0 }
  saglikListe.forEach(s => { dagilim[s.enKotu]++ })
  const dagilimMax = Math.max(1, ...Object.values(dagilim))
  const skorlananProje = saglikListe.length
  const skorsuzProje = d.projects.length - skorlananProje
  const uyusmazSayi = saglikListe.filter(s => s.uyusmazlik).length
  // Kriz + Gergin olan tüm projeler (en kötüden iyiye)
  const riskliListe = saglikListe.filter(s => s.enKotu <= 2).sort((a, b) => a.enKotu - b.enKotu)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Genel Bakış</h1>
          <p>Proje sağlığı ve akış · {seesAll ? "tüm hub'lar" : (profile.hubs?.ad || 'hub\'ınız')}</p>
        </div>
      </div>

      {/* SAĞLIK KATMANI — en üstte */}
      <h2>Proje sağlığı <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: 14 }}>· {ceyrek().replace('-Q', ' · ') + '. çeyrek'}</span></h2>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)', marginBottom: 14 }}>
        <div className="card">
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>Skor dağılımı ({skorlananProje} proje)</div>
          {skorlananProje === 0
            ? <p style={{ color: 'var(--ink-3)', fontSize: 14 }}>Bu çeyrek henüz skor girilmedi.</p>
            : [1, 2, 3, 4].map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 60, fontSize: 12.5, color: `var(--skor${s}-tx)` }}>{SAGLIK_SKORLARI[s].etiket}</div>
                <div style={{ flex: 1, background: 'var(--track, var(--line))', borderRadius: 3, height: 8, overflow: 'hidden' }}>
                  <div style={{ width: Math.round(dagilim[s] / dagilimMax * 100) + '%', height: '100%', background: `var(--skor${s}-tx)` }} />
                </div>
                <div style={{ width: 22, textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{dagilim[s]}</div>
              </div>
            ))}
        </div>
        <div className="card">
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>Dikkat gerektiren</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13 }}>Kriz + Gergin</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, fontWeight: 600, color: 'var(--danger)' }}>{dagilim[1] + dagilim[2]}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13 }}>Kanal uyuşmazlığı</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, fontWeight: 600, color: 'var(--warn)' }}>{uyusmazSayi}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13 }}>Skor girilmemiş</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, fontWeight: 600, color: 'var(--ink-3)' }}>{skorsuzProje}</span>
          </div>
        </div>
      </div>

      {riskliListe.length > 0 && (
        <div className="card" style={{ padding: 0, marginBottom: 22 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', padding: '12px 14px 4px' }}>En riskli projeler — Kriz + Gergin (en kötü kanal)</div>
          <table>
            <tbody>
              {riskliListe.map(s => (
                <tr key={s.pid}>
                  <td>
                    <Link to={'/projeler/' + s.pid}>{s.ad}</Link>
                    <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{s.hub ? ' · ' + s.hub : ''}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {s.uyusmazlik && <span className="chip" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>⚠ uyuşmazlık</span>}{' '}
                    <span className={'chip skor-' + s.enKotu}>{s.enKotu} · {SAGLIK_SKORLARI[s.enKotu].etiket}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Yapı</h2>
      <div className="card" style={{ padding: 0, marginBottom: 22 }}>
        <table>
          <thead>
            <tr><th>Hub</th><th>Müşteri</th><th>Proje</th><th>Kişi</th></tr>
          </thead>
          <tbody>
            {d.hubs.filter(h => seesAll || h.id === profile.hub_id).map(h => {
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
                      <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{t.bitis_tarihi ? 'Bitiş: ' + fmtTarih(t.bitis_tarihi) : ''}</div>
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

// ============================================================
// İŞLERİM — PM / danışman / ekip için kişisel aktif tezgah
// İki görünüm: "Aciliyete göre" (tek liste, bitişe göre — varsayılan) ve
// "Projeye göre" (katlanabilir gruplar). Toggle yalnızca 2+ projede görünür.
// Sol şerit = aciliyet. Satır kendini anlatır: iş tipi, durum, ürün, efor.
// ============================================================
function Islerim() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState(null)
  const [hata, setHata] = useState('')
  const [eforTask, setEforTask] = useState(null)
  const [gorunum, setGorunum] = useState('aciliyet')   // 'aciliyet' | 'proje'
  const [acikGruplar, setAcikGruplar] = useState({})   // { project_id: bool } override

  useEffect(() => { yukle() }, [])

  async function yukle() {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, baslik, durum, bitis_tarihi, blokaj, kritik, project_id, product_id, work_types ( ad ), waiting_reasons ( ad ), products ( ad ), projects ( ad ), effort_entries ( saat )')
      .eq('sorumlu_id', profile.id)
      .neq('durum', 'tamamlandi')
      .order('bitis_tarihi', { ascending: true, nullsFirst: false })
    if (error) { setHata('İşler yüklenemedi: ' + error.message); setTasks([]); return }
    setHata('')
    setTasks(data || [])
  }

  async function tamamla(t) {
    await supabase.from('tasks').update({ durum: 'tamamlandi' }).eq('id', t.id)
    yukle()
  }

  if (!tasks) return <p>Yükleniyor…</p>

  const bugun = new Date(); bugun.setHours(0, 0, 0, 0)
  const buHaftaSon = new Date(bugun); buHaftaSon.setDate(buHaftaSon.getDate() + (7 - ((bugun.getDay() + 6) % 7)))
  const gunFarki = t => t.bitis_tarihi ? Math.round((parseISO(t.bitis_tarihi) - bugun) / 86400000) : null

  const beklemede = tasks.filter(t => t.durum === 'beklemede')
  const aktif = tasks.filter(t => t.durum !== 'beklemede')
  const gecikmis = aktif.filter(t => t.bitis_tarihi && parseISO(t.bitis_tarihi) < bugun)
  const buHafta = aktif.filter(t => t.bitis_tarihi && parseISO(t.bitis_tarihi) >= bugun && parseISO(t.bitis_tarihi) <= buHaftaSon)

  const eforSaat = t => (t.effort_entries || []).reduce((s, e) => s + Number(e.saat), 0)
  const seritRenk = t => {
    if (t.durum === 'beklemede') return 'var(--line)'
    if (gecikmis.includes(t)) return 'var(--danger)'
    if (buHafta.includes(t)) return 'var(--warn)'
    return 'var(--ink-3)'
  }

  const terminRozet = t => {
    if (!t.bitis_tarihi) return <span style={{ color: 'var(--ink-3)' }}>tarih yok</span>
    const g = gunFarki(t)
    if (g < 0) return <span style={{ color: 'var(--danger)', fontFamily: "'IBM Plex Mono', monospace" }}>{fmtTarih(t.bitis_tarihi)} · {-g}g geç</span>
    if (g === 0) return <span style={{ color: 'var(--warn)', fontFamily: "'IBM Plex Mono', monospace" }}>bugün</span>
    return <span style={{ color: 'var(--ink-3)', fontFamily: "'IBM Plex Mono', monospace" }}>{fmtTarih(t.bitis_tarihi)}</span>
  }

  // projeGoster: aciliyet modunda true (proje adı satırda), proje modunda false (başlıkta zaten var)
  const Satir = (t, projeGoster) => {
    const bekl = t.durum === 'beklemede'
    const saat = eforSaat(t)
    return (
      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderLeft: `4px solid ${seritRenk(t)}`, borderTop: '1px solid var(--line)', background: bekl ? 'var(--paper)' : undefined }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: bekl ? 'var(--ink-3)' : undefined }}>{t.baslik}</span>
            <span className="chip" style={{ fontSize: 11 }}>{DURUMLAR[t.durum]}</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
            {t.work_types && <>{t.work_types.ad}</>}
            {projeGoster && <>{t.work_types ? ' · ' : ''}<Link to={'/projeler/' + t.project_id}>{t.projects?.ad}</Link></>}
            {t.products && <> · <span className={urunChip(t.products.ad)}>{t.products.ad}</span></>}
            {t.blokaj && <> · <span className="chip danger">Blokaj</span></>}
            {t.kritik && <> · <span className="chip warn">Kritik</span></>}
            {bekl && t.waiting_reasons && <> · {t.waiting_reasons.ad}</>}
            {saat > 0 && <> · <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{saat} sa</span></>}
          </div>
        </div>
        <div style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{terminRozet(t)}</div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button className="btn ghost sm" onClick={() => tamamla(t)}>Tamamla</button>
          <button className="btn ghost sm" onClick={() => setEforTask(t)}>Efor</button>
        </div>
      </div>
    )
  }

  const projeSayisi = new Set(tasks.map(t => t.project_id)).size
  const etkinGorunum = projeSayisi >= 2 ? gorunum : 'aciliyet'

  // Projeye göre gruplar (aciliyete göre sıralı: gecikmişi olan üstte, sonra en yakın termin)
  const gruplar = Object.values(tasks.reduce((acc, t) => {
    const pid = t.project_id
    if (!acc[pid]) acc[pid] = { pid, ad: t.projects?.ad || '—', aktifItems: [], beklItems: [] }
    if (t.durum === 'beklemede') acc[pid].beklItems.push(t); else acc[pid].aktifItems.push(t)
    return acc
  }, {}))
  gruplar.forEach(g => {
    g.gecikmisSayi = g.aktifItems.filter(x => gecikmis.includes(x)).length
    const tarihler = g.aktifItems.filter(x => x.bitis_tarihi).map(x => x.bitis_tarihi).sort()
    g.enYakin = tarihler[0] || null
    g.gecikmisVar = g.gecikmisSayi > 0
  })
  gruplar.sort((a, b) => {
    if (a.gecikmisVar !== b.gecikmisVar) return a.gecikmisVar ? -1 : 1
    if (!a.enYakin) return 1
    if (!b.enYakin) return -1
    return a.enYakin.localeCompare(b.enYakin)
  })

  const togBtn = (deger, etiket) => (
    <button
      onClick={() => setGorunum(deger)}
      style={{
        fontSize: 12.5, padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
        border: gorunum === deger ? '1px solid var(--line)' : '1px solid transparent',
        background: gorunum === deger ? 'var(--card)' : 'transparent',
        color: gorunum === deger ? 'var(--ink)' : 'var(--ink-3)'
      }}>{etiket}</button>
  )

  return (
    <>
      <div className="page-head">
        <div>
          <h1>İşlerim</h1>
          <p>Üstümdeki açık işler · bitiş tarihine göre sıralı</p>
        </div>
      </div>

      {hata && (
        <div className="card" style={{ borderLeft: '3px solid var(--danger)', marginBottom: 16, color: 'var(--danger)', fontSize: 13.5 }}>
          {hata}
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: 22 }}>
        <div className="card kpi">
          <div className="num" style={{ color: gecikmis.length ? 'var(--danger)' : undefined }}>{gecikmis.length}</div>
          <div className="lbl">Bitişi geçmiş</div>
        </div>
        <div className="card kpi">
          <div className="num">{aktif.filter(t => gunFarki(t) === 0).length}</div>
          <div className="lbl">Bugün bitişli</div>
        </div>
        <div className="card kpi">
          <div className="num">{buHafta.length}</div>
          <div className="lbl">Bu hafta</div>
        </div>
        <div className="card kpi">
          <div className="num">{beklemede.length}</div>
          <div className="lbl">Beklemede</div>
        </div>
      </div>

      {projeSayisi >= 2 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ display: 'inline-flex', background: 'var(--paper)', borderRadius: 8, padding: 3 }}>
            {togBtn('aciliyet', 'Aciliyete göre')}
            {togBtn('proje', 'Projeye göre')}
          </div>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{projeSayisi} proje · {aktif.length + beklemede.length} açık iş</span>
        </div>
      )}

      {tasks.length === 0 && (
        <div className="empty"><strong>Üstünde açık iş yok</strong>Sana atanmış tamamlanmamış iş kalemi bulunmuyor.</div>
      )}

      {tasks.length > 0 && etkinGorunum === 'aciliyet' && (
        <div className="card" style={{ padding: 0, borderTop: 'none', overflow: 'hidden' }}>
          {aktif.map(t => Satir(t, true))}
          {beklemede.map(t => Satir(t, true))}
        </div>
      )}

      {tasks.length > 0 && etkinGorunum === 'proje' && gruplar.map(g => {
        const acik = acikGruplar[g.pid] ?? g.gecikmisVar
        return (
          <div key={g.pid} className="card" style={{ padding: 0, marginBottom: 12, borderTop: 'none', overflow: 'hidden' }}>
            <button
              onClick={() => setAcikGruplar(s => ({ ...s, [g.pid]: !(s[g.pid] ?? g.gecikmisVar) }))}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--paper)', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
              <span style={{ fontSize: 15, color: 'var(--ink-3)' }}>{acik ? '▾' : '▸'}</span>
              <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--ink)' }}>{g.ad}</span>
              {g.gecikmisSayi > 0 && <span className="chip danger" style={{ fontSize: 11 }}>{g.gecikmisSayi} gecikmiş</span>}
              <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{g.aktifItems.length} açık{g.beklItems.length ? ` · ${g.beklItems.length} beklemede` : ''}</span>
              <span style={{ flex: 1 }} />
              {g.enYakin && <span style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: "'IBM Plex Mono', monospace" }}>en yakın {fmtTarih(g.enYakin)}</span>}
            </button>
            {acik && <div>{[...g.aktifItems, ...g.beklItems].map(t => Satir(t, false))}</div>}
          </div>
        )
      })}

      {eforTask && (
        <EforModal
          task={eforTask}
          girenId={profile.id}
          onClose={() => setEforTask(null)}
          onSaved={yukle}
        />
      )}
    </>
  )
}
