-- Atomic RPC to increment cumulative_billed_qty on a work_order_item
-- Called once per line item when an invoice is finalized
create or replace function increment_billed_qty(
  p_item_id bigint,
  p_qty     numeric
)
returns void
language plpgsql
as $$
begin
  update work_order_items
  set cumulative_billed_qty = cumulative_billed_qty + p_qty
  where id = p_item_id;
end;
$$;
