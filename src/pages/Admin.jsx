import { useEffect, useState } from 'react'
import { supabase, ROLLER, fmtTarih } from '../lib/supabase'

const TABS = ['Müşteriler', 'Projeler', 'Ekip', 'Atamalar', 'Maliyet', 'Listeler']

export default function Admin() {
  const [tab, setTab] = useState('Müşteriler')
  const [d, setD] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => { yukle() }, [])

  async function yukle() {
    const [hubs, customers, projects, products, pp, profiles, titles, wt, wr, assigns, rates, tasks, effort, leaves] = await Promise.all([
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
      supabase.from('rate_cards').select('*, profiles ( ad )').order('gecerli_baslangic', { ascending: false }),
      supabase.from('tasks').select('id, project_id, is_tipi_id, beklemede_nedeni_id'),
      supabase.from('effort_entries').select('id, project_id, user_id'),
      supabase.from('leaves').select('id, user_id')
    ])
    setD({
      hubs: hubs.data || [], customers: customers.data || [], projects: projects.data || [],
      products: products.data || [], pp: pp.data || [], profiles: profiles.data || [],
      titles: titles.data || [], wt: wt.data || [], wr: wr.data || [],
      assigns: assigns.data || [], rates: rates.data || [],
      tasks: tasks.data || [], effort: effort.data || [], leaves: leaves.data || []
    })
  }

  async function run(promise, okMsg = 'Kaydedildi') {
    setMsg('')
    const { error } = await promise
    if (error) { setMsg('Hata: ' + error.message); return false }
    setMsg(okMsg); await yukle(); return true
  }

  if (!d) return <p>Yükleniyor…</p>

  const props = { d, run, setMsg }
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

      {tab === 'Müşteriler' && <Musteriler {...props} />}
      {tab === 'Projeler' && <Projeler {...props} />}
      {tab === 'Ekip' && <Ekip {...props} />}
      {tab === 'Atamalar' && <Atamalar {...props} />}
      {tab === 'Maliyet' && <Maliyet {...props} />}
      {tab === 'Listeler' && <Listeler {...props} />}
    </>
  )
}

// Ortak: satır içi düzenlenebilir ad
function DuzenlenebilirAd({ value, onSave }) {
  const [d, setD] = useState(false)
  const [v, setV] = useState(value)
  if (d) return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <input value={v} onChange={e => setV(e.target.value)} autoFocus style={{ maxWidth: 220 }} />
      <button className="btn sm" onClick={() => { onSave(v); setD(false) }}>✓</button>
      <button className="btn ghost sm" onClick={() => { setV(value); setD(false) }}>✕</button>
    </span>
  )
  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <strong>{value}</strong>
      <button className="btn ghost sm" onClick={() => setD(true)}>Düzenle</button>
    </span>
  )
}

function SilBtn({ bagliSayi, bagliMetin, onDelete }) {
  if (bagliSayi > 0) {
    return <button className="btn ghost sm" disabled title={bagliMetin} style={{ opacity: .5 }}>Sil</button>
  }
  return <button className="btn ghost sm" onClick={onDelete}>Sil</button>
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
          <thead><tr><th>Müşteri</th><th>Hub</th><th>Proje sayısı</th><th></th></tr></thead>
          <tbody>
            {d.customers.map(c => {
              const projeSayi = d.projects.filter(p => p.customer_id === c.id).length
              return (
                <tr key={c.id}>
                  <td><DuzenlenebilirAd value={c.ad} onSave={v => run(supabase.from('customers').update({ ad: v }).eq('id', c.id), 'Güncellendi')} /></td>
                  <td><span className="hub-dot" style={{ background: c.hubs.renk, marginRight: 6 }} />{c.hubs.ad}</td>
                  <td>{projeSayi}</td>
                  <td style={{ textAlign: 'right' }}>
                    <SilBtn bagliSayi={projeSayi} bagliMetin={`${projeSayi} projesi var, önce onları kaldırın`}
                      onDelete={() => run(supabase.from('customers').delete().eq('id', c.id), 'Silindi')} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Projeler({ d, run }) {
  const [yeni, setYeni] = useState({ ad: '', customer_id: '', urunler: [] })
  const [duzenle, setDuzenle] = useState(null) // {id, ad, urunler}

  const urunToggle = (setter, obj, uid) => setter({
    ...obj, urunler: obj.urunler.includes(uid) ? obj.urunler.filter(x => x !== uid) : [...obj.urunler, uid]
  })

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

  async function duzenleKaydet() {
    await supabase.from('projects').update({ ad: duzenle.ad }).eq('id', duzenle.id)
    // ürün etiketlerini senkronla: hepsini sil, yeniden ekle
    await supabase.from('project_products').delete().eq('project_id', duzenle.id)
    if (duzenle.urunler.length) {
      await supabase.from('project_products').insert(duzenle.urunler.map(u => ({ project_id: duzenle.id, product_id: u })))
    }
    await run(Promise.resolve({ error: null }), 'Proje güncellendi')
    setDuzenle(null)
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
              <input type="checkbox" style={{ width: 'auto' }} checked={yeni.urunler.includes(u.id)} onChange={() => urunToggle(setYeni, yeni, u.id)} />
              {u.ad}
            </label>
          ))}
          <button className="btn" style={{ marginLeft: 'auto' }} disabled={!yeni.ad || !yeni.customer_id} onClick={ekle}>Ekle</button>
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Proje</th><th>Müşteri</th><th>Ürünler</th><th>Durum</th><th></th></tr></thead>
          <tbody>
            {d.projects.map(p => {
              const urunler = d.pp.filter(x => x.project_id === p.id)
              const isSayi = d.tasks.filter(t => t.project_id === p.id).length
              const eforSayi = d.effort.filter(e => e.project_id === p.id).length
              const bagli = isSayi + eforSayi
              return (
                <tr key={p.id}>
                  <td><strong>{p.ad}</strong></td>
                  <td>{p.customers.ad}</td>
                  <td>{urunler.map(x => d.products.find(u => u.id === x.product_id)?.ad).join(', ') || '—'}</td>
                  <td>
                    <button className="btn ghost sm"
                      onClick={() => run(supabase.from('projects').update({ aktif: !p.aktif }).eq('id', p.id))}>
                      {p.aktif ? 'Aktif' : 'Pasif'}
                    </button>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn ghost sm"
                      onClick={() => setDuzenle({ id: p.id, ad: p.ad, urunler: urunler.map(x => x.product_id) })}>Düzenle</button>{' '}
                    <SilBtn bagliSayi={bagli} bagliMetin={`${isSayi} iş, ${eforSayi} efor kaydı var; önce onları kaldırın`}
                      onDelete={() => run(supabase.from('projects').delete().eq('id', p.id), 'Silindi')} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {duzenle && (
        <div className="modal-bg" onClick={() => setDuzenle(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Projeyi düzenle</h2>
            <div className="field">
              <label>Proje adı</label>
              <input value={duzenle.ad} onChange={e => setDuzenle({ ...duzenle, ad: e.target.value })} autoFocus />
            </div>
            <div className="field">
              <label>Ürün etiketleri</label>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {d.products.map(u => (
                  <label key={u.id} style={{ display: 'flex', gap: 5, alignItems: 'center', margin: 0 }}>
                    <input type="checkbox" style={{ width: 'auto' }} checked={duzenle.urunler.includes(u.id)}
                      onChange={() => urunToggle(setDuzenle, duzenle, u.id)} />
                    {u.ad}
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setDuzenle(null)}>Vazgeç</button>
              <button className="btn" disabled={!duzenle.ad} onClick={duzenleKaydet}>Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Ekip({ d, run, setMsg }) {
  const bos = { ad: '', eposta: '', yetki_rolu: 'ekip', unvan_id: '', hub_id: '' }
  const [yeni, setYeni] = useState(bos)

  function hubYonUyari(hubId, hariçId = null) {
    if (!hubId) return null
    const mevcut = d.profiles.find(p => p.hub_id === hubId && p.yetki_rolu === 'hub_yon' && p.id !== hariçId)
    return mevcut
  }

  async function ekle() {
    const kayit = { ...yeni, unvan_id: yeni.unvan_id || null, hub_id: yeni.hub_id || null }
    // hub yöneticisi çakışma uyarısı
    if (kayit.yetki_rolu === 'hub_yon') {
      const mevcut = hubYonUyari(kayit.hub_id)
      if (mevcut && !confirm(`Bu hub'ın zaten yöneticisi var: ${mevcut.ad}. Yine de bu kişiyi de hub yöneticisi yapmak istiyor musunuz?`)) return
    }
    if (await run(supabase.from('profiles').insert(kayit), 'Kişi eklendi')) setYeni(bos)
  }

  function erisimDurum(p) {
    if (p.auth_user_id) return <span className="chip ok">Aktif</span>
    if (p.davet_edildi) return <span className="chip warn">Davet edildi</span>
    return <span className="chip">Davet edilmedi</span>
  }

  const seciliHubYon = yeni.yetki_rolu === 'hub_yon' ? hubYonUyari(yeni.hub_id) : null

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <h2>Yeni kişi ekle</h2>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: -6 }}>
          Kişiyi giriş hesabı olmadan da ekleyebilirsiniz. Uygulamaya erişim vermek istediğinizde "Davet et" ile hesabını açarsınız;
          e-posta eşleşmesiyle bu kayıt otomatik bağlanır, atamalar korunur.
        </p>
        <div className="row" style={{ marginBottom: 10 }}>
          <input placeholder="Ad Soyad" value={yeni.ad} onChange={e => setYeni({ ...yeni, ad: e.target.value })} />
          <input placeholder="E-posta" type="email" value={yeni.eposta} onChange={e => setYeni({ ...yeni, eposta: e.target.value })} />
        </div>
        <div className="row">
          <select value={yeni.yetki_rolu} onChange={e => setYeni({ ...yeni, yetki_rolu: e.target.value })}>
            {Object.entries(ROLLER).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={yeni.unvan_id} onChange={e => setYeni({ ...yeni, unvan_id: e.target.value })}>
            <option value="">Unvan…</option>
            {d.titles.map(t => <option key={t.id} value={t.id}>{t.ad}</option>)}
          </select>
          <select value={yeni.hub_id} onChange={e => setYeni({ ...yeni, hub_id: e.target.value })}>
            <option value="">Hub… (yönetim için boş)</option>
            {d.hubs.map(h => <option key={h.id} value={h.id}>{h.ad}</option>)}
          </select>
          <button className="btn" disabled={!yeni.ad || !yeni.eposta} onClick={ekle}>Ekle</button>
        </div>
        {yeni.yetki_rolu === 'hub_yon' && yeni.hub_id && (
          <div className="msg ok" style={{ marginTop: 10 }}>
            {seciliHubYon
              ? `⚠ Bu hub'ın zaten yöneticisi var: ${seciliHubYon.ad}. Eklerseniz onay istenecek.`
              : `Bu kişi ${d.hubs.find(h => h.id === yeni.hub_id)?.ad} hub'ının yöneticisi olacak.`}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Kişi</th><th>Yetki</th><th>Unvan</th><th>Hub</th><th>Erişim</th><th></th></tr></thead>
          <tbody>
            {d.profiles.map(k => {
              const bagli = d.assigns.filter(a => a.user_id === k.id).length
                + d.effort.filter(e => e.user_id === k.id).length
                + d.leaves.filter(l => l.user_id === k.id).length
                + d.rates.filter(r => r.user_id === k.id).length
              return (
                <tr key={k.id}>
                  <td>
                    <input defaultValue={k.ad} placeholder="Ad Soyad" style={{ maxWidth: 170 }}
                      onBlur={e => e.target.value !== k.ad && run(supabase.from('profiles').update({ ad: e.target.value }).eq('id', k.id))} />
                    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{k.eposta}</div>
                  </td>
                  <td>
                    <select value={k.yetki_rolu}
                      onChange={e => run(supabase.from('profiles').update({ yetki_rolu: e.target.value }).eq('id', k.id))}>
                      {Object.entries(ROLLER).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    {k.yetki_rolu === 'hub_yon' && k.hub_id &&
                      <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>
                        {d.hubs.find(h => h.id === k.hub_id)?.ad} yöneticisi
                      </div>}
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
                  <td>{erisimDurum(k)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {!k.auth_user_id && (
                      <button className="btn ghost sm" title="Supabase panelinden davet gönderin"
                        onClick={() => setMsg(`Davet için Supabase → Authentication → Users → Invite user ile ${k.eposta} adresini davet edin. Kişi şifresini belirleyince bu kayıt otomatik bağlanır.`)}>
                        Davet et
                      </button>
                    )}{' '}
                    <SilBtn bagliSayi={bagli} bagliMetin={`Bu kişinin ${bagli} bağlı kaydı var (atama/efor/izin/oran)`}
                      onDelete={() => run(supabase.from('profiles').delete().eq('id', k.id), 'Silindi')} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Atamalar({ d, run }) {
  const [pid, setPid] = useState('')
  const [digerHub, setDigerHub] = useState(false)
  const atananlar = d.assigns.filter(a => a.project_id === pid)
  const proje = d.projects.find(p => p.id === pid)

  const listelenecek = proje
    ? d.profiles.filter(k => digerHub ? true : k.hub_id === proje.customers.hub_id)
    : []

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <label>Proje seçin</label>
        <select value={pid} onChange={e => { setPid(e.target.value); setDigerHub(false) }}>
          <option value="">Seçin…</option>
          {d.projects.filter(p => p.aktif).map(p => <option key={p.id} value={p.id}>{p.ad} — {p.customers.ad}</option>)}
        </select>
        {pid && (
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10, margin: 0 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={digerHub} onChange={e => setDigerHub(e.target.checked)} />
            Diğer hub'lardan da kişi göster (kaynak paylaşımı)
          </label>
        )}
      </div>
      {pid && (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Kişi</th><th>Kadro hub</th><th>Unvan</th><th>Atama</th><th>Proje lideri</th></tr></thead>
            <tbody>
              {listelenecek.map(k => {
                const atama = atananlar.find(a => a.user_id === k.id)
                const disHub = k.hub_id !== proje.customers.hub_id
                return (
                  <tr key={k.id}>
                    <td><strong>{k.ad || k.eposta}</strong></td>
                    <td style={{ color: disHub ? 'var(--warn)' : 'var(--ink-3)' }}>
                      {d.hubs.find(h => h.id === k.hub_id)?.ad || '—'}{disHub ? ' (dış)' : ''}
                    </td>
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
          Kişi listesi tüm ekipten gelir (davet edilmemiş kişiler dahil). Bu sekmeyi yalnızca Direktör ve GM görür.
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
    ['Unvanlar', 'job_titles', d.titles, p => d.profiles.filter(x => x.unvan_id === p.id).length, 'kişide kullanılıyor'],
    ['İş tipleri', 'work_types', d.wt, p => d.tasks.filter(x => x.is_tipi_id === p.id).length, 'işte kullanılıyor'],
    ['Beklemede nedenleri', 'waiting_reasons', d.wr, p => d.tasks.filter(x => x.beklemede_nedeni_id === p.id).length, 'işte kullanılıyor']
  ]
  const [yeniler, setYeniler] = useState({})
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
      {grup.map(([baslik, tablo, liste, sayac, birim]) => (
        <div key={tablo} className="card">
          <h2>{baslik}</h2>
          {liste.map(x => {
            const kullanim = sayac(x)
            return (
              <div key={x.id} className="person-row">
                <DuzenlenebilirAd value={x.ad} onSave={v => run(supabase.from(tablo).update({ ad: v }).eq('id', x.id), 'Güncellendi')} />
                <SilBtn bagliSayi={kullanim} bagliMetin={`${kullanim} ${birim}`}
                  onDelete={() => run(supabase.from(tablo).delete().eq('id', x.id), 'Silindi')} />
              </div>
            )
          })}
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
