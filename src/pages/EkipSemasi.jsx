import { useEffect, useState } from 'react'
import { supabase, ROLLER } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function EkipSemasi() {
  const { seesAll, profile } = useAuth()
  const [hublar, setHublar] = useState([])
  const [kisiler, setKisiler] = useState([])
  const [atamalar, setAtamalar] = useState([])
  const [acik, setAcik] = useState(null)

  useEffect(() => { yukle() }, [])

  async function yukle() {
    const [{ data: h }, { data: k }, { data: a }] = await Promise.all([
      supabase.from('hubs').select('*').order('sira'),
      supabase.from('profiles').select('*, job_titles ( ad, sira )').eq('aktif', true).order('ad'),
      supabase.from('project_assignments').select('user_id, proje_lideri, projects ( ad, customers ( hub_id, hubs ( ad, renk ) ) )')
    ])
    setHublar(h || []); setKisiler(k || []); setAtamalar(a || [])
  }

  const gorunenHublar = seesAll ? hublar : hublar.filter(h => h.id === profile.hub_id)
  const yonetim = kisiler.filter(k => !k.hub_id)

  // Bir kişinin dış hub projelerini (ödünç gittiği) döndürür
  function disProjeler(kisi) {
    return atamalar.filter(a =>
      a.user_id === kisi.id &&
      a.projects?.customers?.hub_id &&
      a.projects.customers.hub_id !== kisi.hub_id
    )
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ekip şeması</h1>
          <p>{seesAll ? 'Tüm hub\u2019lar ve ekipleri' : 'Hub\u2019ınızın ekibi'} · kişiye tıklayınca proje atamaları açılır</p>
        </div>
      </div>

      {seesAll && yonetim.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h2>Yönetim</h2>
          {yonetim.map(k => (
            <div key={k.id} className="person-row">
              <span><strong>{k.ad || k.eposta}</strong></span>
              <span className="chip">{ROLLER[k.yetki_rolu]}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: `repeat(${Math.max(gorunenHublar.length, 1)}, minmax(0, 1fr))` }}>
        {gorunenHublar.map(h => {
          const ekip = kisiler.filter(k => k.hub_id === h.id)
          const yonetici = ekip.find(k => k.yetki_rolu === 'hub_yon')
          const gruplar = {}
          ekip.filter(k => k.id !== yonetici?.id).forEach(k => {
            const u = k.job_titles?.ad || 'Unvan atanmamış'
            ;(gruplar[u] = gruplar[u] || []).push(k)
          })
          return (
            <div key={h.id} className="card tree-hub" style={{ borderLeftColor: h.renk }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h2 style={{ marginBottom: 2 }}>{h.ad}</h2>
                <span className="chip">{ekip.length} kişi</span>
              </div>
              <div style={{ color: yonetici ? 'var(--accent)' : 'var(--ink-3)', fontSize: 13, marginBottom: 12 }}>
                {yonetici ? '★ ' + yonetici.ad + ' (hub yöneticisi)' : 'Hub yöneticisi atanmamış'}
              </div>
              {ekip.length === 0 && (
                <div className="empty"><strong>Ekip henüz tanımlanmadı</strong>Yönetim panelinden kişi ekleyin.</div>
              )}
              {Object.entries(gruplar).map(([unvan, grup]) => (
                <div key={unvan} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 2 }}>
                    {unvan} · {grup.length}
                  </div>
                  {grup.map(k => {
                    const projeleri = atamalar.filter(a => a.user_id === k.id)
                    const dis = disProjeler(k)
                    return (
                      <div key={k.id}>
                        <div className="person-row" style={{ cursor: 'pointer' }}
                          onClick={() => setAcik(acik === k.id ? null : k.id)}>
                          <span>
                            {k.ad || k.eposta}
                            {dis.length > 0 && (
                              <span className="chip warn" style={{ marginLeft: 6, fontSize: 11 }}>
                                → {dis.map(x => x.projects.customers.hubs.ad).filter((v, i, s) => s.indexOf(v) === i).join(', ')}
                              </span>
                            )}
                          </span>
                          <span className="chip">{projeleri.length} proje</span>
                        </div>
                        {acik === k.id && (
                          <div style={{ padding: '4px 0 8px 12px', fontSize: 13, color: 'var(--ink-2)' }}>
                            {projeleri.length === 0
                              ? 'Proje ataması yok.'
                              : projeleri.map((a, i) => {
                                  const disMi = a.projects?.customers?.hub_id !== k.hub_id
                                  return (
                                    <div key={i}>
                                      {a.projects?.ad}
                                      {a.proje_lideri ? ' · lider' : ''}
                                      {disMi && <span style={{ color: 'var(--warn)' }}> · {a.projects.customers.hubs.ad} (ödünç)</span>}
                                    </div>
                                  )
                                })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </>
  )
}
