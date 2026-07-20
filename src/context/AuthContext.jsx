import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) { setProfile(null); return }
    supabase.from('profiles')
      .select('*, job_titles(ad), hubs(ad, renk)')
      .eq('auth_user_id', session.user.id).single()
      .then(({ data }) => setProfile(data))
  }, [session])

  const rol = profile?.yetki_rolu
  const isCS = rol === 'cs'
  const isSatis = rol === 'satis'

  const value = {
    session,
    profile,
    role: rol,
    // Maliyet dahil her şeyi görenler — CS/Satış BURAYA EKLENMEZ (ücret verisi)
    seesAll: ['direktor', 'gm'].includes(rol),
    // Tüm projeleri görenler (maliyet hariç) — RLS'teki can_see_all_projects() ile aynı
    seesAllProjects: ['direktor', 'gm', 'cs', 'satis'].includes(rol),
    isAdmin: rol === 'direktor',
    isHubYon: rol === 'hub_yon',
    isCS,
    isSatis,
    // CS/Satış kısıtlı görünüm görür: sadece proje künyesi + ilişki sağlığı
    kisitliGorunum: isCS || isSatis,
    // Bu kullanıcının yazabileceği sağlık kanalı (RLS'teki my_kanal() ile aynı)
    kanalim: isCS ? 'cs' : isSatis ? 'satis' : 'pm',
    signOut: () => supabase.auth.signOut()
  }

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)
