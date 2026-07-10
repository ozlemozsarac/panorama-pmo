import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const ASIRI_YUK_ESIK = 4 // bu sayıdan fazla projede olan "aşırı yüklü"

export default function AtamaRaporu() {
  const { seesAll, isHubYon, profile } = useAuth()
  const [eksen, setEksen] = useState('proje') // proje | kisi
  const [projeler, setProjeler] = useState([])
  const [kisiler, setKisiler] = useState([])
  const [atamalar, setAtamalar] = useState([])
  const [hublar, setHublar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)

  useEffect(() => { yukle() }, [])

  async function yukle() {
    setYukleniyor(true)
    const [pr, ki, at, hb] = await Promise.all([
      supabase.from('projects').select('id, ad, aktif, customers ( ad, hub_id, hubs ( ad, renk ) )').eq('aktif', true),
      supabase.from('profiles').select('id, ad, hub_id, yetki_rolu, hubs ( ad )').eq('aktif', true),
      supabase.from('project_assignments').select('project_id, user_id, proje_lideri'),
      supabase.from('hubs').select('*').order('sira')
    ])
    setProjeler(pr.data || []); setKisiler(ki.data || [])
    setAtamalar(at.data || []); setHublar(hb.data || [])
    setYukleniyor(false)
  }

  // Kapsam: hub yöneticisi kendi hub'ı; direktör/gm hepsi
  const kapsamProjeler = useMemo(() => {
    if (seesAll) return projeler
    if (isHubYon) return projeler.filter(p => p.customers?.hub_id === profile.hub_id)
    return projeler
  }, [projeler, seesAll, isHubYon, profile])

  const kapsamKisiler = useMemo(() => {
    if (seesAll) return kisiler
    if (isHubYon) return kisiler.filter(k => k.hub_id === profile.hub_id)
    return kisiler
  }, [kisiler, seesAll, isHubYon, profile])

  const kisiAd = id => kisiler.find(k => k.id === id)?.ad || '—'
  const projeById = id => projeler.find(p => p.id === id)

  // Proje ekseni satırları
  const projeSatir = kapsamProjeler.map(p => {
    const atl = atamalar.filter(a => a.project_id === p.id)
    const lider = atl.find(a => a.proje_lideri)
    return {
      proje: p,
      kisiler: atl.map(a => ({ ad: kisiAd(a.user_id), lider: a.proje_lideri })),
      liderAd: lider ? kisiAd(lider.user_id) : null,
      kisiSayi: atl.length
    }
  }).sort((a, b) => a.proje.ad.localeCompare(b.proje.ad, 'tr'))

  // Kişi ekseni satırları
  const kisiSatir = kapsamKisiler.map(k => {
    const atl = atamalar.filter(a => a.user_id === k.id)
    return {
      kisi: k,
      projeler: atl.map(a => {
        const p = projeById(a.project_id)
        return { ad: p?.ad || '—', lider: a.proje_lideri, disHub: p && p.customers?.hub_id !== k.hub_id }
      }).filter(x => x.ad !== '—'),
      projeSayi: atl.length
    }
  }).sort((a, b) => a.kisi.ad.localeCompare(b.kisi.ad, 'tr'))

  // SİNYALLER
  // Yönetim rolleri (direktör, gm) kaynak havuzunun parçası değil — sinyallere dahil edilmez.
  // Ama listede görünürler (kişi ekseninde kendi satırları durur).
  const kaynakRol = k => !['direktor', 'gm'].includes(k.yetki_rolu)
  const kaynakKisiSatir = kisiSatir.filter(r => kaynakRol(r.kisi))

  const kimsesizProjeler = projeSatir.filter(r => r.kisiSayi === 0)
  const lidersizProjeler = projeSatir.filter(r => r.kisiSayi > 0 && !r.liderAd)
  const asiriYuklu = kaynakKisiSatir.filter(r => r.projeSayi > ASIRI_YUK_ESIK)
  const bostakiler = kaynakKisiSatir.filter(r => r.projeSayi === 0)
  const caprazAtamalar = kaynakKisiSatir.filter(r => r.projeler.some(p => p.disHub))

  // EXCEL EXPORT (SheetJS dinamik yükleme)
  async function excelExport() {
    const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs')
    let rows
    if (eksen === 'proje') {
      rows = projeSatir.map(r => ({
        'Proje': r.proje.ad,
        'Müşteri': r.proje.customers.ad,
        'Hub': r.proje.customers.hubs.ad,
        'Proje Lideri': r.liderAd || '(yok)',
        'Atanan Kişiler': r.kisiler.map(k => k.ad + (k.lider ? ' (lider)' : '')).join(', ') || '(kimse)',
        'Kişi Sayısı': r.kisiSayi
      }))
    } else {
      rows = kisiSatir.map(r => ({
        'Kişi': r.kisi.ad,
        'Kadro Hub': r.kisi.hubs?.ad || '—',
        'Projeler': r.projeler.map(p => p.ad + (p.lider ? ' (lider)' : '') + (p.disHub ? ' [dış]' : '')).join(', ') || '(atama yok)',
        'Proje Sayısı': r.projeSayi
      }))
    }
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, eksen === 'proje' ? 'Projeye Göre' : 'Kişiye Göre')
    XLSX.writeFile(wb, `atama-raporu-${eksen}-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  if (yukleniyor) return <p>Yükleniyor…</p>

  return (
    <>
      <div className="page-head no-print">
        <div>
          <h1>Atama Raporu</h1>
          <p>{seesAll ? 'Tüm hub\u2019lar' : 'Hub\u2019ınız'} · kaynak dağılımı ve atama sinyalleri</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost" onClick={excelExport}>Excel'e aktar</button>
          <button className="btn ghost" onClick={() => window.print()}>PDF (Yazdır)</button>
        </div>
      </div>

      <div className="print-title" style={{ display: 'none' }}>
        <h1>Atama Raporu — {eksen === 'proje' ? 'Projeye Göre' : 'Kişiye Göre'}</h1>
        <p>{new Date().toLocaleDateString('tr-TR')}</p>
      </div>

      <div className="filters no-print">
        <button className={'filter-chip' + (eksen === 'proje' ? ' active' : '')} onClick={() => setEksen('proje')}>Projeye göre</button>
        <button className={'filter-chip' + (eksen === 'kisi' ? ' active' : '')} onClick={() => setEksen('kisi')}>Kişiye göre</button>
      </div>

      {/* SİNYALLER */}
      <div className="grid grid-3 no-print" style={{ marginBottom: 20 }}>
        <SinyalKart baslik="Kimsesiz proje" sayi={kimsesizProjeler.length} tehlike
          detay={kimsesizProjeler.map(r => r.proje.ad)} />
        <SinyalKart baslik="Lidersiz proje" sayi={lidersizProjeler.length} uyari
          detay={lidersizProjeler.map(r => r.proje.ad)} />
        <SinyalKart baslik="Aşırı yüklü kişi" sayi={asiriYuklu.length} uyari
          detay={asiriYuklu.map(r => `${r.kisi.ad} (${r.projeSayi})`)} />
        <SinyalKart baslik="Boştaki kişi" sayi={bostakiler.length}
          detay={bostakiler.map(r => r.kisi.ad)} />
        <SinyalKart baslik="Çapraz atama" sayi={caprazAtamalar.length}
          detay={caprazAtamalar.map(r => r.kisi.ad)} />
      </div>

      {/* ANA TABLO */}
      {eksen === 'proje' ? (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Proje</th><th>Müşteri</th><th>Hub</th><th>Lider</th><th>Atanan kişiler</th><th>Kişi</th></tr></thead>
            <tbody>
              {projeSatir.map(r => (
                <tr key={r.proje.id}>
                  <td><Link to={'/projeler/' + r.proje.id} className="no-print-link">{r.proje.ad}</Link></td>
                  <td>{r.proje.customers.ad}</td>
                  <td>{r.proje.customers.hubs.ad}</td>
                  <td>{r.liderAd || <span style={{ color: 'var(--warn)' }}>—</span>}</td>
                  <td>{r.kisiler.length === 0
                    ? <span style={{ color: 'var(--danger)' }}>kimse atanmadı</span>
                    : r.kisiler.map((k, i) => <span key={i}>{k.ad}{k.lider ? ' ★' : ''}{i < r.kisiler.length - 1 ? ', ' : ''}</span>)}
                  </td>
                  <td style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{r.kisiSayi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Kişi</th><th>Kadro hub</th><th>Projeler</th><th>Proje</th></tr></thead>
            <tbody>
              {kisiSatir.map(r => (
                <tr key={r.kisi.id}>
                  <td><strong>{r.kisi.ad}</strong></td>
                  <td>{r.kisi.hubs?.ad || '—'}</td>
                  <td>{r.projeler.length === 0
                    ? <span style={{ color: 'var(--ink-3)' }}>atama yok</span>
                    : r.projeler.map((p, i) => (
                        <span key={i}>{p.ad}{p.lider ? ' ★' : ''}{p.disHub ? <span style={{ color: 'var(--warn)' }}> [dış]</span> : ''}{i < r.projeler.length - 1 ? ', ' : ''}</span>
                      ))}
                  </td>
                  <td style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{r.projeSayi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function SinyalKart({ baslik, sayi, detay, tehlike, uyari }) {
  const [acik, setAcik] = useState(false)
  const renk = tehlike && sayi > 0 ? 'var(--danger)' : uyari && sayi > 0 ? 'var(--warn)' : 'var(--ink)'
  return (
    <div className="card kpi" style={{ cursor: detay.length ? 'pointer' : 'default' }} onClick={() => detay.length && setAcik(!acik)}>
      <div className="num" style={{ color: renk }}>{sayi}</div>
      <div className="lbl">{baslik}</div>
      {acik && detay.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--ink-2)', borderTop: '1px solid var(--line)', paddingTop: 6 }}>
          {detay.map((d, i) => <div key={i}>{d}</div>)}
        </div>
      )}
    </div>
  )
}
