-- RPC: increment_billed_qty
-- Atomically increments cumulative_billed_qty on a work_order_items row.
-- Called by finalizeInvoice() after invoice is confirmed.
create or replace function increment_billed_qty(
  p_item_id integer,
  p_qty     numeric
) returns void language plpgsql security definer as $$
begin
  update work_order_items
     set cumulative_billed_qty = cumulative_billed_qty + p_qty
   where id = p_item_id;
end;
$$;
