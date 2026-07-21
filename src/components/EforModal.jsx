import { useEffect, useState } from 'react'
import { supabase, fmtTarih, haftaBasi, isoDate, parseISO } from '../lib/supabase'

// ============================================================
// PAYLAŞILAN EFOR MODALI (M5)
// İki yerden açılır: ProjeDetay iş kalemi satırı + İşlerim tezgahı.
// Kendi efor kayıtlarını task_id'ye göre çeker; parent'a veri bağımlılığı yok.
// props:
//   task     — { id, baslik, project_id, product_id }
//   girenId  — eforu giren kişinin profiles.id'si (user_id)
//   onClose  — modalı kapat
//   onSaved  — kayıt sonrası parent listelerini tazelemek için (opsiyonel)
// ============================================================
export default function EforModal({ task, girenId, onClose, onSaved }) {
  const [eforlar, setEforlar] = useState([])
  const [hafta, setHafta] = useState(isoDate(haftaBasi()))
  const [saat, setSaat] = useState('')
  const [yukleniyor, setYukleniyor] = useState(true)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [hata, setHata] = useState('')

  useEffect(() => { yukle() }, [task.id])

  async function yukle() {
    setYukleniyor(true)
    const { data, error } = await supabase
      .from('effort_entries')
      .select('*')
      .eq('task_id', task.id)
    if (error) { setHata('Efor yüklenemedi: ' + error.message); setEforlar([]); setYukleniyor(false); return }
    setHata('')
    setEforlar(data || [])
    setYukleniyor(false)
  }

  const mevcutlar = [...eforlar].sort((a, b) => a.hafta_baslangici.localeCompare(b.hafta_baslangici))
  const mevcutSaat = eforlar.find(e => e.hafta_baslangici === hafta)?.saat
  const hs = parseISO(hafta); const he = parseISO(hafta); he.setDate(he.getDate() + 6)

  function haftaKaydir(n) {
    const d = parseISO(hafta); d.setDate(d.getDate() + 7 * n); setHafta(isoDate(haftaBasi(d)))
  }

  async function kaydet() {
    const v = parseFloat(String(saat).replace(',', '.'))
    const mevcut = eforlar.find(e => e.hafta_baslangici === hafta)
    setKaydediliyor(true); setHata('')
    let error = null
    if (!v || v <= 0) {
      // 0/boş → mevcut kayıt varsa sil, yoksa hiçbir şey yapma
      if (mevcut) ({ error } = await supabase.from('effort_entries').delete().eq('id', mevcut.id))
    } else if (mevcut) {
      ({ error } = await supabase.from('effort_entries').update({ saat: v }).eq('id', mevcut.id))
    } else {
      ({ error } = await supabase.from('effort_entries').insert({
        user_id: girenId,
        project_id: task.project_id,
        task_id: task.id,
        hafta_baslangici: hafta,
        saat: v,
        product_id: task.product_id ?? null
      }))
    }
    setKaydediliyor(false)
    if (error) { setHata('Efor kaydedilemedi: ' + error.message); return }
    setSaat('')
    await yukle()           // modal açık kalır → çoklu hafta girişi kolay
    onSaved && onSaved()    // parent listelerini tazele
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <h2>Efor ekle</h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)', marginTop: -8 }}>
          <strong>{task.baslik}</strong> · saat cinsinden, seçili haftaya
        </p>

        {yukleniyor ? <p>Yükleniyor…</p> : (
          <>
            {mevcutlar.length > 0 && (
              <div style={{ marginBottom: 14, fontSize: 13 }}>
                <div style={{ color: 'var(--ink-3)', marginBottom: 4 }}>Girilmiş haftalar:</div>
                {mevcutlar.map(e => (
                  <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                    <span>{fmtTarih(e.hafta_baslangici)} haftası</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{Number(e.saat)} saat</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 500 }}>
                  <span>Toplam</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{mevcutlar.reduce((s, e) => s + Number(e.saat), 0)} saat</span>
                </div>
              </div>
            )}

            <div className="field">
              <label>Hafta</label>
              <div className="week-nav" style={{ justifyContent: 'space-between' }}>
                <button type="button" className="btn ghost sm" onClick={() => haftaKaydir(-1)}>←</button>
                <span style={{ fontSize: 13 }}>{fmtTarih(isoDate(hs))} – {fmtTarih(isoDate(he))}</span>
                <button type="button" className="btn ghost sm" onClick={() => haftaKaydir(1)}>→</button>
              </div>
            </div>

            <div className="field">
              <label>Saat {mevcutSaat != null && <span style={{ color: 'var(--ink-3)' }}>(mevcut: {Number(mevcutSaat)})</span>}</label>
              <input inputMode="decimal" placeholder="0" value={saat} onChange={e => setSaat(e.target.value)} autoFocus />
            </div>

            {hata && <div className="msg err">{hata}</div>}

            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={onClose}>Kapat</button>
              <button type="button" className="btn" onClick={kaydet} disabled={kaydediliyor}>Kaydet</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
