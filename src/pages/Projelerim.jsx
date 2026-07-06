import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Projelerim() {
  const { profile, seesAll, isHubYon } = useAuth()
  const nav = useNavigate()
  const [projeler, setProjeler] = useState(null)
  const [hublar, setHublar] = useState([])
  const [hubFilter, setHubFilter] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => { yukle() }, [])

  async function yukle() {
    const { data: hubs } = await supabase.from('hubs').select('*').order('sira')
    setHublar(hubs || [])

    let base = supabase.from('projects').select(`
      id, ad, aktif,
      customers ( ad, hub_id, hubs ( ad, renk ) ),
      project_products ( products ( ad ) ),
      project_assignments ( user_id, proje_lideri, profiles ( ad ) ),
      tasks ( id, durum, blokaj, kritik )
    `).eq('aktif', true).order('ad')

    const { data, error } = await base
    if (error) { console.error(error); setProjeler([]); return }

    let list = data || []
    // PM ve ekip üyesi: atandığı projeler (kendi hub'ı dışındaki çapraz atamalar dahil).
    // RLS zaten yalnızca yetkili satırları döndürür; burada atanmışları öne alıyoruz.
    if (!seesAll && !isHubYon) {
      list = list.filter(p => p.project_assignments.some(a => a.user_id === profile.id))
    }
    setProjeler(list)
  }

  if (projeler === null) return <p>Yükleniyor…</p>

  const gorunen = projeler.filter(p =>
    (!hubFilter || p.customers.hub_id === hubFilter) &&
    (!q || p.ad.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr')) ||
      p.customers.ad.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr')))
  )

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Projeler</h1>
          <p>{seesAll ? 'Tüm hub\u2019lardaki aktif projeler' : isHubYon ? 'Hub\u2019ınızdaki aktif projeler' : 'Atandığınız projeler'}</p>
        </div>
      </div>

      <div className="filters">
        {seesAll && (
          <>
            <button className={'filter-chip' + (!hubFilter ? ' active' : '')} onClick={() => setHubFilter('')}>Tümü</button>
            {hublar.map(h => (
              <button key={h.id} className={'filter-chip' + (hubFilter === h.id ? ' active' : '')} onClick={() => setHubFilter(h.id)}>
                {h.ad}
              </button>
            ))}
          </>
        )}
        <input placeholder="Proje veya müşteri ara…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 260, marginLeft: 'auto' }} />
      </div>

      {gorunen.length === 0 ? (
        <div className="empty">
          <strong>Proje bulunamadı</strong>
          {!seesAll && !isHubYon ? 'Henüz bir projeye atanmadınız. Hub yöneticinizle görüşün.' : 'Filtreyi değiştirmeyi deneyin.'}
        </div>
      ) : (
        <div className="grid grid-3">
          {gorunen.map(p => {
            const acik = p.tasks.filter(t => t.durum !== 'tamamlandi')
            const blokaj = acik.filter(t => t.blokaj).length
            const kritik = acik.filter(t => t.kritik).length
            const lider = p.project_assignments.find(a => a.proje_lideri)
            return (
              <div key={p.id} className="card clickable" style={{ cursor: 'pointer' }} onClick={() => nav('/projeler/' + p.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontWeight: 600 }}>{p.ad}</div>
                  <span className="chip">
                    <span className="hub-dot" style={{ background: p.customers.hubs.renk }} />
                    {p.customers.hubs.ad}
                  </span>
                </div>
                <div style={{ color: 'var(--ink-3)', fontSize: 13, margin: '3px 0 10px' }}>
                  {p.customers.ad}{lider ? ' · Lider: ' + (lider.profiles?.ad || '') : ''}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {p.project_products.map((pp, i) => <span key={i} className="chip">{pp.products.ad}</span>)}
                  <span className="chip">{acik.length} açık iş</span>
                  {blokaj > 0 && <span className="chip danger">{blokaj} blokaj</span>}
                  {kritik > 0 && <span className="chip warn">{kritik} kritik</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
