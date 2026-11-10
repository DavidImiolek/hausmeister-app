-- ============================================
-- Hausmeister-App: Supabase Schema
-- ============================================

-- Kunden (Dauerkunde oder Privatkunde)
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('dauerkunde', 'privatkunde')),
  address text,
  created_at timestamptz default now()
);

-- Individuelle Tätigkeitsliste pro Dauerkunde
create table customer_tasks (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  name text not null,
  sort_order int default 0
);

-- Jeder Besuch (ein Tag bei einem Kunden)
create table visits (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  date date not null default current_date,
  duration_minutes int not null default 0,
  notes text,  -- Freitext-Tätigkeit für Privatkunden
  created_at timestamptz default now()
);

-- Welche Tätigkeiten bei einem Besuch erledigt (Kreuze)
create table visit_tasks (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  task_id uuid not null references customer_tasks(id) on delete cascade,
  unique(visit_id, task_id)
);

-- Indexes
create index idx_visits_customer_date on visits(customer_id, date);
create index idx_visit_tasks_visit on visit_tasks(visit_id);
create index idx_customer_tasks_customer on customer_tasks(customer_id);

-- RLS aktivieren
alter table customers enable row level security;
alter table customer_tasks enable row level security;
alter table visits enable row level security;
alter table visit_tasks enable row level security;

-- Policies: Alles erlauben für anon (Single-User-App, kein Login)
create policy "allow all" on customers for all using (true) with check (true);
create policy "allow all" on customer_tasks for all using (true) with check (true);
create policy "allow all" on visits for all using (true) with check (true);
create policy "allow all" on visit_tasks for all using (true) with check (true);
