-- Panorama PMO — Şema
-- Supabase SQL Editor'da sırayla çalıştırın: 01_schema.sql → 02_rls.sql → 03_seed.sql

create extension if not exists "pgcrypto";

-- Enum tipleri
create type yetki_rolu as enum ('direktor','gm','hub_yon','pm','ekip');
create type gorev_durumu as enum ('acik','devam','beklemede','tamamlandi');
create type izin_tipi as enum ('yillik','rapor','idari','diger');

-- ============ TANIM KATMANI ============

create table hubs (
  id uuid primary key default gen_random_uuid(),
  ad text not null unique,
  renk text not null default '#38BDF8',
  sira int not null default 0
);

create table products (
  id uuid primary key default gen_random_uuid(),
  ad text not null unique
);

create table job_titles (
  id uuid primary key default gen_random_uuid(),
  ad text not null unique,
  sira int not null default 0
);

create table work_types (
  id uuid primary key default gen_random_uuid(),
  ad text not null unique,
  sira int not null default 0
);

create table waiting_reasons (
  id uuid primary key default gen_random_uuid(),
  ad text not null unique,
  sira int not null default 0
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references hubs(id),
  ad text not null,
  unique (hub_id, ad)
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  ad text not null,
  aktif boolean not null default true,
  unique (customer_id, ad)
);

create table project_products (
  project_id uuid not null references projects(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  primary key (project_id, product_id)
);

-- Profil: auth.users ile 1:1
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  ad text not null default '',
  eposta text not null default '',
  yetki_rolu yetki_rolu not null default 'ekip',
  unvan_id uuid references job_titles(id),
  hub_id uuid references hubs(id),      -- Direktör ve GM için boş
  aktif boolean not null default true
);

-- Yeni auth kullanıcısı için otomatik profil
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, eposta, ad)
  values (new.id, coalesce(new.email,''), coalesce(new.raw_user_meta_data->>'ad',''));
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();

create table project_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  proje_lideri boolean not null default false,
  unique (project_id, user_id)
);

-- Kişi bazlı, geçerlilik tarihli saat maliyeti (yalnızca Direktör/GM)
create table rate_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  saat_maliyeti numeric(10,2) not null check (saat_maliyeti >= 0),
  gecerli_baslangic date not null,
  unique (user_id, gecerli_baslangic)
);

-- ============ AKIŞ KATMANI ============

create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  sorumlu_id uuid references profiles(id),
  baslik text not null,
  durum gorev_durumu not null default 'acik',
  termin date,
  blokaj boolean not null default false,
  blokaj_nedeni text,
  kritik boolean not null default false,
  is_tipi_id uuid references work_types(id),
  beklemede_nedeni_id uuid references waiting_reasons(id),
  notlar text,
  olusturan_id uuid references profiles(id) default auth.uid(),
  olusturma timestamptz not null default now(),
  tamamlanma timestamptz
);

-- Tamamlandı durumuna geçince tarihi otomatik yaz
create or replace function set_tamamlanma()
returns trigger language plpgsql as $$
begin
  if new.durum = 'tamamlandi' and old.durum is distinct from 'tamamlandi' then
    new.tamamlanma := now();
  elsif new.durum <> 'tamamlandi' then
    new.tamamlanma := null;
  end if;
  return new;
end $$;

create trigger trg_task_tamamlanma
before update on tasks
for each row execute function set_tamamlanma();

-- Efor: hafta_baslangici (Pazartesi) zorunlu; gun ve task_id opsiyonel
create table effort_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null,
  hafta_baslangici date not null,
  gun date,
  saat numeric(5,2) not null check (saat > 0 and saat <= 24),
  created_at timestamptz not null default now(),
  constraint gun_hafta_icinde check (gun is null or (gun >= hafta_baslangici and gun < hafta_baslangici + 7))
);

create index idx_effort_user_week on effort_entries (user_id, hafta_baslangici);
create index idx_effort_project on effort_entries (project_id, hafta_baslangici);
create index idx_tasks_project on tasks (project_id, durum);

create table leaves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  baslangic date not null,
  bitis date not null,
  tip izin_tipi not null default 'yillik',
  aciklama text,
  check (bitis >= baslangic)
);
