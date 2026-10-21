-- Los puntos se canjean únicamente dentro del cobro confirmado en caja.
update public.loyalty_settings
set referral_referrer_points=10,updated_at=now()
where id=true;

do $$
declare
  redemption record;
begin
  for redemption in
    select id,user_id,barber_id,reward_id,points_spent
    from public.reward_redemptions
    where status='pending'
    for update
  loop
    if redemption.barber_id is not null then
      perform public.post_customer_barber_points(
        redemption.user_id,
        redemption.barber_id,
        redemption.points_spent,
        'reverse',
        'Devolución por cambio del flujo de canje',
        'migration-cashier-only:'||redemption.id,
        'reward',
        redemption.reward_id
      );
    else
      perform public.post_loyalty_points(
        redemption.user_id,
        redemption.points_spent,
        'reverse',
        'Devolución por cambio del flujo de canje',
        'migration-cashier-only:'||redemption.id,
        'reward',
        redemption.reward_id
      );
    end if;
    update public.reward_redemptions
    set status='canceled',canceled_at=now()
    where id=redemption.id;
  end loop;
end;
$$;

drop function if exists public.request_reward_redemption(uuid,uuid);
drop function if exists public.cancel_reward_redemption(uuid);
