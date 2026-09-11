-- Retira superficies legacy que ya no tienen consumidores en la aplicacion.
-- No se usa CASCADE: una dependencia no inventariada debe abortar la migracion
-- en lugar de eliminar objetos activos de forma silenciosa.

drop function if exists public.admin_update_product(uuid,text,text,text,numeric,integer,text);
drop function if exists public.register_counter_sale(uuid,uuid,text,text,uuid,uuid,uuid,integer,uuid,numeric,text,text,text,text,text);
drop function if exists public.refresh_my_loyalty();
drop function if exists public.admin_adjust_loyalty(text,integer,text);
drop function if exists public.review_barber_expense(uuid,text);
drop function if exists public.create_barber_payout(uuid,date,date);
drop function if exists public.mark_payout_paid(uuid);
drop function if exists public.barber_publish_gallery(text,text,text,text,text,boolean);
drop function if exists public.request_reward_redemption(uuid);

-- customer_streaks fue sustituida por customer_barber_streaks. La funcion
-- vigente process_sale_loyalty ya trabaja exclusivamente por peluquero.
drop table if exists public.customer_streaks;

-- Nunca se implemento un consumidor de feature_flags ni en frontend, RPC,
-- triggers o trabajos programados. Se elimina para evitar configuracion muerta.
drop table if exists public.feature_flags;

-- Indices para relaciones y filtros que aparecen de forma reiterada en los
-- paneles. Las restricciones primary key/unique ya cubren el resto.
create index if not exists appointments_client_starts_idx
  on public.appointments(client_id,starts_at desc);
create index if not exists appointments_barber_starts_idx
  on public.appointments(barber_id,starts_at desc);
create index if not exists appointments_status_starts_idx
  on public.appointments(status,starts_at);

create index if not exists product_reservations_client_status_expires_idx
  on public.product_reservations(client_id,status,expires_at);
create index if not exists product_reservations_status_created_idx
  on public.product_reservations(status,created_at);

create index if not exists notifications_user_created_idx
  on public.notifications(user_id,created_at desc);
create index if not exists profiles_created_idx
  on public.profiles(created_at desc);
create index if not exists loyalty_transactions_user_created_idx
  on public.loyalty_transactions(user_id,created_at desc);
create index if not exists loyalty_transactions_source_idx
  on public.loyalty_transactions(source_id)
  where source_id is not null;
create index if not exists reward_redemptions_user_status_created_idx
  on public.reward_redemptions(user_id,status,created_at desc);

create index if not exists sales_status_paid_idx
  on public.sales(status,paid_at desc);
create index if not exists sales_shift_created_idx
  on public.sales(shift_id,created_at desc);
create index if not exists sale_items_sale_idx
  on public.sale_items(sale_id);
create index if not exists payments_sale_idx
  on public.payments(sale_id);

create index if not exists barber_earnings_barber_status_created_idx
  on public.barber_earnings(barber_id,status,created_at);
create index if not exists barber_expenses_barber_status_created_idx
  on public.barber_expenses(barber_id,status,created_at);
create index if not exists payouts_barber_created_idx
  on public.payouts(barber_id,created_at desc);
create index if not exists discount_applications_barber_created_idx
  on public.discount_applications(barber_id,created_at desc);

create index if not exists conversation_participants_user_idx
  on public.conversation_participants(user_id,conversation_id);
create index if not exists messages_conversation_created_idx
  on public.messages(conversation_id,created_at);

create index if not exists gallery_posts_public_order_idx
  on public.gallery_posts(featured desc,sort_order,created_at desc)
  where status='published' and client_consent;
create index if not exists audit_logs_entity_lookup_idx
  on public.audit_logs(entity,entity_id,created_at desc);
create index if not exists schedules_barber_weekday_idx
  on public.schedules(barber_id,weekday)
  where active;
create index if not exists schedule_exceptions_window_idx
  on public.schedule_exceptions(barber_id,starts_at,ends_at);
