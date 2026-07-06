import { useEffect, useState } from 'react'
import { supabase, IZIN_TIPLERI, fmtTarih, isoDate } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const BOS = { baslangic: '', bitis: '', tip: 'yillik', aciklama: '' }

export default function Izin() {
  const { profile } = useAuth()
  const [benim, setBenim] = useState([])
  const [takim, setTakim] = useState([])
  const [modal, setModal] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => { yukle() }, [])

  async function yukle() {
    const bugun = isoDate(new Date())
    const [{ data: b }, { data: t }] = await Promise.all([
      supabase.from('leaves').select('*').eq('user_id', profile.id).order('baslangic', { ascending: false }),
      supabase.from('leaves').select('*, profiles ( ad, hubs ( ad, renk ) )')
        .gte('bitis', bugun).neq('user_id', profile.id).order('baslangic').limit(30)
    ])
    setBenim(b || [])
    setTakim(t || [])
  }

  async function kaydet(e) {
    e.preventDefault(); setErr('')
    const k = { ...modal, user_id: profile.id }
    if (!k.aciklama) k.aciklama = null
    const isNew = !k.id
    if (isNew) delete k.id
    const { error } = isNew
      ? await supabase.from('leaves').insert(k)
      : await supabase.from('leaves').update(k).eq('id', modal.id)
    if (error) { setErr('Kaydedilemedi: ' + error.message); return }
    setModal(null); yukle()
  }

  async function sil(id) {
    await supabase.from('leaves').delete().eq('id', id)
    yukle()
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>İzinler</h1>
          <p>Kendi izinlerinizi girin; ekibinizin yaklaşan izinlerini görün.</p>
        </div>
        <button className="btn" onClick={() => setModal({ ...BOS })}>+ İzin ekle</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)' }}>
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 16px 0' }}><h2>İzinlerim</h2></div>
          {benim.length === 0 ? (
            <div className="empty" style={{ margin: 16 }}>
              <strong>Kayıtlı izniniz yok</strong>Planlı izinlerinizi girerseniz kaynak görünümü doğru çalışır.
            </div>
          ) : (
            <table>
              <thead><tr><th>Tarih</th><th>Tip</th><th>Açıklama</th><th></th></tr></thead>
              <tbody>
                {benim.map(i => (
                  <tr key={i.id}>
                    <td>{fmtTarih(i.baslangic)} – {fmtTarih(i.bitis)}</td>
                    <td><span className="chip">{IZIN_TIPLERI[i.tip]}</span></td>
                    <td style={{ color: 'var(--ink-3)' }}>{i.aciklama || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn ghost sm" onClick={() => setModal({ ...i, aciklama: i.aciklama || '' })}>Düzenle</button>{' '}
                      <button className="btn ghost sm" onClick={() => sil(i.id)}>Sil</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 16px 0' }}><h2>Ekipte yaklaşan izinler</h2></div>
          {takim.length === 0 ? (
            <div className="empty" style={{ margin: 16 }}>
              <strong>Yaklaşan izin yok</strong>Ekibiniz izin girdikçe burada görünecek.
            </div>
          ) : (
            <table>
              <thead><tr><th>Kişi</th><th>Tarih</th><th>Tip</th></tr></thead>
              <tbody>
                {takim.map(i => (
                  <tr key={i.id}>
                    <td>
                      {i.profiles?.hubs && <span className="hub-dot" style={{ background: i.profiles.hubs.renk, marginRight: 7 }} />}
                      {i.profiles?.ad || '—'}
                    </td>
                    <td>{fmtTarih(i.baslangic)} – {fmtTarih(i.bitis)}</td>
                    <td><span className="chip">{IZIN_TIPLERI[i.tip]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <div className="modal-bg" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{modal.id ? 'İzni düzenle' : 'Yeni izin'}</h2>
            <form onSubmit={kaydet}>
              <div className="row">
                <div className="field">
                  <label>Başlangıç</label>
                  <input type="date" value={modal.baslangic} onChange={e => setModal({ ...modal, baslangic: e.target.value })} required />
                </div>
                <div className="field">
                  <label>Bitiş</label>
                  <input type="date" value={modal.bitis} onChange={e => setModal({ ...modal, bitis: e.target.value })} required />
                </div>
              </div>
              <div className="field">
                <label>Tip</label>
                <select value={modal.tip} onChange={e => setModal({ ...modal, tip: e.target.value })}>
                  {Object.entries(IZIN_TIPLERI).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Açıklama (opsiyonel)</label>
                <input value={modal.aciklama} onChange={e => setModal({ ...modal, aciklama: e.target.value })} />
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
