import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export const DURUMLAR = {
  acik: 'Açık',
  devam: 'Devam ediyor',
  beklemede: 'Beklemede',
  tamamlandi: 'Tamamlandı'
}

export const IZIN_TIPLERI = {
  yillik: 'Yıllık izin',
  rapor: 'Rapor',
  idari: 'İdari izin',
  diger: 'Diğer'
}

export const ROLLER = {
  direktor: 'PMO Direktörü',
  gm: 'Genel Müdür',
  hub_yon: 'Hub Yöneticisi',
  pm: 'Proje Yöneticisi',
  ekip: 'Ekip Üyesi'
}

// Pazartesi bazlı hafta başlangıcı
export function haftaBasi(d = new Date()) {
  const x = new Date(d)
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  x.setHours(0, 0, 0, 0)
  return x
}

export function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

export function fmtTarih(s) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
