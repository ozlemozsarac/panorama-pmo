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
      .eq('id', session.user.id).single()
      .then(({ data }) => setProfile(data))
  }, [session])

  const value = {
    session,
    profile,
    role: profile?.yetki_rolu,
    seesAll: ['direktor', 'gm'].includes(profile?.yetki_rolu),
    isAdmin: profile?.yetki_rolu === 'direktor',
    isHubYon: profile?.yetki_rolu === 'hub_yon',
    signOut: () => supabase.auth.signOut()
  }

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)
