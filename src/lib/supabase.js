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

export const URUN_DURUMLARI = {
  acik: 'Açık',
  kapali: 'Kapalı',
  yd_devir: 'YD Devir Aşamasında'
}

// Ürün durumu renkleri: Kapalı yeşil, YD Devir amber, Açık gri
export const URUN_DURUM_RENK = {
  acik:     { bg: '#F1EFE8', fg: '#5F5E5A' },
  kapali:   { bg: '#E4F3EC', fg: '#1C7A52' },
  yd_devir: { bg: '#FBF1DD', fg: '#A06A10' }
}

// Ürün rozeti rengi: Enroute kırmızı · Quest yeşil · Calldesk mor · Stokbar mavi
// Renkler styles.css'te .chip.prod-* sınıflarında tanımlı (açık + koyu tema).
export const URUN_SLUG = {
  'Enroute': 'enroute',
  'Quest': 'quest',
  'Calldesk': 'calldesk',
  'Stokbar': 'stokbar'
}
export function urunChip(ad) {
  const slug = URUN_SLUG[ad]
  return 'chip' + (slug ? ' prod-' + slug : '')
}

// Pazartesi bazlı hafta başlangıcı
export function haftaBasi(d = new Date()) {
  const x = new Date(d)
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  x.setHours(0, 0, 0, 0)
  return x
}

// 'YYYY-MM-DD' → yerel Date. new Date('2026-07-13') UTC gece yarısı olarak
// parse edilir ve UTC- saat dilimlerinde bir gün geri kayar; bu güvenli.
export function parseISO(s) {
  const [y, m, g] = String(s).split('-').map(Number)
  return new Date(y, m - 1, g)
}

// Date → 'YYYY-MM-DD' (YEREL tarih).
// DİKKAT: Burada toISOString() KULLANILMAZ. haftaBasi() yerel saatle
// Pazartesi 00:00 üretir; toISOString() bunu UTC'ye çevirdiği için
// UTC+3'te Pazar 21:00'e düşer ve tarih bir gün geri kayardı.
export function isoDate(d) {
  const x = new Date(d)
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const g = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${g}`
}

export function fmtTarih(s) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
