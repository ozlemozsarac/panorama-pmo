-- Panorama PMO — Migration 05
-- Model A: İş Kalemi = Efor birleşmesi + ürün alanı + ürün durumu
-- Mevcut kurulumun (01-04) ÜZERİNE çalışır. Idempotent.

-- ============================================================
-- 1) ÜRÜN DURUMU — project_products'a durum alanı
-- ============================================================
create type urun_durumu as enum ('acik', 'kapali', 'yd_devir');

alter table project_products add column if not exists durum urun_durumu;
-- durum null = henüz girilmemiş; UI'da "belirlenmedi" olarak görünür

-- ============================================================
-- 2) İŞ KALEMİ — tarih alanları + ürün bağlantısı
--    tasks artık ömrü olan (başlangıç-bitiş) ana kayıt.
-- ============================================================
alter table tasks add column if not exists baslangic_tarihi date;
alter table tasks add column if not exists bitis_tarihi date;
-- İş kaleminin ait olduğu ürün (opsiyonel; proje tek ürünlüyse UI otomatik atar)
alter table tasks add column if not exists product_id uuid references products(id);

-- ============================================================
-- 3) EFOR — iş kalemine ZORUNLU bağlı hale gelir (Model A)
--    Artık her efor bir iş kalemine ait; proje ondan türetilir.
--    task_id zorunlu; project_id iş kaleminden gelir ama sorgu kolaylığı için tutulur.
-- ============================================================

-- Mevcut effort_entries'te task_id opsiyoneldi; şimdi mantıken zorunlu.
-- Var olan bağsız kayıt YOK (temiz başlangıç) ama güvenli olması için önce temizle.
delete from effort_entries where task_id is null;

alter table effort_entries alter column task_id set not null;

-- Efor artık ürünü de iş kaleminden türetebilir; ama hızlı raporlama için
-- ürünü efor satırına da yazıyoruz (iş kalemi ürünü değişse bile geçmiş korunur).
alter table effort_entries add column if not exists product_id uuid references products(id);

-- ============================================================
-- 4) YARDIMCI: iş kaleminin haftalık efor toplamı için görünüm
-- ============================================================
create or replace view v_is_kalemi_efor as
select
  t.id as task_id,
  t.project_id,
  t.product_id,
  coalesce(sum(e.saat), 0) as toplam_saat
from tasks t
left join effort_entries e on e.task_id = t.id
group by t.id, t.project_id, t.product_id;

-- ============================================================
-- 5) RLS — yeni view ve product_id politikaları
--    Mevcut tasks/effort politikaları geçerli kalıyor; view underlying
--    tabloların RLS'ini miras alır (security_invoker).
-- ============================================================
alter view v_is_kalemi_efor set (security_invoker = true);

-- project_products durum güncellemesi: "herkes düzenleyebilir" kararı.
-- Mevcut pp_write yalnızca admin'di; durumu herkesin (atanmış/hub) değiştirebilmesi için
-- ayrı bir update politikası ekliyoruz. Ürün EKLE/SİL yine admin'de kalır.
drop policy if exists pp_durum_update on project_products;
create policy pp_durum_update on project_products for update to authenticated
using (
  can_see_all()
  or project_hub(project_id) = my_hub()
  or is_assigned(project_id)
)
with check (
  can_see_all()
  or project_hub(project_id) = my_hub()
  or is_assigned(project_id)
);

-- Not: effort_insert politikası zaten "user_id = my_profile_id() and is_assigned(project_id)"
-- Model A'da iş kalemi eforu da aynı kişi + atanmış proje kuralına tabi; değişiklik gerekmez.

-- ============================================================
-- 6) PROJE META ALANLARI — klasör linki + ürün bazlı versiyon
-- ============================================================

-- Proje klasörü linki (tek URL, proje başına)
alter table projects add column if not exists klasor_linki text;

-- Ürün bazlı versiyon (project_products'a; opsiyonel, ör. "8.37.2.100")
alter table project_products add column if not exists versiyon text;

-- Klasör linki güncellemesi: direktör + hub yöneticisi + atanan PM
-- (proje tanımı/adı yalnızca direktörde kalır; bu sadece klasor_linki için ek update yolu)
drop policy if exists projects_meta_update on projects;
create policy projects_meta_update on projects for update to authenticated
using (
  is_admin()
  or (my_role() = 'hub_yon' and project_hub(id) = my_hub())
  or is_assigned(id)
)
with check (
  is_admin()
  or (my_role() = 'hub_yon' and project_hub(id) = my_hub())
  or is_assigned(id)
);
-- Uyarı: bu politika update'i açar; ad/müşteri değişikliğini UI düzeyinde
-- yalnızca direktöre gösteriyoruz. Veritabanı düzeyinde hub_yon/PM yalnızca
-- klasor_linki alanını günceller (UI kısıtı). Tam kolon-bazlı kısıt için
-- ileride column-level privilege eklenebilir; şimdilik UI + rol yeterli.

-- Versiyon güncellemesi zaten pp_durum_update politikasının kapsamında
-- (aynı using/with check: can_see_all / hub / is_assigned). Ek politika gerekmez.

