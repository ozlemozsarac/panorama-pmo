-- Panorama PMO — RLS politikaları
-- Görünürlük matrisi:
--   direktor : her şey + tüm yazma yetkileri (admin)
--   gm       : her şey salt okuma (rate_cards dahil)
--   hub_yon  : kendi hub'ının tamamı; kendi hub'ında atama ve iş yönetimi
--   pm/ekip  : kendi hub'ının tanımları ve ekibi (ekip şeması kararı: herkes kendi hub'ını görür);
--              iş/efor detayında yalnızca atandığı projeler; efor ve izinde yalnızca kendi kaydını yazar

-- ============ Yardımcı fonksiyonlar ============

create or replace function my_role() returns yetki_rolu
language sql stable security definer set search_path = public as
$$ select yetki_rolu from profiles where id = auth.uid() $$;

create or replace function my_hub() returns uuid
language sql stable security definer set search_path = public as
$$ select hub_id from profiles where id = auth.uid() $$;

create or replace function can_see_all() returns boolean
language sql stable as
$$ select my_role() in ('direktor','gm') $$;

create or replace function is_admin() returns boolean
language sql stable as
$$ select my_role() = 'direktor' $$;

create or replace function project_hub(pid uuid) returns uuid
language sql stable security definer set search_path = public as
$$ select c.hub_id from projects p join customers c on c.id = p.customer_id where p.id = pid $$;

create or replace function is_assigned(pid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from project_assignments where project_id = pid and user_id = auth.uid()) $$;

create or replace function can_manage_hub(h uuid) returns boolean
language sql stable as
$$ select is_admin() or (my_role() = 'hub_yon' and my_hub() = h) $$;

-- ============ RLS aç ============

alter table hubs enable row level security;
alter table products enable row level security;
alter table job_titles enable row level security;
alter table work_types enable row level security;
alter table waiting_reasons enable row level security;
alter table customers enable row level security;
alter table projects enable row level security;
alter table project_products enable row level security;
alter table profiles enable row level security;
alter table project_assignments enable row level security;
alter table rate_cards enable row level security;
alter table tasks enable row level security;
alter table effort_entries enable row level security;
alter table leaves enable row level security;

-- ============ Lookup tabloları: herkes okur, direktör yazar ============

create policy lookup_read_hubs on hubs for select to authenticated using (true);
create policy lookup_write_hubs on hubs for all to authenticated using (is_admin()) with check (is_admin());

create policy lookup_read_products on products for select to authenticated using (true);
create policy lookup_write_products on products for all to authenticated using (is_admin()) with check (is_admin());

create policy lookup_read_titles on job_titles for select to authenticated using (true);
create policy lookup_write_titles on job_titles for all to authenticated using (is_admin()) with check (is_admin());

create policy lookup_read_wt on work_types for select to authenticated using (true);
create policy lookup_write_wt on work_types for all to authenticated using (is_admin()) with check (is_admin());

create policy lookup_read_wr on waiting_reasons for select to authenticated using (true);
create policy lookup_write_wr on waiting_reasons for all to authenticated using (is_admin()) with check (is_admin());

-- ============ Müşteri ve proje: hub bazlı okuma, direktör yazma ============

create policy customers_read on customers for select to authenticated
using (can_see_all() or hub_id = my_hub());
create policy customers_write on customers for all to authenticated
using (is_admin()) with check (is_admin());

create policy projects_read on projects for select to authenticated
using (can_see_all() or project_hub(id) = my_hub());
create policy projects_write on projects for all to authenticated
using (is_admin()) with check (is_admin());

create policy pp_read on project_products for select to authenticated
using (can_see_all() or project_hub(project_id) = my_hub());
create policy pp_write on project_products for all to authenticated
using (is_admin()) with check (is_admin());

-- ============ Profiller: herkes kendi hub'ını görür (ekip şeması kararı) ============

create policy profiles_read on profiles for select to authenticated
using (can_see_all() or hub_id = my_hub() or id = auth.uid());

create policy profiles_update_own on profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid() and yetki_rolu = (select yetki_rolu from profiles p2 where p2.id = auth.uid()));

create policy profiles_admin_all on profiles for all to authenticated
using (is_admin()) with check (is_admin());

-- ============ Atamalar: hub bazlı okuma; direktör + hub yöneticisi (kendi hub'ı) yazar ============

create policy assignments_read on project_assignments for select to authenticated
using (can_see_all() or project_hub(project_id) = my_hub());

create policy assignments_write on project_assignments for all to authenticated
using (can_manage_hub(project_hub(project_id)))
with check (can_manage_hub(project_hub(project_id)));

-- ============ Rate card: yalnızca direktör/GM okur, direktör yazar ============

create policy rates_read on rate_cards for select to authenticated using (can_see_all());
create policy rates_write on rate_cards for all to authenticated using (is_admin()) with check (is_admin());

-- ============ İş kalemleri: atandığın projeler; hub yöneticisi kendi hub'ı ============

create policy tasks_read on tasks for select to authenticated
using (
  can_see_all()
  or (my_role() = 'hub_yon' and project_hub(project_id) = my_hub())
  or is_assigned(project_id)
);

create policy tasks_insert on tasks for insert to authenticated
with check (is_admin() or can_manage_hub(project_hub(project_id)) or is_assigned(project_id));

create policy tasks_update on tasks for update to authenticated
using (is_admin() or can_manage_hub(project_hub(project_id)) or is_assigned(project_id))
with check (is_admin() or can_manage_hub(project_hub(project_id)) or is_assigned(project_id));

create policy tasks_delete on tasks for delete to authenticated
using (is_admin() or can_manage_hub(project_hub(project_id)));

-- ============ Efor: herkes yalnızca kendi kaydını yazar ============

create policy effort_read on effort_entries for select to authenticated
using (
  can_see_all()
  or (my_role() = 'hub_yon' and project_hub(project_id) = my_hub())
  or user_id = auth.uid()
);

create policy effort_insert on effort_entries for insert to authenticated
with check (user_id = auth.uid() and is_assigned(project_id));

create policy effort_update on effort_entries for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy effort_delete on effort_entries for delete to authenticated
using (user_id = auth.uid());

-- ============ İzin: kendi kaydını yazar; takım takvimi için hub bazlı okuma ============

create policy leaves_read on leaves for select to authenticated
using (
  can_see_all()
  or user_id = auth.uid()
  or exists (select 1 from profiles p where p.id = leaves.user_id and p.hub_id = my_hub())
);

create policy leaves_insert on leaves for insert to authenticated
with check (user_id = auth.uid());

create policy leaves_update on leaves for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy leaves_delete on leaves for delete to authenticated
using (user_id = auth.uid() or is_admin());
