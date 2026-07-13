import { useEffect, useMemo, useState, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const ASIRI_YUK_ESIK = 4 // bu sayıdan fazla projede olan "aşırı yüklü"

const SANS = "'Geist', ui-sans-serif, system-ui, sans-serif"
const MONO = "'Geist Mono', ui-monospace, 'SF Mono', monospace"

// TEMA TOKEN'LARI — pilot için bu dosyaya kapsanmış (rollout'ta styles.css'e taşınacak)
const LIGHT = {
  bg: '#FAFAF9', surface: '#FFFFFF', border: '#E7E7E4', text: '#17171A', muted: '#71716C',
  accent: '#2563EB', danger: '#DC2626', warn: '#B45309', track: '#EFEFEC',
  prodBg: '#EEF3FC', prodTx: '#1D4ED8', disBg: '#F2F2EF', disTx: '#6B6B64', detay: '#F7F7F5'
}
const DARK = {
  bg: '#0C0C0E', surface: '#161619', border: '#28282C', text: '#F3F3F4', muted: '#8C8C92',
  accent: '#3B82F6', danger: '#F26D6D', warn: '#E0A83B', track: '#242428',
  prodBg: '#17233B', prodTx: '#8FB6F5', disBg: '#242428', disTx: '#9A9AA0', detay: '#141417'
}

export default function AtamaRaporu() {
  const { seesAll, isHubYon, profile } = useAuth()
  const [eksen, setEksen] = useState('proje') // proje | kisi
  const [projeler, setProjeler] = useState([])
  const [kisiler, setKisiler] = useState([])
  const [atamalar, setAtamalar] = useState([])
  const [hublar, setHublar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [acikSatir, setAcikSatir] = useState(null) // kişi ekseninde genişleyen satır
  const [dark, setDark] = useState(false) // oturum-içi tema (kalıcı değil)

  const t = dark ? DARK : LIGHT

  // Geist fontunu bir kez yükle (dosya kendi kendine — index.html'e dokunmadan)
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

  useEffect(() => { yukle() }, [])

  async function yukle() {
    setYukleniyor(true)
    const [pr, ki, at, hb] = await Promise.all([
      supabase.from('projects').select('id, ad, aktif, customers ( ad, hub_id, hubs ( ad, renk ) ), project_products ( products ( ad ) )').eq('aktif', true),
      supabase.from('profiles').select('id, ad, hub_id, yetki_rolu, hubs ( ad )').eq('aktif', true),
      supabase.from('project_assignments').select('project_id, user_id, proje_lideri'),
      supabase.from('hubs').select('*').order('sira')
    ])
    setProjeler(pr.data || []); setKisiler(ki.data || [])
    setAtamalar(at.data || []); setHublar(hb.data || [])
    setYukleniyor(false)
  }

  // PDF'i her zaman açık temada al (koyu tema baskıda okunmaz olur)
  function pdfYazdir() {
    if (dark) {
      setDark(false)
      setTimeout(() => window.print(), 60)
    } else {
      window.print()
    }
  }

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
  const projeUrunleri = p => (p?.project_products || []).map(pp => pp.products?.ad).filter(Boolean)

  const projeSatir = kapsamProjeler.map(p => {
    const atl = atamalar.filter(a => a.project_id === p.id)
    const lider = atl.find(a => a.proje_lideri)
    return {
      proje: p,
      urunler: projeUrunleri(p),
      kisiler: atl.map(a => ({ ad: kisiAd(a.user_id), lider: a.proje_lideri })),
      liderAd: lider ? kisiAd(lider.user_id) : null,
      kisiSayi: atl.length
    }
  }).sort((a, b) => a.proje.ad.localeCompare(b.proje.ad, 'tr'))

  const kisiSatir = kapsamKisiler.map(k => {
    const atl = atamalar.filter(a => a.user_id === k.id)
    const projeler = atl.map(a => {
      const p = projeById(a.project_id)
      return { ad: p?.ad || '—', lider: a.proje_lideri, disHub: p && p.customers?.hub_id !== k.hub_id, urunler: projeUrunleri(p) }
    }).filter(x => x.ad !== '—')
    const urunSayilari = {}
    projeler.forEach(p => p.urunler.forEach(u => { urunSayilari[u] = (urunSayilari[u] || 0) + 1 }))
    const disSayi = projeler.filter(p => p.disHub).length
    return { kisi: k, projeler, urunSayilari, disSayi, projeSayi: atl.length }
  }).sort((a, b) => a.kisi.ad.localeCompare(b.kisi.ad, 'tr'))

  const kimsesizProjeler = projeSatir.filter(r => r.kisiSayi === 0)
  const lidersizProjeler = projeSatir.filter(r => r.kisiSayi > 0 && !r.liderAd)
  const asiriYuklu = kisiSatir.filter(r => r.projeSayi > ASIRI_YUK_ESIK)
  const bostakiler = kisiSatir.filter(r => r.projeSayi === 0)
  const caprazAtamalar = kisiSatir.filter(r => r.projeler.some(p => p.disHub))

  const urunDagilimi = useMemo(() => {
    const tally = {}
    kapsamProjeler.forEach(p => projeUrunleri(p).forEach(u => { tally[u] = (tally[u] || 0) + 1 }))
    return Object.entries(tally).sort((a, b) => b[1] - a[1])
  }, [kapsamProjeler])
  const urunMax = urunDagilimi.length ? Math.max(...urunDagilimi.map(x => x[1])) : 0

  async function excelExport() {
    const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs')
    let rows
    if (eksen === 'proje') {
      rows = projeSatir.map(r => ({
        'Proje': r.proje.ad,
        'Müşteri': r.proje.customers.ad,
        'Hub': r.proje.customers.hubs.ad,
        'Ürünler': r.urunler.join(', ') || '(yok)',
        'Proje Lideri': r.liderAd || '(yok)',
        'Atanan Kişiler': r.kisiler.map(k => k.ad + (k.lider ? ' (lider)' : '')).join(', ') || '(kimse)',
        'Kişi Sayısı': r.kisiSayi
      }))
    } else {
      rows = kisiSatir.map(r => ({
        'Kişi': r.kisi.ad,
        'Kadro Hub': r.kisi.hubs?.ad || '—',
        'Ürün Dağılımı': Object.entries(r.urunSayilari).map(([u, s]) => `${u}: ${s}`).join(', ') + (r.disSayi ? `, dış: ${r.disSayi}` : ''),
        'Projeler': r.projeler.map(p => p.ad + (p.lider ? ' (lider)' : '') + (p.disHub ? ' [dış]' : '')).join(', ') || '(atama yok)',
        'Proje Sayısı': r.projeSayi
      }))
    }
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, eksen === 'proje' ? 'Projeye Göre' : 'Kişiye Göre')
    XLSX.writeFile(wb, `atama-raporu-${eksen}-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  if (yukleniyor) return <p style={{ fontFamily: SANS }}>Yükleniyor…</p>

  const kartStil = { background: t.surface, border: '1px solid ' + t.border, borderRadius: 12, padding: '16px 17px' }
  const kpiNumStil = { fontFamily: SANS, fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 32, lineHeight: 1, letterSpacing: '-0.025em' }
  const lblStil = { fontSize: 12.5, color: t.muted, marginTop: 9 }
  const monoStil = { fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }
  const btnStil = { background: 'transparent', border: '1px solid ' + t.border, color: t.text, font: 'inherit', fontSize: 13, padding: '6px 13px', borderRadius: 8, cursor: 'pointer' }
  const thStil = { textAlign: 'left', fontWeight: 500, color: t.muted, fontSize: 12, padding: '9px 14px', borderBottom: '1px solid ' + t.border }
  const tdStil = { padding: '11px 14px', borderBottom: '1px solid ' + t.border, fontSize: 13, verticalAlign: 'top' }

  const urunRozet = (ad, sayi) => (
    <span style={{ display: 'inline-block', background: t.prodBg, color: t.prodTx, fontSize: 12, padding: '2px 8px', borderRadius: 6, marginRight: 4, marginBottom: 3 }}>
      {ad}{sayi != null ? ' ' + sayi : ''}
    </span>
  )
  const disRozet = sayi => (
    <span style={{ display: 'inline-block', background: t.disBg, color: t.disTx, fontSize: 12, padding: '2px 8px', borderRadius: 6, marginRight: 4, marginBottom: 3 }}>
      dış{sayi != null ? ' ' + sayi : ''}
    </span>
  )

  return (
    <div style={{ fontFamily: SANS, background: t.bg, color: t.text, borderRadius: 14, padding: 20, minHeight: '70vh' }}>

      <div className="page-head no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-0.015em' }}>Atama raporu</div>
          <div style={{ fontSize: 13, color: t.muted, marginTop: 3 }}>{seesAll ? 'Tüm hub’lar' : 'Hub’ınız'} · kaynak dağılımı ve atama sinyalleri</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button style={{ ...btnStil, fontSize: 12 }} onClick={() => setDark(d => !d)}>{dark ? '☀ Açık' : '☾ Koyu'}</button>
          <span style={{ width: 1, height: 20, background: t.border }}></span>
          <button style={btnStil} onClick={excelExport}>Excel'e aktar</button>
          <button style={btnStil} onClick={pdfYazdir}>PDF</button>
        </div>
      </div>

      <div className="print-title" style={{ display: 'none' }}>
        <h1>Atama Raporu — {eksen === 'proje' ? 'Projeye Göre' : 'Kişiye Göre'}</h1>
        <p>{new Date().toLocaleDateString('tr-TR')}</p>
      </div>

      <div className="no-print" style={{ display: 'inline-flex', gap: 3, background: t.track, padding: 3, borderRadius: 9, marginBottom: 22 }}>
        <button onClick={() => setEksen('proje')} style={{ ...btnStil, border: 'none', background: eksen === 'proje' ? t.surface : 'transparent', color: eksen === 'proje' ? t.text : t.muted, fontWeight: eksen === 'proje' ? 500 : 400, boxShadow: eksen === 'proje' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none' }}>Projeye göre</button>
        <button onClick={() => setEksen('kisi')} style={{ ...btnStil, border: 'none', background: eksen === 'kisi' ? t.surface : 'transparent', color: eksen === 'kisi' ? t.text : t.muted, fontWeight: eksen === 'kisi' ? 500 : 400, boxShadow: eksen === 'kisi' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none' }}>Kişiye göre</button>
      </div>

      {/* SİNYALLER + ÜRÜN DAĞILIMI */}
      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <SinyalKart t={t} kartStil={kartStil} kpiNumStil={kpiNumStil} lblStil={lblStil} baslik="Atanmamış proje" sayi={kimsesizProjeler.length} tip="danger" detay={kimsesizProjeler.map(r => r.proje.ad)} />
        <SinyalKart t={t} kartStil={kartStil} kpiNumStil={kpiNumStil} lblStil={lblStil} baslik="Lidersiz proje" sayi={lidersizProjeler.length} tip="warn" detay={lidersizProjeler.map(r => r.proje.ad)} />
        <SinyalKart t={t} kartStil={kartStil} kpiNumStil={kpiNumStil} lblStil={lblStil} baslik="Aşırı yüklü kişi" sayi={asiriYuklu.length} tip="warn" detay={asiriYuklu.map(r => `${r.kisi.ad} (${r.projeSayi})`)} />
        <SinyalKart t={t} kartStil={kartStil} kpiNumStil={kpiNumStil} lblStil={lblStil} baslik="Boştaki kişi" sayi={bostakiler.length} detay={bostakiler.map(r => r.kisi.ad)} />
        <SinyalKart t={t} kartStil={kartStil} kpiNumStil={kpiNumStil} lblStil={lblStil} baslik="Çapraz atama" sayi={caprazAtamalar.length} detay={caprazAtamalar.map(r => r.kisi.ad)} />
        <div style={kartStil}>
          <div style={{ fontSize: 12.5, color: t.muted, marginBottom: 11 }}>Ürün dağılımı</div>
          {urunDagilimi.length === 0
            ? <div style={{ fontSize: 12.5, color: t.muted }}>ürün bilgisi yok</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {urunDagilimi.map(([ad, sayi]) => (
                  <div key={ad} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{ width: 60, fontSize: 12, color: t.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ad}</div>
                    <div style={{ flex: 1, background: t.track, borderRadius: 3, height: 7, overflow: 'hidden' }}>
                      <div style={{ width: (urunMax ? Math.round(sayi / urunMax * 100) : 0) + '%', height: '100%', background: t.accent }} />
                    </div>
                    <div style={{ ...monoStil, width: 26, fontSize: 12.5, textAlign: 'right' }}>{sayi}</div>
                  </div>
                ))}
              </div>}
        </div>
      </div>

      {/* ANA TABLO */}
      {eksen === 'proje' ? (
        <div style={{ background: t.surface, border: '1px solid ' + t.border, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={thStil}>Proje</th><th style={thStil}>Müşteri</th><th style={thStil}>Hub</th>
              <th style={thStil}>Ürünler</th><th style={thStil}>Lider</th><th style={thStil}>Atanan kişiler</th>
              <th style={{ ...thStil, textAlign: 'right' }}>Kişi</th>
            </tr></thead>
            <tbody>
              {projeSatir.map(r => (
                <tr key={r.proje.id}>
                  <td style={tdStil}><Link to={'/projeler/' + r.proje.id} className="no-print-link" style={{ color: t.accent, textDecoration: 'none' }}>{r.proje.ad}</Link></td>
                  <td style={tdStil}>{r.proje.customers.ad}</td>
                  <td style={{ ...tdStil, color: t.muted }}>{r.proje.customers.hubs.ad}</td>
                  <td style={tdStil}>{r.urunler.length === 0 ? <span style={{ color: t.muted }}>—</span> : r.urunler.map((u, i) => <Fragment key={i}>{urunRozet(u)}</Fragment>)}</td>
                  <td style={tdStil}>{r.liderAd || <span style={{ color: t.warn }}>—</span>}</td>
                  <td style={tdStil}>{r.kisiler.length === 0
                    ? <span style={{ color: t.danger }}>kimse atanmadı</span>
                    : r.kisiler.map((k, i) => <span key={i}>{k.ad}{k.lider ? ' ★' : ''}{i < r.kisiler.length - 1 ? ', ' : ''}</span>)}</td>
                  <td style={{ ...tdStil, ...monoStil, textAlign: 'right' }}>{r.kisiSayi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ background: t.surface, border: '1px solid ' + t.border, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={thStil}>Kişi</th><th style={thStil}>Kadro hub</th><th style={thStil}>Ürün dağılımı</th>
              <th style={{ ...thStil, textAlign: 'right' }}>Proje</th>
            </tr></thead>
            <tbody>
              {kisiSatir.map(r => {
                const acik = acikSatir === r.kisi.id
                const urunGirdileri = Object.entries(r.urunSayilari).sort((a, b) => b[1] - a[1])
                return (
                  <Fragment key={r.kisi.id}>
                    <tr style={{ cursor: r.projeSayi ? 'pointer' : 'default' }} onClick={() => r.projeSayi && setAcikSatir(acik ? null : r.kisi.id)}>
                      <td style={tdStil}><strong>{r.kisi.ad}</strong></td>
                      <td style={{ ...tdStil, color: t.muted }}>{r.kisi.hubs?.ad || '—'}</td>
                      <td style={tdStil}>{r.projeSayi === 0
                        ? <span style={{ color: t.muted }}>atama yok</span>
                        : <>{urunGirdileri.map(([u, s]) => <Fragment key={u}>{urunRozet(u, s)}</Fragment>)}{r.disSayi > 0 && disRozet(r.disSayi)}</>}</td>
                      <td style={{ ...tdStil, ...monoStil, textAlign: 'right' }}>{r.projeSayi}</td>
                    </tr>
                    {acik && (
                      <tr>
                        <td colSpan={4} style={{ background: t.detay, fontSize: 12.5, color: t.muted, padding: '8px 14px', borderBottom: '1px solid ' + t.border }}>
                          {r.projeler.map((p, i) => (
                            <span key={i}>{p.ad}{p.lider ? ' ★' : ''}{p.disHub ? ' [dış]' : ''}{i < r.projeler.length - 1 ? ', ' : ''}</span>
                          ))}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SinyalKart({ t, kartStil, kpiNumStil, lblStil, baslik, sayi, detay, tip }) {
  const [acik, setAcik] = useState(false)
  const renk = tip === 'danger' && sayi > 0 ? t.danger : tip === 'warn' && sayi > 0 ? t.warn : t.text
  return (
    <div style={{ ...kartStil, cursor: detay.length ? 'pointer' : 'default' }} onClick={() => detay.length && setAcik(!acik)}>
      <div style={{ ...kpiNumStil, color: renk }}>{sayi}</div>
      <div style={lblStil}>{baslik}</div>
      {acik && detay.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: t.muted, borderTop: '1px solid ' + t.border, paddingTop: 8 }}>
          {detay.map((d, i) => <div key={i} style={{ marginBottom: 2 }}>{d}</div>)}
        </div>
      )}
    </div>
  )
}
