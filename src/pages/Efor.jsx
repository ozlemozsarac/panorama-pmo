import { useEffect, useMemo, useState } from 'react'
import { supabase, haftaBasi, isoDate, DURUMLAR } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Efor Özet — iş kalemlerinden otomatik toplanan izleme dashboard'u
export default function Efor() {
  const { profile, seesAll, isHubYon } = useAuth()
  const [donem, setDonem] = useState('hafta') // hafta | ay | yil
  const [efor, setEfor] = useState([])
  const [tasks, setTasks] = useState([])
  const [kisiler, setKisiler] = useState([])
  const [projeler, setProjeler] = useState([])
  const [urunlerList, setUrunlerList] = useState([])
  const [isTipleri, setIsTipleri] = useState([])
  const [hublar, setHublar] = useState([])
  const [seciliKisi, setSeciliKisi] = useState('') // '' = tümü (yetkiye göre)
  const [yukleniyor, setYukleniyor] = useState(true)

  useEffect(() => { yukle() }, [])

  async function yukle() {
    setYukleniyor(true)
    const [ef, t, ki, pr, ur, it, hb] = await Promise.all([
      supabase.from('effort_entries').select('*'),
      supabase.from('tasks').select('id, durum, blokaj, kritik, is_tipi_id, product_id, project_id'),
      supabase.from('profiles').select('id, ad, hub_id, yetki_rolu').eq('aktif', true),
      supabase.from('projects').select('id, ad, customers ( hub_id, hubs ( ad, renk ) )'),
      supabase.from('products').select('*'),
      supabase.from('work_types').select('*').order('sira'),
      supabase.from('hubs').select('*').order('sira')
    ])
    setEfor(ef.data || []); setTasks(t.data || []); setKisiler(ki.data || [])
    setProjeler(pr.data || []); setUrunlerList(ur.data || []); setIsTipleri(it.data || [])
    setHublar(hb.data || [])
    setYukleniyor(false)
  }

  // Dönem filtresi: seçili döneme giren efor kayıtları
  const donemBaslangic = useMemo(() => {
    const now = new Date()
    if (donem === 'hafta') return haftaBasi(now)
    if (donem === 'ay') return new Date(now.getFullYear(), now.getMonth(), 1)
    return new Date(now.getFullYear(), 0, 1) // yıl
  }, [donem])

  // Bu kullanıcının görebileceği kişi kapsamı
  const gorunenKisiler = useMemo(() => {
    if (seesAll) return kisiler
    if (isHubYon) return kisiler.filter(k => k.hub_id === profile.hub_id)
    return kisiler.filter(k => k.id === profile.id)
  }, [kisiler, seesAll, isHubYon, profile])

  const gorunenKisiIds = new Set(gorunenKisiler.map(k => k.id))

  // Filtrelenmiş efor: dönem + kişi kapsamı + (opsiyonel) seçili kişi
  const filtreliEfor = useMemo(() => {
    const bas = isoDate(donemBaslangic)
    return efor.filter(e => {
      if (e.hafta_baslangici < bas) return false
      if (!gorunenKisiIds.has(e.user_id)) return false
      if (seciliKisi && e.user_id !== seciliKisi) return false
      return true
    })
  }, [efor, donemBaslangic, gorunenKisiIds, seciliKisi])

  const toplamSaat = filtreliEfor.reduce((s, e) => s + Number(e.saat), 0)

  // Kırılımlar
  const projeKirilim = kirilim(filtreliEfor, e => e.project_id, projeler, p => p.ad)
  const urunKirilim = kirilim(filtreliEfor, e => e.product_id, urunlerList, u => u.ad)
  const taskMap = Object.fromEntries(tasks.map(t => [t.id, t]))
  const tipKirilim = kirilim(filtreliEfor, e => taskMap[e.task_id]?.is_tipi_id, isTipleri, t => t.ad)

  // Hub bazlı toplam
  const projeHub = Object.fromEntries(projeler.map(p => [p.id, p.customers?.hub_id]))
  const hubKirilim = {}
  filtreliEfor.forEach(e => {
    const h = projeHub[e.project_id]
    if (h) hubKirilim[h] = (hubKirilim[h] || 0) + Number(e.saat)
  })

  // Kişi bazlı toplam
  const kisiKirilim = {}
  filtreliEfor.forEach(e => { kisiKirilim[e.user_id] = (kisiKirilim[e.user_id] || 0) + Number(e.saat) })

  // Blokaj / kritik yoğunluğu (görünür kişilerin sorumlu olduğu açık işlerde)
  const gorunurTaskIds = new Set(filtreliEfor.map(e => e.task_id))
  const ilgiliTasks = tasks.filter(t => gorunurTaskIds.has(t.id) && t.durum !== 'tamamlandi')
  const blokajSayi = ilgiliTasks.filter(t => t.blokaj).length
  const kritikSayi = ilgiliTasks.filter(t => t.kritik).length

  const donemAdi = { hafta: 'Bu hafta', ay: 'Bu ay', yil: 'Bu yıl' }[donem]

  if (yukleniyor) return <p>Yükleniyor…</p>

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Efor Özet</h1>
          <p>{seesAll ? 'Tüm ekiplerin' : isHubYon ? 'Ekibinizin' : 'Kendi'} efor dağılımı · iş kalemlerinden otomatik toplanır</p>
        </div>
      </div>

      <div className="filters" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['hafta', 'Haftalık'], ['ay', 'Aylık'], ['yil', 'Yıllık']].map(([v, l]) => (
            <button key={v} className={'filter-chip' + (donem === v ? ' active' : '')} onClick={() => setDonem(v)}>{l}</button>
          ))}
        </div>
        {(seesAll || isHubYon) && (
          <select value={seciliKisi} onChange={e => setSeciliKisi(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="">Tüm kişiler</option>
            {gorunenKisiler.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
          </select>
        )}
      </div>

      {/* KPI kartları */}
      <div className="grid grid-4" style={{ marginBottom: 22 }}>
        <div className="card kpi">
          <div className="num">{Math.round(toplamSaat)}</div>
          <div className="lbl">{donemAdi} toplam saat</div>
        </div>
        <div className="card kpi">
          <div className="num">{Object.keys(kisiKirilim).length}</div>
          <div className="lbl">Efor giren kişi</div>
        </div>
        <div className="card kpi">
          <div className="num" style={{ color: blokajSayi ? 'var(--danger)' : undefined }}>{blokajSayi}</div>
          <div className="lbl">Bloklu iş</div>
        </div>
        <div className="card kpi">
          <div className="num" style={{ color: kritikSayi ? 'var(--warn)' : undefined }}>{kritikSayi}</div>
          <div className="lbl">Kritik iş</div>
        </div>
      </div>

      {toplamSaat === 0 ? (
        <div className="empty">
          <strong>{donemAdi} için efor kaydı yok</strong>
          İş kalemlerine efor girildikçe dağılım burada görünecek.
        </div>
      ) : (
        <>
          {/* Kişi bazlı (yalnızca hub yön / direktör) */}
          {(seesAll || isHubYon) && (
            <BarBlok baslik="Kişi bazlı" veri={Object.entries(kisiKirilim)
              .map(([id, s]) => ({ ad: kisiler.find(k => k.id === id)?.ad || '—', saat: s }))
              .sort((a, b) => b.saat - a.saat)} toplam={toplamSaat} />
          )}

          <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', marginTop: 14 }}>
            <BarBlok baslik="Proje bazlı" veri={projeKirilim} toplam={toplamSaat} />
            <BarBlok baslik="Ürün bazlı" veri={urunKirilim} toplam={toplamSaat} />
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', marginTop: 14 }}>
            <BarBlok baslik="İş tipi bazlı" veri={tipKirilim} toplam={toplamSaat} />
            {seesAll && (
              <BarBlok baslik="Hub bazlı" veri={Object.entries(hubKirilim)
                .map(([id, s]) => ({ ad: hublar.find(h => h.id === id)?.ad || '—', saat: s, renk: hublar.find(h => h.id === id)?.renk }))
                .sort((a, b) => b.saat - a.saat)} toplam={toplamSaat} />
            )}
          </div>
        </>
      )}
    </>
  )
}

function kirilim(eforlar, keyFn, liste, adFn) {
  const acc = {}
  eforlar.forEach(e => { const k = keyFn(e); if (k) acc[k] = (acc[k] || 0) + Number(e.saat) })
  return Object.entries(acc)
    .map(([id, saat]) => ({ ad: adFn(liste.find(x => x.id === id) || {}) || '—', saat }))
    .sort((a, b) => b.saat - a.saat)
}

function BarBlok({ baslik, veri, toplam }) {
  const max = Math.max(...veri.map(v => v.saat), 1)
  return (
    <div className="card">
      <h2>{baslik}</h2>
      {veri.length === 0 ? <p style={{ color: 'var(--ink-3)', fontSize: 14 }}>Veri yok.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {veri.map((v, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 2 }}>
                <span>{v.ad}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'var(--ink-2)' }}>
                  {Math.round(v.saat)} sa · %{Math.round(v.saat / toplam * 100)}
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--paper)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: (v.saat / max * 100) + '%', background: v.renk || 'var(--accent)', borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
