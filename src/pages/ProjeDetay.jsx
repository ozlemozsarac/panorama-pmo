import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase, DURUMLAR, fmtTarih } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const BOS_KALEM = {
  baslik: '', durum: 'acik', sorumlu_id: '', termin: '', is_tipi_id: '',
  blokaj: false, blokaj_nedeni: '', kritik: false, beklemede_nedeni_id: '', notlar: ''
}

export default function ProjeDetay() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [proje, setProje] = useState(null)
  const [tasks, setTasks] = useState([])
  const [ekip, setEkip] = useState([])
  const [isTipleri, setIsTipleri] = useState([])
  const [nedenler, setNedenler] = useState([])
  const [filtre, setFiltre] = useState('acik-tumu')
  const [modal, setModal] = useState(null) // null | {…kalem}
  const [err, setErr] = useState('')

  useEffect(() => { yukle() }, [id])

  async function yukle() {
    const [{ data: p }, { data: t }, { data: wt }, { data: wr }] = await Promise.all([
      supabase.from('projects').select('id, ad, customers ( ad, hubs ( ad, renk ) ), project_assignments ( proje_lideri, profiles ( id, ad ) )').eq('id', id).single(),
      supabase.from('tasks').select('*, profiles!tasks_sorumlu_id_fkey ( ad ), work_types ( ad ), waiting_reasons ( ad )').eq('project_id', id).order('olusturma', { ascending: false }),
      supabase.from('work_types').select('*').order('sira'),
      supabase.from('waiting_reasons').select('*').order('sira')
    ])
    setProje(p)
    setTasks(t || [])
    setEkip(p?.project_assignments?.map(a => a.profiles).filter(Boolean) || [])
    setIsTipleri(wt || [])
    setNedenler(wr || [])
  }

  async function kaydet(e) {
    e.preventDefault()
    setErr('')
    const k = { ...modal, project_id: id }
    ;['sorumlu_id', 'is_tipi_id', 'beklemede_nedeni_id', 'termin'].forEach(f => { if (!k[f]) k[f] = null })
    if (k.durum !== 'beklemede') k.beklemede_nedeni_id = null
    if (!k.blokaj) k.blokaj_nedeni = null
    delete k.profiles; delete k.work_types; delete k.waiting_reasons
    delete k.olusturma; delete k.tamamlanma; delete k.olusturan_id

    const isNew = !k.id
    if (isNew) delete k.id
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

  if (!proje) return <p>Yükleniyor…</p>

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
        </div>
        <button className="btn" onClick={() => setModal({ ...BOS_KALEM, sorumlu_id: profile.id })}>+ İş kalemi</button>
      </div>

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
                <th style={{ width: '38%' }}>İş</th>
                <th>Sorumlu</th>
                <th>Durum</th>
                <th>Termin</th>
                <th>İşaretler</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {gorunen.map(t => {
                const gecikti = t.termin && t.durum !== 'tamamlandi' && new Date(t.termin) < new Date()
                return (
                  <tr key={t.id} className="clickable" onClick={() => setModal({
                    ...t,
                    sorumlu_id: t.sorumlu_id || '', termin: t.termin || '',
                    is_tipi_id: t.is_tipi_id || '', beklemede_nedeni_id: t.beklemede_nedeni_id || '',
                    blokaj_nedeni: t.blokaj_nedeni || '', notlar: t.notlar || ''
                  })}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{t.baslik}</div>
                      {t.work_types && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t.work_types.ad}</div>}
                    </td>
                    <td>{t.profiles?.ad || '—'}</td>
                    <td>
                      <span className={'chip' + (t.durum === 'tamamlandi' ? ' ok' : '')}>{DURUMLAR[t.durum]}</span>
                      {t.durum === 'beklemede' && t.waiting_reasons &&
                        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{t.waiting_reasons.ad}</div>}
                    </td>
                    <td style={gecikti ? { color: 'var(--danger)', fontWeight: 500 } : {}}>{fmtTarih(t.termin)}</td>
                    <td>
                      {t.blokaj && <span className="chip danger" title={t.blokaj_nedeni || ''}>Blokaj</span>}{' '}
                      {t.kritik && <span className="chip warn">Kritik</span>}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      {t.durum !== 'tamamlandi' &&
                        <button className="btn ghost sm" onClick={() => hizliDurum(t, 'tamamlandi')}>Tamamla</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

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
              <div className="row">
                <div className="field">
                  <label>Durum</label>
                  <select value={modal.durum} onChange={e => setModal({ ...modal, durum: e.target.value })}>
                    {Object.entries(DURUMLAR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Termin</label>
                  <input type="date" value={modal.termin} onChange={e => setModal({ ...modal, termin: e.target.value })} />
                </div>
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
    </>
  )
}
