-- Panorama PMO — Migration 04
-- Not defteri maddelerinin şema karşılıkları.
-- Mevcut kurulumun ÜZERİNE çalıştırılır (01/02/03 sonrası). Idempotent yazıldı:
-- tekrar çalıştırılırsa hata vermez.

-- ============================================================
-- 1) EKİP KATMANINI LOGIN'DEN AYIR
--    profiles artık auth.users olmadan da var olabilir.
-- ============================================================

-- Mevcut FK'yi kaldır (auth.users'a zorunlu bağ)
alter table profiles drop constraint if exists profiles_id_fkey;

-- id artık kendi başına üretilebilir (login yoksa)
alter table profiles alter column id set default gen_random_uuid();

-- auth kullanıcısına opsiyonel bağ: auth_user_id
alter table profiles add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

-- Erişim durumunu okumak için yardımcı sütun yok; durumu auth_user_id ve davet alanından türeteceğiz
alter table profiles add column if not exists davet_edildi boolean not null default false;

-- Eski trigger'ı kaldır (yeni kullanıcıya boş profil açan)
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user();

-- Yeni trigger: auth kullanıcısı oluşunca, e-posta eşleşen KİŞİYİ bağla.
-- Eşleşme yoksa yeni kişi kaydı aç (davet dışı doğrudan kayıt senaryosu).
create or replace function link_or_create_profile()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  eslesen uuid;
begin
  select id into eslesen from profiles
    where lower(eposta) = lower(new.email) and auth_user_id is null
    limit 1;

  if eslesen is not null then
    update profiles
      set auth_user_id = new.id, davet_edildi = true
      where id = eslesen;
  else
    insert into profiles (auth_user_id, eposta, ad, davet_edildi)
      values (new.id, coalesce(new.email,''), coalesce(new.raw_user_meta_data->>'ad',''), true);
  end if;
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function link_or_create_profile();

-- ============================================================
-- 2) YARDIMCI FONKSİYONLARI auth_user_id'ye GÖRE GÜNCELLE
--    auth.uid() artık profiles.id değil, profiles.auth_user_id ile eşleşir.
-- ============================================================

create or replace function my_profile_id() returns uuid
language sql stable security definer set search_path = public as
$$ select id from profiles where auth_user_id = auth.uid() $$;

create or replace function my_role() returns yetki_rolu
language sql stable security definer set search_path = public as
$$ select yetki_rolu from profiles where auth_user_id = auth.uid() $$;

create or replace function my_hub() returns uuid
language sql stable security definer set search_path = public as
$$ select hub_id from profiles where auth_user_id = auth.uid() $$;

create or replace function is_assigned(pid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from project_assignments pa
     where pa.project_id = pid and pa.user_id = my_profile_id()
   ) $$;

-- Kadro yöneticisi: bu projeye, kendi hub kadrosundan biri atanmış mı?
-- (madde 3c — kadro hub'ı yöneticisi yalnızca kendi kişisinin ödünç gittiği projeyi görür)
create or replace function manages_someone_on(pid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select my_role() = 'hub_yon' and exists (
     select 1 from project_assignments pa
     join profiles p on p.id = pa.user_id
     where pa.project_id = pid and p.hub_id = my_hub()
   ) $$;

-- ============================================================
-- 3) ÇAPRAZ HUB ATAMASI — RLS'İ "ATANMIŞ MI" ÖNCELİKLİ YAP
-- ============================================================

-- profiles görünürlüğü: kendi kaydı auth_user_id ile eşleşir
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select to authenticated
using (can_see_all() or hub_id = my_hub() or auth_user_id = auth.uid());

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles for update to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid() and yetki_rolu = (select yetki_rolu from profiles p2 where p2.auth_user_id = auth.uid()));

-- tasks: atanmış mı VEYA proje hub yöneticisi VEYA kadro yöneticisi
drop policy if exists tasks_read on tasks;
create policy tasks_read on tasks for select to authenticated
using (
  can_see_all()
  or (my_role() = 'hub_yon' and project_hub(project_id) = my_hub())
  or manages_someone_on(project_id)
  or is_assigned(project_id)
);

drop policy if exists tasks_insert on tasks;
create policy tasks_insert on tasks for insert to authenticated
with check (is_admin() or can_manage_hub(project_hub(project_id)) or is_assigned(project_id));

drop policy if exists tasks_update on tasks;
create policy tasks_update on tasks for update to authenticated
using (is_admin() or can_manage_hub(project_hub(project_id)) or is_assigned(project_id))
with check (is_admin() or can_manage_hub(project_hub(project_id)) or is_assigned(project_id));

-- effort: kendi kaydı my_profile_id ile; okuma çapraz atamayı da kapsar
drop policy if exists effort_read on effort_entries;
create policy effort_read on effort_entries for select to authenticated
using (
  can_see_all()
  or (my_role() = 'hub_yon' and project_hub(project_id) = my_hub())
  or manages_someone_on(project_id)
  or user_id = my_profile_id()
);

drop policy if exists effort_insert on effort_entries;
create policy effort_insert on effort_entries for insert to authenticated
with check (user_id = my_profile_id() and is_assigned(project_id));

drop policy if exists effort_update on effort_entries;
create policy effort_update on effort_entries for update to authenticated
using (user_id = my_profile_id()) with check (user_id = my_profile_id());

drop policy if exists effort_delete on effort_entries;
create policy effort_delete on effort_entries for delete to authenticated
using (user_id = my_profile_id());

-- leaves: kendi kaydı my_profile_id ile
drop policy if exists leaves_read on leaves;
create policy leaves_read on leaves for select to authenticated
using (
  can_see_all()
  or user_id = my_profile_id()
  or exists (select 1 from profiles p where p.id = leaves.user_id and p.hub_id = my_hub())
);

drop policy if exists leaves_insert on leaves;
create policy leaves_insert on leaves for insert to authenticated
with check (user_id = my_profile_id());

drop policy if exists leaves_update on leaves;
create policy leaves_update on leaves for update to authenticated
using (user_id = my_profile_id()) with check (user_id = my_profile_id());

drop policy if exists leaves_delete on leaves;
create policy leaves_delete on leaves for delete to authenticated
using (user_id = my_profile_id() or is_admin());

-- ============================================================
-- 4) SİLME İÇİN BAĞLI-KAYIT SAYAÇLARI (view yerine RPC ile UI'da kullanacağız)
--    UI zaten client-side kontrol edecek; burada ekstra bir şey gerekmez.
-- ============================================================

-- Not: rate_cards, customers, projects politikaları değişmedi; hepsi direktör-yazar.
-- Ekip (profiles) admin yazma politikası zaten mevcut (profiles_admin_all).
