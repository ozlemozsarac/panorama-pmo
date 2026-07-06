# Panorama PMO

Univera PMO için proje/müşteri hiyerarşisi, iş takibi, efor ve izin yönetimi uygulaması.
React + Supabase + Vercel.

## Kapsam (v1)

- Müşteri → Proje hiyerarşisi (Key Account + Volume seed'li, Stokbar yapı hazır)
- İş takip listeleri: 4 durum, blokaj/kritik bayrakları, 5 iş tipi, 3 beklemede nedeni
- Efor girişi: saat cinsinden, haftalık varsayılan + opsiyonel günlük detay
- İzin girişi + hub izin görünümü
- İki katmanlı GM özeti (yapısal + akış metrikleri)
- Ekip şeması (hub → unvan → kişi → proje atamaları)
- Yönetim paneli: tanımlar, atamalar, kişi bazlı geçerlilik tarihli maliyet oranları

Roller: `direktor` (tam yetki + admin), `gm` (tam salt okuma, maliyet dahil),
`hub_yon` (kendi hub'ı), `pm` / `ekip` (atandığı projeler). Tüm kurallar RLS ile
veritabanı seviyesinde uygulanır.

## Kurulum

### 1. Supabase

1. [supabase.com](https://supabase.com) üzerinde yeni proje oluşturun
   (Region: veri politikası gereği **EU — Frankfurt** önerilir).
2. SQL Editor'da sırasıyla çalıştırın:
   - `supabase/01_schema.sql`
   - `supabase/02_rls.sql`
   - `supabase/03_seed.sql` (26 Key Account + 59 Volume projesi yüklenir)
3. **Authentication → Providers → Email**: "Enable sign ups" seçeneğini **kapatın**
   (kullanıcılar yalnızca davetle gelir).
4. **Authentication → Users → Invite user** ile önce kendinizi davet edin.
5. Şifrenizi belirledikten sonra SQL Editor'da kendinizi direktör yapın:

```sql
update profiles set yetki_rolu = 'direktor', ad = 'Adınız Soyadınız'
where eposta = 'sizin@eposta.com';
```

Sonraki tüm kullanıcı yönetimi uygulama içindeki **Yönetim** ekranından yürür
(davet hariç — davetler Supabase panelinden gönderilir).

### 2. Yerelde çalıştırma

```bash
npm install
cp .env.example .env        # Supabase URL ve anon key'i girin
npm run dev
```

Supabase URL ve anon key: Supabase panelinde **Settings → API** altında.

### 3. Vercel deploy

1. Bu klasörü bir GitHub reposuna itin.
2. Vercel'de "New Project" → repoyu seçin (framework otomatik Vite algılanır).
3. Environment Variables bölümüne ekleyin:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy edin. `vercel.json` SPA yönlendirmesini hazır içerir.

## İlk gün akışı (önerilen)

1. Yönetim → Kullanıcılar: davet edilen herkese ad, yetki, unvan, hub atayın
2. Yönetim → Atamalar: kişileri projelere bağlayın, proje liderlerini işaretleyin
3. Yönetim → Maliyet: rate card'ları girin (yalnızca Direktör/GM görür)
4. Ekipler Projeler → İş takip listelerini ve Efor ekranını kullanmaya başlar

## Yol haritası

- **1b:** Proje sağlık RAG'i + maliyet raporu (efor × geçerlilik tarihli oran)
- **Faz 2:** DevOps hata talepleri ve Next4biz açık talep entegrasyonu

## Teknik notlar

- Türkçe karakterler tüm kodda doğrudan yazılır; Unicode escape kullanılmaz.
- Efor kayıtları tek tabloda: `hafta_baslangici` zorunlu, `gun` ve `task_id` opsiyonel.
- `rate_cards` geçerlilik tarihlidir; zam döneminde yeni satır eklenir, eski
  raporlar geriye dönük bozulmaz.
- Yeni auth kullanıcısı için `profiles` satırı trigger ile otomatik açılır
  (varsayılan rol: `ekip`).
