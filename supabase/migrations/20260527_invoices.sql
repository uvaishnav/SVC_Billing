-- ─────────────────────────────────────────────────────────────
-- Migration: 20260527_invoices.sql
-- Creates: invoices, invoice_line_items, invoice_vehicles
-- ─────────────────────────────────────────────────────────────

-- ─── invoices ────────────────────────────────────────────────
create table if not exists invoices (
  id                    serial primary key,
  invoice_number        text not null unique,           -- e.g. SVC/25-26/007
  status                text not null default 'draft'   -- draft | final | cancelled
                          check (status in ('draft', 'final', 'cancelled')),

  -- Client / GST fields
  client_id             integer references clients(id),
  client_gstin_id       integer references client_gstins(id),
  tax_mode              text not null default 'cgst_sgst'
                          check (tax_mode in ('cgst_sgst', 'igst')),
  reverse_charge        boolean not null default false,

  -- Linked work order (optional)
  work_order_id         integer references work_orders(id),

  -- Dates
  invoice_date          date not null,
  billing_from          date not null,
  billing_to            date not null,

  -- SAC + bank
  sac_id                integer references sac_codes(id),
  bank_account_id       integer references bank_accounts(id),

  -- Descriptions
  overall_description   text,                           -- AI-generated, editable

  -- Financials (computed and stored at finalization)
  total_taxable         numeric(12,2) not null default 0,
  gst_rate              numeric(5,2)  not null default 18,
  cgst_amount           numeric(12,2) not null default 0,
  sgst_amount           numeric(12,2) not null default 0,
  igst_amount           numeric(12,2) not null default 0,
  total_gst             numeric(12,2) not null default 0,
  total_amount          numeric(12,2) not null default 0,  -- taxable + gst
  tds_rate              numeric(5,2)  not null default 2,
  tds_amount            numeric(12,2) not null default 0,  -- informational only
  net_receivable        numeric(12,2) not null default 0,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ─── invoice_line_items ───────────────────────────────────────
create table if not exists invoice_line_items (
  id                    serial primary key,
  invoice_id            integer not null references invoices(id) on delete cascade,
  work_order_item_id    integer references work_order_items(id),  -- nullable (manual items)

  sl_no                 integer,
  description           text not null,                            -- exact WO item description
  sac_id                integer references sac_codes(id),
  unit                  text,
  qty                   numeric(12,3) not null default 0,
  rate                  numeric(12,2) not null default 0,
  rate_overridden       boolean not null default false,           -- true if user changed from WO rate
  taxable_value         numeric(12,2) not null default 0,         -- qty * rate

  created_at            timestamptz not null default now()
);

-- ─── invoice_vehicles ────────────────────────────────────────
create table if not exists invoice_vehicles (
  id                    serial primary key,
  invoice_id            integer not null references invoices(id) on delete cascade,
  vehicle_id            integer not null references vehicles(id),
  include_in_description boolean not null default true,
  unique (invoice_id, vehicle_id)
);

-- ─── updated_at trigger ───────────────────────────────────────
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger invoices_updated_at
  before update on invoices
  for each row execute function update_updated_at_column();

-- ─── RLS ─────────────────────────────────────────────────────
alter table invoices           enable row level security;
alter table invoice_line_items enable row level security;
alter table invoice_vehicles   enable row level security;

create policy "auth users full access" on invoices
  for all to authenticated using (true) with check (true);

create policy "auth users full access" on invoice_line_items
  for all to authenticated using (true) with check (true);

create policy "auth users full access" on invoice_vehicles
  for all to authenticated using (true) with check (true);
