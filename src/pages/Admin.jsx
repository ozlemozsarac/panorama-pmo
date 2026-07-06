import { useEffect, useState } from 'react'
import { supabase, ROLLER, fmtTarih } from '../lib/supabase'

const TABS = ['Müşteriler', 'Projeler', 'Kullanıcılar', 'Atamalar', 'Maliyet', 'Listeler']

export default function Admin() {
  const [tab, setTab] = useState('Müşteriler')
  const [d, setD] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => { yukle() }, [])

  async function yukle() {
    const [hubs, customers, projects, products, pp, profiles, titles, wt, wr, assigns, rates] = await Promise.all([
      supabase.from('hubs').select('*').order('sira'),
      supabase.from('customers').select('*, hubs ( ad, renk )').order('ad'),
      supabase.from('projects').select('*, customers ( ad, hub_id )').order('ad'),
      supabase.from('products').select('*').order('ad'),
      supabase.from('project_products').select('*'),
      supabase.from('profiles').select('*, job_titles ( ad ), hubs ( ad )').order('ad'),
      supabase.from('job_titles').select('*').order('sira'),
      supabase.from('work_types').select('*').order('sira'),
      supabase.from('waiting_reasons').select('*').order('sira'),
      supabase.from('project_assignments').select('*'),
      supabase.from('rate_cards').select('*, profiles ( ad )').order('gecerli_baslangic', { ascending: false })
    ])
    setD({
      hubs: hubs.data || [], customers: customers.data || [], projects: projects.data || [],
      products: products.data || [], pp: pp.data || [], profiles: profiles.data || [],
      titles: titles.data || [], wt: wt.data || [], wr: wr.data || [],
      assigns: assigns.data || [], rates: rates.data || []
    })
  }

  async function run(promise, okMsg = 'Kaydedildi') {
    setMsg('')
    const { error } = await promise
    if (error) { setMsg('Hata: ' + error.message); return false }
    setMsg(okMsg); yukle(); return true
  }

  if (!d) return <p>Yükleniyor…</p>

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Yönetim</h1>
          <p>Tanımlar yalnızca PMO Direktörü tarafından düzenlenir.</p>
        </div>
      </div>
      <div className="tabs">
        {TABS.map(t => (
          <button key={t} className={'tab' + (tab === t ? ' active' : '')} onClick={() => { setTab(t); setMsg('') }}>{t}</button>
        ))}
      </div>
      {msg && <div className={'msg ' + (msg.startsWith('Hata') ? 'err' : 'ok')} style={{ marginBottom: 12 }}>{msg}</div>}

      {tab === 'Müşteriler' && <Musteriler d={d} run={run} />}
      {tab === 'Projeler' && <Projeler d={d} run={run} />}
      {tab === 'Kullanıcılar' && <Kullanicilar d={d} run={run} />}
      {tab === 'Atamalar' && <Atamalar d={d} run={run} />}
      {tab === 'Maliyet' && <Maliyet d={d} run={run} />}
      {tab === 'Listeler' && <Listeler d={d} run={run} />}
    </>
  )
}

function Musteriler({ d, run }) {
  const [yeni, setYeni] = useState({ ad: '', hub_id: '' })
  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <h2>Yeni müşteri</h2>
        <div className="row">
          <select value={yeni.hub_id} onChange={e => setYeni({ ...yeni, hub_id: e.target.value })}>
            <option value="">Hub seçin…</option>
            {d.hubs.map(h => <option key={h.id} value={h.id}>{h.ad}</option>)}
          </select>
          <input placeholder="Müşteri adı" value={yeni.ad} onChange={e => setYeni({ ...yeni, ad: e.target.value })} />
          <button className="btn" disabled={!yeni.ad || !yeni.hub_id}
            onClick={async () => { if (await run(supabase.from('customers').insert(yeni), 'Müşteri eklendi')) setYeni({ ad: '', hub_id: '' }) }}>
            Ekle
          </button>
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Müşteri</th><th>Hub</th><th>Proje sayısı</th></tr></thead>
          <tbody>
            {d.customers.map(c => (
              <tr key={c.id}>
                <td><strong>{c.ad}</strong></td>
                <td><span className="hub-dot" style={{ background: c.hubs.renk, marginRight: 6 }} />{c.hubs.ad}</td>
                <td>{d.projects.filter(p => p.customer_id === c.id).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Projeler({ d, run }) {
  const [yeni, setYeni] = useState({ ad: '', customer_id: '', urunler: [] })
  const urunToggle = uid => setYeni(y => ({
    ...y, urunler: y.urunler.includes(uid) ? y.urunler.filter(x => x !== uid) : [...y.urunler, uid]
  }))
  async function ekle() {
    const { data, error } = await supabase.from('projects')
      .insert({ ad: yeni.ad, customer_id: yeni.customer_id }).select().single()
    if (error) { run(Promise.resolve({ error })); return }
    if (yeni.urunler.length) {
      await supabase.from('project_products').insert(yeni.urunler.map(u => ({ project_id: data.id, product_id: u })))
    }
    run(Promise.resolve({ error: null }), 'Proje eklendi')
    setYeni({ ad: '', customer_id: '', urunler: [] })
  }
  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <h2>Yeni proje</h2>
        <div className="row" style={{ marginBottom: 10 }}>
          <select value={yeni.customer_id} onChange={e => setYeni({ ...yeni, customer_id: e.target.value })}>
            <option value="">Müşteri seçin…</option>
            {d.customers.map(c => <option key={c.id} value={c.id}>{c.ad} ({c.hubs.ad})</option>)}
          </select>
          <input placeholder="Proje adı" value={yeni.ad} onChange={e => setYeni({ ...yeni, ad: e.target.value })} />
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {d.products.map(u => (
            <label key={u.id} style={{ display: 'flex', gap: 5, alignItems: 'center', margin: 0 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={yeni.urunler.includes(u.id)} onChange={() => urunToggle(u.id)} />
              {u.ad}
            </label>
          ))}
          <button className="btn" style={{ marginLeft: 'auto' }} disabled={!yeni.ad || !yeni.customer_id} onClick={ekle}>Ekle</button>
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Proje</th><th>Müşteri</th><th>Ürünler</th><th>Durum</th></tr></thead>
          <tbody>
            {d.projects.map(p => (
              <tr key={p.id}>
                <td><strong>{p.ad}</strong></td>
                <td>{p.customers.ad}</td>
                <td>{d.pp.filter(x => x.project_id === p.id)
                  .map(x => d.products.find(u => u.id === x.product_id)?.ad).join(', ')}</td>
                <td>
                  <button className="btn ghost sm"
                    onClick={() => run(supabase.from('projects').update({ aktif: !p.aktif }).eq('id', p.id))}>
                    {p.aktif ? 'Aktif' : 'Pasif'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Kullanicilar({ d, run }) {
  return (
    <>
      <div className="card" style={{ marginBottom: 14, fontSize: 13.5, color: 'var(--ink-2)' }}>
        Yeni kullanıcı davet etmek için Supabase panelinde <strong>Authentication → Users → Invite user</strong> kullanın.
        Davet edilen kişi şifresini belirlediğinde burada görünür; rol, unvan ve hub atamasını buradan yaparsınız.
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Kişi</th><th>Yetki</th><th>Unvan</th><th>Hub</th><th>Durum</th></tr></thead>
          <tbody>
            {d.profiles.map(k => (
              <tr key={k.id}>
                <td>
                  <input value={k.ad} placeholder="Ad Soyad" style={{ maxWidth: 180 }}
                    onChange={e => k.ad = e.target.value}
                    onBlur={e => run(supabase.from('profiles').update({ ad: e.target.value }).eq('id', k.id))} />
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{k.eposta}</div>
                </td>
                <td>
                  <select value={k.yetki_rolu}
                    onChange={e => run(supabase.from('profiles').update({ yetki_rolu: e.target.value }).eq('id', k.id))}>
                    {Object.entries(ROLLER).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </td>
                <td>
                  <select value={k.unvan_id || ''}
                    onChange={e => run(supabase.from('profiles').update({ unvan_id: e.target.value || null }).eq('id', k.id))}>
                    <option value="">—</option>
                    {d.titles.map(t => <option key={t.id} value={t.id}>{t.ad}</option>)}
                  </select>
                </td>
                <td>
                  <select value={k.hub_id || ''}
                    onChange={e => run(supabase.from('profiles').update({ hub_id: e.target.value || null }).eq('id', k.id))}>
                    <option value="">— (yönetim)</option>
                    {d.hubs.map(h => <option key={h.id} value={h.id}>{h.ad}</option>)}
                  </select>
                </td>
                <td>
                  <button className="btn ghost sm"
                    onClick={() => run(supabase.from('profiles').update({ aktif: !k.aktif }).eq('id', k.id))}>
                    {k.aktif ? 'Aktif' : 'Pasif'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Atamalar({ d, run }) {
  const [pid, setPid] = useState('')
  const atananlar = d.assigns.filter(a => a.project_id === pid)
  const proje = d.projects.find(p => p.id === pid)
  const hubKisileri = proje
    ? d.profiles.filter(k => k.aktif && (k.hub_id === proje.customers.hub_id))
    : []
  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <label>Proje seçin</label>
        <select value={pid} onChange={e => setPid(e.target.value)}>
          <option value="">Seçin…</option>
          {d.projects.filter(p => p.aktif).map(p => <option key={p.id} value={p.id}>{p.ad} — {p.customers.ad}</option>)}
        </select>
      </div>
      {pid && (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Kişi</th><th>Unvan</th><th>Atama</th><th>Proje lideri</th></tr></thead>
            <tbody>
              {hubKisileri.map(k => {
                const atama = atananlar.find(a => a.user_id === k.id)
                return (
                  <tr key={k.id}>
                    <td><strong>{k.ad || k.eposta}</strong></td>
                    <td style={{ color: 'var(--ink-3)' }}>{k.job_titles?.ad || '—'}</td>
                    <td>
                      <button className={'btn sm' + (atama ? '' : ' ghost')}
                        onClick={() => atama
                          ? run(supabase.from('project_assignments').delete().eq('id', atama.id), 'Atama kaldırıldı')
                          : run(supabase.from('project_assignments').insert({ project_id: pid, user_id: k.id }), 'Atandı')}>
                        {atama ? 'Atandı ✓' : 'Ata'}
                      </button>
                    </td>
                    <td>
                      {atama && (
                        <input type="checkbox" style={{ width: 'auto' }} checked={atama.proje_lideri}
                          onChange={e => run(supabase.from('project_assignments')
                            .update({ proje_lideri: e.target.checked }).eq('id', atama.id))} />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function Maliyet({ d, run }) {
  const [yeni, setYeni] = useState({ user_id: '', saat_maliyeti: '', gecerli_baslangic: '' })
  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <h2>Yeni oran</h2>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: -6 }}>
          Oranlar geçerlilik tarihlidir: zam dönemlerinde yeni satır ekleyin, geçmiş raporlar bozulmaz.
          Bu sekmeyi yalnızca Direktör ve GM görür.
        </p>
        <div className="row">
          <select value={yeni.user_id} onChange={e => setYeni({ ...yeni, user_id: e.target.value })}>
            <option value="">Kişi seçin…</option>
            {d.profiles.filter(k => k.aktif).map(k => <option key={k.id} value={k.id}>{k.ad || k.eposta}</option>)}
          </select>
          <input inputMode="decimal" placeholder="Saat maliyeti" value={yeni.saat_maliyeti}
            onChange={e => setYeni({ ...yeni, saat_maliyeti: e.target.value })} />
          <input type="date" value={yeni.gecerli_baslangic}
            onChange={e => setYeni({ ...yeni, gecerli_baslangic: e.target.value })} />
          <button className="btn" disabled={!yeni.user_id || !yeni.saat_maliyeti || !yeni.gecerli_baslangic}
            onClick={async () => {
              const ok = await run(supabase.from('rate_cards').insert({
                ...yeni, saat_maliyeti: parseFloat(yeni.saat_maliyeti.replace(',', '.'))
              }), 'Oran eklendi')
              if (ok) setYeni({ user_id: '', saat_maliyeti: '', gecerli_baslangic: '' })
            }}>
            Ekle
          </button>
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Kişi</th><th>Saat maliyeti</th><th>Geçerlilik başlangıcı</th><th></th></tr></thead>
          <tbody>
            {d.rates.map(r => (
              <tr key={r.id}>
                <td>{r.profiles?.ad || '—'}</td>
                <td style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{Number(r.saat_maliyeti).toLocaleString('tr-TR')}</td>
                <td>{fmtTarih(r.gecerli_baslangic)}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn ghost sm"
                    onClick={() => run(supabase.from('rate_cards').delete().eq('id', r.id), 'Silindi')}>Sil</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Listeler({ d, run }) {
  const grup = [
    ['Unvanlar', 'job_titles', d.titles],
    ['İş tipleri', 'work_types', d.wt],
    ['Beklemede nedenleri', 'waiting_reasons', d.wr]
  ]
  const [yeniler, setYeniler] = useState({})
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
      {grup.map(([baslik, tablo, liste]) => (
        <div key={tablo} className="card">
          <h2>{baslik}</h2>
          {liste.map(x => <div key={x.id} className="person-row"><span>{x.ad}</span></div>)}
          <div className="row" style={{ marginTop: 10 }}>
            <input placeholder="Yeni ekle…" value={yeniler[tablo] || ''}
              onChange={e => setYeniler({ ...yeniler, [tablo]: e.target.value })} />
            <button className="btn sm" style={{ flex: '0 0 auto' }} disabled={!yeniler[tablo]}
              onClick={async () => {
                const ok = await run(supabase.from(tablo).insert({ ad: yeniler[tablo], sira: liste.length + 1 }), 'Eklendi')
                if (ok) setYeniler({ ...yeniler, [tablo]: '' })
              }}>
              Ekle
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
