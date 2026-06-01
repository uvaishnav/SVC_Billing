-- RPC: decrement_billed_qty
-- Atomically decrements cumulative_billed_qty on a work_order_items row.
-- Called by cancelInvoice() and by finalizeInvoice() when re-finalizing an
-- already-finalized invoice (to reverse the previous qty before writing new values).
-- Clamps to 0 to prevent negative cumulative values from data inconsistencies.
create or replace function decrement_billed_qty(
  p_item_id integer,
  p_qty     numeric
) returns void language plpgsql security definer as $$
begin
  update work_order_items
     set cumulative_billed_qty = greatest(0, cumulative_billed_qty - p_qty)
   where id = p_item_id;
end;
$$;
