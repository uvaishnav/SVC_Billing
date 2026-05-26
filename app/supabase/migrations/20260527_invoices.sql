-- ─── Invoices ────────────────────────────────────────────────
-- Status: draft → final → cancelled
-- invoice_number is generated at wizard-open via generate-invoice-number edge function
-- and used as the natural PK-equivalent for draft saves

create type invoice_status as enum ('draft', 'final', 'cancelled');
create type tax_mode as enum ('cgst_sgst', 'igst');

create table if not exists invoices (
  id                  bigserial primary key,
  invoice_number      text        not null unique,
  invoice_date        date        not null,
  billing_from        date        not null,
  billing_to          date        not null,

  -- Client
  client_id           bigint      references clients(id),
  client_gstin_id     bigint      references client_gstins(id),

  -- Work Order (optional link)
  work_order_id       bigint      references work_orders(id),

  -- GST fields (auto-computed, stored for PDF)
  tax_mode            tax_mode    not null default 'cgst_sgst',
  place_of_supply     text        not null default '',
  place_of_supply_code text       not null default '',
  reverse_charge      boolean     not null default false,

  -- Financials (computed at finalize, stored for immutability)
  total_taxable       numeric(12,2) not null default 0,
  gst_rate            numeric(5,2)  not null default 18,
  total_gst           numeric(12,2) not null default 0,
  total_amount        numeric(12,2) not null default 0,
  tds_rate            numeric(5,2)  not null default 0,
  tds_amount          numeric(12,2) not null default 0,
  net_receivable      numeric(12,2) not null default 0,
  amount_in_words     text,

  -- Description
  overall_description text,

  -- Bank
  bank_account_id     bigint      references bank_accounts(id),

  -- SAC (invoice-level default; can be overridden per line item)
  sac_id              bigint      references sac_codes(id),

  -- Status
  status              invoice_status not null default 'draft',

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ─── Invoice Line Items ───────────────────────────────────────
create table if not exists invoice_line_items (
  id                  bigserial primary key,
  invoice_id          bigint      not null references invoices(id) on delete cascade,
  work_order_item_id  bigint      references work_order_items(id),   -- nullable (manual line)

  sl_no               int         not null default 1,
  description         text        not null,                           -- exact WO item description, pre-filled
  sac_id              bigint      references sac_codes(id),
  unit                text,
  qty                 numeric(10,3) not null default 0,
  rate                numeric(12,2) not null default 0,
  taxable_value       numeric(12,2) not null default 0,               -- qty × rate
  rate_overridden     boolean     not null default false,             -- true if user changed the WO rate

  created_at          timestamptz not null default now()
);

-- ─── Invoice Vehicles (internal tracking) ────────────────────
create table if not exists invoice_vehicles (
  id                  bigserial primary key,
  invoice_id          bigint      not null references invoices(id) on delete cascade,
  vehicle_id          bigint      not null references vehicles(id),
  include_in_description boolean  not null default true,
  unique(invoice_id, vehicle_id)
);

-- ─── updated_at trigger ───────────────────────────────────────
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger invoices_updated_at
  before update on invoices
  for each row execute function update_updated_at_column();

-- ─── Indexes ─────────────────────────────────────────────────
create index if not exists idx_invoices_client_id    on invoices(client_id);
create index if not exists idx_invoices_status       on invoices(status);
create index if not exists idx_invoice_items_invoice on invoice_line_items(invoice_id);
create index if not exists idx_invoice_vehicles_inv  on invoice_vehicles(invoice_id);
