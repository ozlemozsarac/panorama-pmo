import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase, DURUMLAR, URUN_DURUMLARI, URUN_DURUM_RENK, fmtTarih, isoDate, urunChip, SAGLIK_KANALLARI, SAGLIK_SKORLARI, ceyrek, ceyrekKaydir, ceyrekEtiket } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import EforModal from '../components/EforModal'

const BOS_KALEM = {
  baslik: '', durum: 'acik', sorumlu_id: '', baslangic_tarihi: '', bitis_tarihi: '',
  is_tipi_id: '', product_id: '', blokaj: false, blokaj_nedeni: '', kritik: false,
  beklemede_nedeni_id: '', notlar: ''
}

export default function ProjeDetay() {
  const { id } = useParams()
  const { profile, seesAll, isHubYon, kisitliGorunum, kanalim } = useAuth()
  const [proje, setProje] = useState(null)
  const [tasks, setTasks] = useState([])
  const [ekip, setEkip] = useState([])
  const [urunler, setUrunler] = useState([])       // projedeki ürünler (durumlu)
  const [isTipleri, setIsTipleri] = useState([])
  const [nedenler, setNedenler] = useState([])
  const [eforlar, setEforlar] = useState([])       // bu projedeki tüm efor kayıtları
  const [filtre, setFiltre] = useState('acik-tumu')
  const [modal, setModal] = useState(null)
  const [eforModal, setEforModal] = useState(null) // efor girilecek iş kalemi (task)
  const [silModal, setSilModal] = useState(null)   // silinecek iş kalemi
  const [err, setErr] = useState('')

  useEffect(() => { yukle() }, [id])

  async function yukle() {
    const [{ data: p }, { data: t }, { data: wt }, { data: wr }, { data: pp }, { data: ef }] = await Promise.all([
      supabase.from('projects').select('id, ad, klasor_linki, customers ( ad, hub_id, hubs ( ad, renk ) ), project_assignments ( proje_lideri, profiles ( id, ad ) )').eq('id', id).single(),
      supabase.from('tasks').select('*, profiles!tasks_sorumlu_id_fkey ( ad ), work_types ( ad ), waiting_reasons ( ad ), products ( ad )').eq('project_id', id).order('olusturma', { ascending: false }),
      supabase.from('work_types').select('*').order('sira'),
      supabase.from('waiting_reasons').select('*').order('sira'),
      supabase.from('project_products').select('*, products ( id, ad )').eq('project_id', id),
      supabase.from('effort_entries').select('*').eq('project_id', id)
    ])
    setProje(p)
    setTasks(t || [])
    setEkip(p?.project_assignments?.map(a => a.profiles).filter(Boolean) || [])
    setIsTipleri(wt || [])
    setNedenler(wr || [])
    setUrunler(pp || [])
    setEforlar(ef || [])
  }

  async function urunDurumGuncelle(ppRow, durum) {
    await supabase.from('project_products').update({ durum }).eq('project_id', id).eq('product_id', ppRow.product_id)
    yukle()
  }

  async function urunVersiyonGuncelle(ppRow, versiyon) {
    await supabase.from('project_products').update({ versiyon: versiyon || null }).eq('project_id', id).eq('product_id', ppRow.product_id)
    yukle()
  }

  async function klasorGuncelle(link) {
    await supabase.from('projects').update({ klasor_linki: link || null }).eq('id', id)
    yukle()
  }

  async function kaydet(e) {
    e.preventDefault()
    setErr('')
    const k = { ...modal, project_id: id }
    ;['sorumlu_id', 'is_tipi_id', 'beklemede_nedeni_id', 'baslangic_tarihi', 'bitis_tarihi', 'product_id'].forEach(f => { if (!k[f]) k[f] = null })
    if (k.durum !== 'beklemede') k.beklemede_nedeni_id = null
    if (!k.blokaj) k.blokaj_nedeni = null
    // proje tek ürünlüyse ürünü otomatik ata
    if (!k.product_id && urunler.length === 1) k.product_id = urunler[0].product_id
    ;['profiles', 'work_types', 'waiting_reasons', 'products', 'olusturma', 'tamamlanma', 'olusturan_id'].forEach(f => delete k[f])

    const isNew = !k.id
    if (isNew) { delete k.id; k.olusturan_id = profile.id }
    const { error } = isNew
      ? await supabase.from('tasks').insert(k)
      : await supabase.from('tasks').update(k).eq('id', modal.id)
    if (error) { setErr('Kaydedilemedi: ' + error.message); return }
    setModal(null)
    yukle()
  }

  async function hizliDurum(t, durum) {
    await supabase.from('tasks').update({ durum }).eq('id', t.id)
    yukle()
  }

  function taskEfor(taskId) {
    return eforlar.filter(e => e.task_id === taskId).reduce((s, e) => s + Number(e.saat), 0)
  }

  // İş kalemini sil — efor girilmişse engellenir (hem burada hem RLS'te)
  async function sil() {
    if (!silModal) return
    if (taskEfor(silModal.id) > 0) {
      setErr('Bu kaleme efor girilmiş, silinemez. Önce efor kayıtlarını temizleyin.')
      setSilModal(null)
      return
    }
    const { error } = await supabase.from('tasks').delete().eq('id', silModal.id)
    if (error) { setErr('Silinemedi: ' + error.message); setSilModal(null); return }
    setSilModal(null)
    yukle()
  }

  if (!proje) return <p>Yükleniyor…</p>

  // --- M3: Tamamla/Sil yetkisi (Seçenek C) ---
  // Yetkili = oluşturan VEYA sorumlu VEYA proje lideri; artı PMO (direktör/GM)
  // ve projenin hub yöneticisi her zaman yönetebilir.
  const projeLiderIdleri = (proje.project_assignments || [])
    .filter(a => a.proje_lideri).map(a => a.profiles?.id).filter(Boolean)
  const projeLideriMiyim = projeLiderIdleri.includes(profile.id)
  const hubYoneticisiyim = isHubYon && profile.hub_id === proje.customers?.hub_id
  const yetkiliMi = t =>
    seesAll || hubYoneticisiyim ||
    t.olusturan_id === profile.id ||
    t.sorumlu_id === profile.id ||
    projeLideriMiyim

  const acikler = tasks.filter(t => t.durum !== 'tamamlandi')
  const gorunen = tasks.filter(t => {
    if (filtre === 'acik-tumu') return t.durum !== 'tamamlandi'
    if (filtre === 'blokaj') return t.blokaj && t.durum !== 'tamamlandi'
    if (filtre === 'kritik') return t.kritik && t.durum !== 'tamamlandi'
    if (filtre === 'tumu') return true
    return t.durum === filtre
  })

  return (
    <>
      <div className="page-head">
        <div>
          <div style={{ fontSize: 13, marginBottom: 4 }}><Link to="/projeler">← Projeler</Link></div>
          <h1>{proje.ad}</h1>
          <p>
            {proje.customers.ad} ·{' '}
            <span className="hub-dot" style={{ background: proje.customers.hubs.renk }} /> {proje.customers.hubs.ad}
            {ekip.length > 0 && <> · Ekip: {ekip.map(e => e.ad).join(', ')}</>}
          </p>
          <KlasorLink link={proje.klasor_linki} onSave={klasorGuncelle} />
        </div>
        {!kisitliGorunum &&
          <button className="btn" onClick={() => setModal({ ...BOS_KALEM, sorumlu_id: profile.id })}>+ İş kalemi</button>}
      </div>

      {/* İLİŞKİ SAĞLIĞI — künyenin hemen altında, herkese görünür */}
      <IliskiSagligi projectId={id} kanalim={kanalim} seesAll={seesAll} girenId={profile.id} />

      {/* CS/Satış: iş kalemleri, efor ve ürün durumları KAPALI. Burada bitiyor. */}
      {kisitliGorunum ? null : (
      <>
      {/* ÜRÜN DURUMLARI ŞERİDİ */}
      {urunler.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 10 }}>Ürün durumları</div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {urunler.map(pp => {
              const renk = pp.durum ? URUN_DURUM_RENK[pp.durum] : { bg: 'var(--card)', fg: 'var(--ink-3)' }
              return (
                <div key={pp.product_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 500, minWidth: 64 }}>{pp.products.ad}</span>
                  <select value={pp.durum || ''} onChange={e => urunDurumGuncelle(pp, e.target.value)}
                    style={{ width: 'auto', background: renk.bg, color: renk.fg, fontSize: 13, padding: '5px 12px' }}>
                    <option value="">Belirlenmedi</option>
                    {Object.entries(URUN_DURUMLARI).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <VersiyonKutu deger={pp.versiyon} onSave={v => urunVersiyonGuncelle(pp, v)} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="filters">
        {[
          ['acik-tumu', `Açık işler (${acikler.length})`],
          ['blokaj', `Bloklu (${acikler.filter(t => t.blokaj).length})`],
          ['kritik', `Kritik (${acikler.filter(t => t.kritik).length})`],
          ['beklemede', 'Beklemede'],
          ['tamamlandi', 'Tamamlanan'],
          ['tumu', 'Tümü']
        ].map(([v, l]) => (
          <button key={v} className={'filter-chip' + (filtre === v ? ' active' : '')} onClick={() => setFiltre(v)}>{l}</button>
        ))}
      </div>

      {gorunen.length === 0 ? (
        <div className="empty">
          <strong>Bu görünümde iş kalemi yok</strong>
          İlk kalemi eklemek için sağ üstteki düğmeyi kullanın.
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: '32%' }}>İş</th>
                <th>Ürün</th>
                <th>Sorumlu</th>
                <th>Durum</th>
                <th>Tarih</th>
                <th>Efor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {gorunen.map(t => {
                const gecikti = t.bitis_tarihi && t.durum !== 'tamamlandi' && new Date(t.bitis_tarihi) < new Date()
                const saat = taskEfor(t.id)
                return (
                  <tr key={t.id} className="clickable" onClick={() => setModal({
                    ...t,
                    sorumlu_id: t.sorumlu_id || '', baslangic_tarihi: t.baslangic_tarihi || '', bitis_tarihi: t.bitis_tarihi || '',
                    is_tipi_id: t.is_tipi_id || '', beklemede_nedeni_id: t.beklemede_nedeni_id || '', product_id: t.product_id || '',
                    blokaj_nedeni: t.blokaj_nedeni || '', notlar: t.notlar || ''
                  })}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{t.baslik}</div>
                      {t.work_types && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t.work_types.ad}</div>}
                    </td>
                    <td>{t.products ? <span className={urunChip(t.products.ad)}>{t.products.ad}</span> : "—"}</td>
                    <td>{t.profiles?.ad || '—'}</td>
                    <td>
                      <span className={'chip' + (t.durum === 'tamamlandi' ? ' ok' : '')}>{DURUMLAR[t.durum]}</span>
                      {t.durum === 'beklemede' && t.waiting_reasons &&
                        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{t.waiting_reasons.ad}</div>}
                    </td>
                    <td style={gecikti ? { color: 'var(--danger)', fontWeight: 500 } : {}}>
                      {t.baslangic_tarihi ? fmtTarih(t.baslangic_tarihi) : '—'}
                      {t.bitis_tarihi && <> → {fmtTarih(t.bitis_tarihi)}</>}
                      <div style={{ marginTop: 3 }}>
                        {t.blokaj && <span className="chip danger" title={t.blokaj_nedeni || ''}>Blokaj</span>}{' '}
                        {t.kritik && <span className="chip warn">Kritik</span>}
                      </div>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="btn ghost sm" onClick={() => setEforModal(t)}>
                        {saat > 0 ? saat + ' saat' : 'Efor ekle'}
                      </button>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {t.durum !== 'tamamlandi' && yetkiliMi(t) &&
                          <button className="btn ghost sm" onClick={() => hizliDurum(t, 'tamamlandi')}>Tamamla</button>}
                        {yetkiliMi(t) && (
                          <button
                            className="btn ghost sm"
                            disabled={saat > 0}
                            title={saat > 0 ? 'Efor girilmiş kalem silinemez — önce efor kayıtlarını temizleyin' : 'İş kalemini sil'}
                            style={saat > 0 ? {} : { color: 'var(--danger)' }}
                            onClick={() => setSilModal(t)}
                          >Sil</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      </>
      )}

      {/* SİLME ONAY MODALI */}
      {silModal && (
        <div className="modal-bg" onClick={() => setSilModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h2>İş kalemini sil</h2>
            <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--ink)' }}>{silModal.baslik}</strong> kalemi silinecek.
              Bu işlem geri alınamaz.
            </p>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setSilModal(null)}>Vazgeç</button>
              <button className="btn danger" onClick={sil}>Sil</button>
            </div>
          </div>
        </div>
      )}

      {/* İŞ KALEMİ MODAL */}
      {modal && (
        <div className="modal-bg" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{modal.id ? 'İş kalemini düzenle' : 'Yeni iş kalemi'}</h2>
            <form onSubmit={kaydet}>
              <div className="field">
                <label>Başlık</label>
                <input value={modal.baslik} onChange={e => setModal({ ...modal, baslik: e.target.value })} required autoFocus />
              </div>
              <div className="row">
                <div className="field">
                  <label>Sorumlu</label>
                  <select value={modal.sorumlu_id} onChange={e => setModal({ ...modal, sorumlu_id: e.target.value })}>
                    <option value="">Seçin…</option>
                    {ekip.map(e => <option key={e.id} value={e.id}>{e.ad}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>İş tipi</label>
                  <select value={modal.is_tipi_id} onChange={e => setModal({ ...modal, is_tipi_id: e.target.value })}>
                    <option value="">Seçin…</option>
                    {isTipleri.map(t => <option key={t.id} value={t.id}>{t.ad}</option>)}
                  </select>
                </div>
              </div>
              {urunler.length > 1 && (
                <div className="field">
                  <label>Ürün</label>
                  <select value={modal.product_id} onChange={e => setModal({ ...modal, product_id: e.target.value })}>
                    <option value="">Seçin…</option>
                    {urunler.map(pp => <option key={pp.product_id} value={pp.product_id}>{pp.products.ad}</option>)}
                  </select>
                </div>
              )}
              <div className="row">
                <div className="field">
                  <label>Başlangıç tarihi</label>
                  <input type="date" value={modal.baslangic_tarihi} onChange={e => setModal({ ...modal, baslangic_tarihi: e.target.value })} />
                </div>
                <div className="field">
                  <label>Bitiş tarihi</label>
                  <input type="date" value={modal.bitis_tarihi} onChange={e => setModal({ ...modal, bitis_tarihi: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label>Durum</label>
                <select value={modal.durum} onChange={e => setModal({ ...modal, durum: e.target.value })}>
                  {Object.entries(DURUMLAR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              {modal.durum === 'beklemede' && (
                <div className="field">
                  <label>Beklemede nedeni</label>
                  <select value={modal.beklemede_nedeni_id} onChange={e => setModal({ ...modal, beklemede_nedeni_id: e.target.value })} required>
                    <option value="">Seçin…</option>
                    {nedenler.map(n => <option key={n.id} value={n.id}>{n.ad}</option>)}
                  </select>
                </div>
              )}
              <div className="row">
                <div className="field">
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="checkbox" style={{ width: 'auto' }} checked={modal.blokaj}
                      onChange={e => setModal({ ...modal, blokaj: e.target.checked })} /> Blokaj var
                  </label>
                </div>
                <div className="field">
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="checkbox" style={{ width: 'auto' }} checked={modal.kritik}
                      onChange={e => setModal({ ...modal, kritik: e.target.checked })} /> Kritik
                  </label>
                </div>
              </div>
              {modal.blokaj && (
                <div className="field">
                  <label>Blokaj nedeni</label>
                  <input value={modal.blokaj_nedeni} onChange={e => setModal({ ...modal, blokaj_nedeni: e.target.value })}
                    placeholder="Neyi bekliyoruz?" required />
                </div>
              )}
              <div className="field">
                <label>Not</label>
                <textarea rows={2} value={modal.notlar} onChange={e => setModal({ ...modal, notlar: e.target.value })} />
              </div>
              {err && <div className="msg err">{err}</div>}
              <div className="modal-actions">
                <button type="button" className="btn ghost" onClick={() => setModal(null)}>Vazgeç</button>
                <button className="btn">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EFOR EKLE MODAL — paylaşılan bileşen (M5) */}
      {eforModal && (
        <EforModal
          task={eforModal}
          girenId={profile.id}
          onClose={() => setEforModal(null)}
          onSaved={yukle}
        />
      )}
    </>
  )
}

// Proje klasörü linki: göster + düzenle (PM dahil)
function KlasorLink({ link, onSave }) {
  const [d, setD] = useState(false)
  const [v, setV] = useState(link || '')
  if (d) return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
      <input value={v} onChange={e => setV(e.target.value)} placeholder="https://drive.google.com/..." autoFocus style={{ maxWidth: 380 }} />
      <button className="btn sm" onClick={() => { onSave(v); setD(false) }}>Kaydet</button>
      <button className="btn ghost sm" onClick={() => { setV(link || ''); setD(false) }}>İptal</button>
    </div>
  )
  return (
    <div style={{ marginTop: 6, fontSize: 13.5 }}>
      {link
        ? <>📁 <a href={link} target="_blank" rel="noreferrer">Proje dokümanları</a> <button className="btn ghost sm" onClick={() => setD(true)}>Değiştir</button></>
        : <button className="btn ghost sm" onClick={() => setD(true)}>+ Proje klasörü linki ekle</button>}
    </div>
  )
}

// Ürün versiyon kutusu: satır içi, onBlur ile kaydeder
function VersiyonKutu({ deger, onSave }) {
  const [v, setV] = useState(deger || '')
  return (
    <input value={v} onChange={e => setV(e.target.value)}
      onBlur={() => v !== (deger || '') && onSave(v)}
      placeholder="Versiyon"
      style={{ width: 130, fontSize: 12.5, fontFamily: "'IBM Plex Mono', monospace", padding: '5px 10px' }} />
  )
}

// ============================================================
// İLİŞKİ SAĞLIĞI — 3 kanallı skor (PM / CS / Satış)
// Genel durum = en kötü kanal. Kanallar uyuşmuyorsa bayrak.
// Herkes üç kanalı görür; yalnızca kendi kanalını (kanalim) düzenler.
// ============================================================
function IliskiSagligi({ projectId, kanalim, seesAll, girenId }) {
  const [donem, setDonem] = useState(ceyrek())
  const [kayitlar, setKayitlar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [taslak, setTaslak] = useState({ skor: null, kok_neden: '' })
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [hata, setHata] = useState('')

  useEffect(() => { yukle() }, [projectId, donem])

  async function yukle() {
    setYukleniyor(true)
    const { data } = await supabase
      .from('project_health')
      .select('*, profiles!project_health_giren_id_fkey ( ad )')
      .eq('project_id', projectId)
      .eq('donem', donem)
    const rows = data || []
    setKayitlar(rows)
    const benim = rows.find(r => r.kanal === kanalim)
    setTaslak({ skor: benim?.skor ?? null, kok_neden: benim?.kok_neden ?? '' })
    setYukleniyor(false)
  }

  const kanalKaydi = k => kayitlar.find(r => r.kanal === k)
  const girilenSkorlar = kayitlar.map(r => r.skor)
  const enKotu = girilenSkorlar.length ? Math.min(...girilenSkorlar) : null
  const uyusmazlik = girilenSkorlar.length >= 2 && (Math.max(...girilenSkorlar) - Math.min(...girilenSkorlar) >= 2)

  async function kaydet() {
    if (!taslak.skor) { setHata('Önce bir skor seç.'); return }
    setKaydediliyor(true); setHata('')
    const { error } = await supabase.from('project_health').upsert({
      project_id: projectId,
      kanal: kanalim,
      donem,
      skor: taslak.skor,
      kok_neden: taslak.kok_neden || null,
      giren_id: girenId,
      guncelleme: new Date().toISOString()
    }, { onConflict: 'project_id,kanal,donem' })
    setKaydediliyor(false)
    if (error) { setHata('Kaydedilemedi: ' + error.message); return }
    yukle()
  }

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0 }}>İlişki Sağlığı</h2>
          {enKotu != null && (
            <span className={'chip skor-' + enKotu}>Genel: {SAGLIK_SKORLARI[enKotu].etiket}</span>
          )}
          {uyusmazlik && (
            <span className="uyusmazlik">⚠ Kanallar arası fark</span>
          )}
        </div>
        <div className="week-nav" style={{ gap: 8 }}>
          <button className="btn ghost sm" onClick={() => setDonem(ceyrekKaydir(donem, -1))}>←</button>
          <span style={{ fontSize: 13, minWidth: 110, textAlign: 'center' }}>{ceyrekEtiket(donem)}</span>
          <button className="btn ghost sm" onClick={() => setDonem(ceyrekKaydir(donem, 1))} disabled={donem === ceyrek()}>→</button>
        </div>
      </div>

      {yukleniyor ? <p style={{ color: 'var(--ink-3)' }}>Yükleniyor…</p> : (
        <>
          {/* ÜÇ KANAL */}
          <div>
            {['pm', 'cs', 'satis'].map(k => {
              const r = kanalKaydi(k)
              return (
                <div className="kanal-satir" key={k}>
                  <div className="kanal-ad">
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{SAGLIK_KANALLARI[k]}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                      {r ? `${r.profiles?.ad || '—'} · ${fmtTarih(isoDate(new Date(r.guncelleme)))}` : '—'}
                    </div>
                  </div>
                  <div className="kanal-skor">
                    {r
                      ? <span className={'chip skor-' + r.skor}>{r.skor} · {SAGLIK_SKORLARI[r.skor].etiket}</span>
                      : <span className="chip" style={{ color: 'var(--ink-3)' }}>Girilmedi</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5, flex: 1 }}>
                    {r?.kok_neden || <span style={{ color: 'var(--ink-3)', fontStyle: 'italic' }}>Açıklama girilmedi</span>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* GİRİŞ PANELİ — yalnızca kendi kanalın */}
          <div style={{ background: 'var(--detay)', border: '1px solid var(--line)', borderRadius: 10, padding: 14, marginTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>
              Senin değerlendirmen <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>· {SAGLIK_KANALLARI[kanalim]} · {ceyrekEtiket(donem)}</span>
            </div>
            <div className="skor-sec" style={{ marginBottom: 12 }}>
              {[1, 2, 3, 4].map(s => (
                <button
                  key={s}
                  className={'skor-btn' + (taslak.skor === s ? ' on-' + s : '')}
                  title={SAGLIK_SKORLARI[s].aciklama}
                  onClick={() => setTaslak({ ...taslak, skor: s })}
                >{s} · {SAGLIK_SKORLARI[s].etiket}{taslak.skor === s ? ' ✓' : ''}</button>
              ))}
            </div>
            <div className="field">
              <label>Kök neden / açıklama</label>
              <textarea
                rows={2}
                placeholder="Bu skoru neden verdin? (opsiyonel ama önerilir)"
                value={taslak.kok_neden}
                onChange={e => setTaslak({ ...taslak, kok_neden: e.target.value })}
              />
            </div>
            {hata && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '4px 0' }}>{hata}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn" onClick={kaydet} disabled={kaydediliyor}>
                {kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
