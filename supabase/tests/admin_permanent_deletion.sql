-- Ejecutar SOLO en Supabase local o una base desechable despues de las migraciones:
-- psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/admin_permanent_deletion.sql
-- Todos los fixtures y cambios se revierten, incluso las configuraciones del negocio.
begin;

create function pg_temp.expect_delete_blocked(kind text, record_id uuid, expected_message text)
returns void language plpgsql as $$
declare blocked boolean := false;
begin
  begin
    perform public.admin_delete_record(kind, record_id);
  exception when others then
    blocked := true;
    assert position(expected_message in sqlerrm) > 0, 'Error inesperado: ' || sqlerrm;
  end;
  assert blocked, 'El borrado debio ser rechazado';
end;
$$;

do $$
declare
  administrator uuid := gen_random_uuid();
  client uuid := gen_random_uuid();
  employee uuid := gen_random_uuid();
  barber uuid := gen_random_uuid();
  service uuid := gen_random_uuid();
  product uuid := gen_random_uuid();
  gallery uuid := gen_random_uuid();
  appointment uuid := gen_random_uuid();
  reservation uuid := gen_random_uuid();
  shift uuid := gen_random_uuid();
  sale uuid := gen_random_uuid();
  service_line uuid := gen_random_uuid();
  product_line uuid := gen_random_uuid();
  extra_line uuid := gen_random_uuid();
  earning uuid := gen_random_uuid();
  payout uuid := gen_random_uuid();
  reward uuid := gen_random_uuid();
  redemption uuid := gen_random_uuid();
  conversation uuid := gen_random_uuid();
  deleted_client_name text := 'Cliente prueba borrado';
  directory jsonb;
begin
  assert not has_function_privilege('anon', 'public.admin_delete_record(text,uuid)', 'execute');
  assert has_function_privilege('authenticated', 'public.admin_delete_record(text,uuid)', 'execute');
  assert not has_table_privilege('authenticated', 'public.products', 'delete');
  assert not has_table_privilege('authenticated', 'public.barber_profiles', 'delete');

  insert into auth.users(id, email, raw_user_meta_data) values
    (administrator, administrator::text || '@delete-test.invalid', '{"full_name":"Administrador prueba"}'),
    (client, client::text || '@delete-test.invalid', jsonb_build_object('full_name', deleted_client_name)),
    (employee, employee::text || '@delete-test.invalid', '{"full_name":"Peluquero prueba"}');
  insert into public.user_roles(user_id, role) values (administrator, 'admin'), (employee, 'barber');
  insert into public.barber_profiles(id, user_id, display_name, slug) values (barber, employee, 'Peluquero prueba', barber::text);
  insert into public.services(id, name, slug, price, duration_minutes) values (service, 'Corte prueba', service::text, 50, 30);
  insert into public.products(id, name, slug, price, stock) values (product, 'Producto prueba', product::text, 25, 5);
  insert into public.gallery_posts(id, title, image_path, image_paths, service_id, barber_id)
    values (gallery, 'Galeria prueba', 'test/delete.jpg', array['test/delete.jpg'], service, barber);

  perform set_config('request.jwt.claim.sub', client::text, true);
  perform pg_temp.expect_delete_blocked('products', product, 'Acceso administrativo requerido');
  perform set_config('request.jwt.claim.sub', administrator::text, true);
  perform pg_temp.expect_delete_blocked('clients', administrator, 'propia cuenta');
  perform pg_temp.expect_delete_blocked('clients', employee, 'pertenece al personal');
  perform pg_temp.expect_delete_blocked('unknown', product, 'no es valido');
  directory := public.admin_list_clients(client::text, 1, 25);
  assert directory->'rows'->0 ? 'blocked_reason', 'Falta el detalle del cliente';
  assert directory->'rows'->0 ? 'birthday', 'Falta la fecha de nacimiento';

  update public.business_settings set timezone = 'America/La_Paz' where id;
  update public.business_hours set active = true, opens_at = '09:00', closes_at = '20:00',
    afternoon_opens_at = null, afternoon_closes_at = null;
  insert into public.appointments(id, client_id, barber_id, service_id, starts_at, ends_at, blocked_until,
      duration_snapshot, price_snapshot, service_name_snapshot)
    values (appointment, client, barber, service, '2030-01-08 10:00-04', '2030-01-08 10:30-04', '2030-01-08 10:35-04',
      30, 50, 'Corte prueba');
  perform pg_temp.expect_delete_blocked('clients', client, 'citas pendientes');
  perform pg_temp.expect_delete_blocked('services', service, 'citas pendientes');
  perform pg_temp.expect_delete_blocked('barbers', barber, 'citas pendientes');
  update public.appointments set status = 'completed' where id = appointment;

  insert into public.product_reservations(id, client_id, product_id, price_snapshot)
    values (reservation, client, product, 25);
  perform pg_temp.expect_delete_blocked('products', product, 'reservas pendientes');
  perform pg_temp.expect_delete_blocked('clients', client, 'productos reservados');
  update public.product_reservations set status = 'collected' where id = reservation;

  insert into public.cash_shifts(id, opened_by) values (shift, administrator);
  insert into public.sales(id, shift_id, client_id, appointment_id, status, paid_at, list_total, paid_total, created_by)
    values (sale, shift, client, appointment, 'pending_payment', now(), 80, 80, administrator);
  insert into public.sale_items(id, sale_id, item_type, service_id, barber_id, name_snapshot, unit_price_snapshot)
    values (service_line, sale, 'service', service, barber, 'Corte prueba', 50),
      (extra_line, sale, 'custom_charge', null, barber, 'Adicional prueba', 5);
  insert into public.sale_items(id, sale_id, item_type, product_id, name_snapshot, unit_price_snapshot)
    values (product_line, sale, 'product', product, 'Producto prueba', 25);
  perform pg_temp.expect_delete_blocked('products', product, 'ventas pendientes');
  perform pg_temp.expect_delete_blocked('services', service, 'ventas pendientes');
  perform pg_temp.expect_delete_blocked('barbers', barber, 'ventas pendientes');
  perform pg_temp.expect_delete_blocked('clients', client, 'ventas pendientes');
  update public.sales set status = 'paid' where id = sale;
  insert into public.payments(sale_id, shift_id, amount, method, confirmed_by) values (sale, shift, 80, 'cash', administrator);
  insert into public.receipts(sale_id, issued_by) values (sale, administrator);
  insert into public.barber_earnings(id, barber_id, sale_item_id, kind, base_amount, rate_percent, amount)
    values (earning, barber, service_line, 'service_commission', 50, 50, 25);
  perform pg_temp.expect_delete_blocked('barbers', barber, 'Liquida las comisiones');
  update public.barber_earnings set status = 'paid' where id = earning;
  insert into public.payouts(id, barber_id, period_start, period_end, total_amount, status, created_by)
    values (payout, barber, current_date, current_date, 25, 'paid', administrator);

  insert into public.rewards(id, name, points_cost, reward_type, reward_value, service_id)
    values (reward, 'Recompensa prueba', 10, 'fixed_discount', 5, service);
  insert into public.reward_redemptions(id, user_id, reward_id, barber_id, service_id_snapshot, points_spent, status)
    values (redemption, client, reward, barber, service, 10, 'pending');
  perform pg_temp.expect_delete_blocked('clients', client, 'canjes pendientes');
  perform pg_temp.expect_delete_blocked('services', service, 'canjes pendientes');
  perform pg_temp.expect_delete_blocked('barbers', barber, 'canjes pendientes');
  update public.reward_redemptions set status = 'used', sale_id = sale, used_at = now() where id = redemption;

  -- La cuenta global no debe recibir puntos de un peluquero que ya fue eliminado.
  insert into public.loyalty_accounts(user_id, balance) values (client, 100)
    on conflict(user_id) do update set balance = 100;
  insert into public.loyalty_transactions(user_id, barber_id, points, kind, reason, idempotency_key, source_id)
    values (client, barber, 10, 'earn', 'Prueba', gen_random_uuid()::text, sale);
  insert into public.conversations(id, created_by) values (conversation, client);
  insert into public.conversation_participants(conversation_id, user_id) values (conversation, client);
  insert into public.messages(conversation_id, sender_id, body) values (conversation, client, 'Consulta prueba');

  perform public.admin_delete_record('products', product);
  perform public.admin_delete_record('services', service);
  perform public.admin_delete_record('barbers', barber);
  assert not exists (select 1 from public.products where id = product);
  assert not exists (select 1 from public.services where id = service);
  assert not exists (select 1 from public.barber_profiles where id = barber);
  assert exists (select 1 from auth.users where id = employee), 'La cuenta personal del peluquero debe conservarse';
  assert not exists (select 1 from public.user_roles where user_id = employee and role = 'barber');
  assert exists (select 1 from public.sale_items where id = extra_line and barber_id is null and barber_id_snapshot = barber), 'El adicional debe conservarse';
  assert exists (select 1 from public.sale_items where id = product_line and product_id is null and product_id_snapshot = product);
  assert exists (select 1 from public.payouts where id = payout and barber_id is null and barber_name_snapshot = 'Peluquero prueba' and total_amount = 25);
  assert exists (select 1 from public.gallery_posts where id = gallery and barber_id is null and service_id is null);
  assert exists (select 1 from jsonb_array_elements(public.admin_business_analytics()->'top_barbers') entry where entry->>'id' = barber::text);

  -- Esta devolucion debe mantener intacto el saldo global del cliente.
  perform public.reverse_counter_sale(sale, 'Prueba de devolucion tras baja');
  assert (select balance = 100 from public.loyalty_accounts where user_id = client);
  assert (select status = 'refunded' from public.sales where id = sale);

  -- Volvemos a cobrar solo para verificar la devolucion despues del borrado del cliente.
  update public.sales set status = 'paid' where id = sale;
  update public.payments set status = 'confirmed' where sale_id = sale;
  update public.reward_redemptions set status = 'used', sale_id = sale where id = redemption;
  perform public.admin_delete_record('clients', client);
  assert not exists (select 1 from auth.users where id = client);
  assert not exists (select 1 from public.profiles where id = client);
  assert not exists (select 1 from public.conversations where id = conversation);
  assert exists (select 1 from public.appointments where id = appointment and client_id is null and barber_id is null and service_id is null and client_name_snapshot = deleted_client_name);
  assert exists (select 1 from public.sales where id = sale and client_id is null and guest_name = deleted_client_name and paid_total = 80);
  assert exists (select 1 from public.receipts where sale_id = sale);
  assert exists (select 1 from public.reward_redemptions where id = redemption and user_id is null);
  perform public.reverse_counter_sale(sale, 'Prueba devolucion cliente eliminado');
  assert (select status = 'refunded' from public.sales where id = sale);

  perform public.admin_delete_record('gallery', gallery);
  assert not exists (select 1 from public.gallery_posts where id = gallery);
  perform pg_temp.expect_delete_blocked('gallery', gallery, 'ya no existe');
  assert (select count(*) = 5 from public.audit_logs where actor_id = administrator and action = 'record_permanently_deleted');
end;
$$;

rollback;
