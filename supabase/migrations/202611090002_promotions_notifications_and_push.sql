-- Promociones visibles, notificaciones deduplicadas y suscripciones push.

alter table public.promotions
  add column if not exists service_id uuid references public.services(id),
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_promotion_updated_at()
returns trigger language plpgsql
as $$
begin
  new.updated_at:=now();
  return new;
end;
$$;

drop trigger if exists promotions_touch_updated_at on public.promotions;
create trigger promotions_touch_updated_at
before update on public.promotions
for each row execute function public.touch_promotion_updated_at();

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  subscription jsonb not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;
drop policy if exists "Users manage own push subscriptions" on public.push_subscriptions;
create policy "Users manage own push subscriptions" on public.push_subscriptions
for all to authenticated
using (user_id=auth.uid())
with check (user_id=auth.uid());
grant select, insert, update, delete on public.push_subscriptions to authenticated;

create unique index if not exists notifications_dedupe_key_unique
on public.notifications(user_id, ((data->>'dedupe_key')))
where data ? 'dedupe_key';

create or replace function public.create_user_notification(
  target_user uuid,
  notification_type text,
  notification_title text,
  notification_body text,
  notification_data jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path=''
as $$
declare preferences public.notification_preferences%rowtype;
begin
  select * into preferences from public.notification_preferences where user_id=target_user;
  if coalesce(preferences.muted_all,false) then return; end if;
  if notification_type in ('appointment','appointment_update')
     and coalesce(preferences.appointment_notifications,true)=false then return; end if;
  if notification_type in ('promotion','points','reward')
     and coalesce(preferences.promotion_notifications,true)=false then return; end if;
  if notification_type in ('chat','message')
     and coalesce(preferences.chat_notifications,true)=false then return; end if;
  if notification_type not in ('appointment','appointment_update','promotion','points','reward','chat','message')
     and coalesce(preferences.system_notifications,true)=false then return; end if;
  insert into public.notifications(user_id,type,title,body,data)
  values(target_user,notification_type,notification_title,notification_body,coalesce(notification_data,'{}'::jsonb))
  on conflict do nothing;
end;
$$;

create or replace function public.notify_appointment_change()
returns trigger language plpgsql security definer set search_path=''
as $$
declare barber_user uuid; notification_kind text; notification_key text;
begin
  notification_kind:=case when tg_op='INSERT' then 'appointment' else 'appointment_update' end;
  notification_key:='appointment:'||new.id::text||':'||new.status||':'||new.starts_at::text;
  if new.client_id is not null then
    perform public.create_user_notification(new.client_id,notification_kind,
      case when tg_op='INSERT' then 'Cita solicitada' else 'Cita actualizada' end,
      new.service_name_snapshot||' · '||to_char(new.starts_at at time zone 'America/La_Paz','DD/MM HH24:MI'),
      jsonb_build_object('dedupe_key',notification_key,'appointment_id',new.id));
  end if;
  select bp.user_id into barber_user from public.barber_profiles bp where bp.id=new.barber_id;
  if barber_user is not null then
    perform public.create_user_notification(barber_user,notification_kind,
      case when tg_op='INSERT' then 'Nueva cita asignada' else 'Cita actualizada' end,
      coalesce(new.client_name_snapshot,'Cliente')||' · '||new.service_name_snapshot||' · '||to_char(new.starts_at at time zone 'America/La_Paz','DD/MM HH24:MI'),
      jsonb_build_object('dedupe_key',notification_key,'appointment_id',new.id));
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_notify_users on public.appointments;
create trigger appointments_notify_users
after insert or update of status,starts_at,barber_id,service_name_snapshot
on public.appointments
for each row execute function public.notify_appointment_change();

create or replace function public.notify_loyalty_change()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  perform public.create_user_notification(
    new.user_id,
    case when new.kind='redeem' then 'reward' else 'points' end,
    case when new.kind='redeem' then 'Canje registrado' else 'Puntos actualizados' end,
    new.reason||' · '||case when new.points>0 then '+' else '' end||new.points||' puntos',
    jsonb_build_object('dedupe_key','loyalty:'||new.id::text,'transaction_id',new.id)
  );
  return new;
end;
$$;

drop trigger if exists loyalty_transactions_notify_users on public.loyalty_transactions;
create trigger loyalty_transactions_notify_users
after insert on public.loyalty_transactions
for each row execute function public.notify_loyalty_change();

create or replace function public.notify_new_promotion()
returns trigger language plpgsql security definer set search_path=''
as $$
declare profile_id uuid;
begin
  if new.active and (new.starts_at is null or new.starts_at<=now()) and (new.ends_at is null or new.ends_at>now()) then
    for profile_id in select id from public.profiles where status='active' loop
      perform public.create_user_notification(
        profile_id,'promotion','Nueva promoción disponible',
        new.name||' · usa el código '||new.code,
        jsonb_build_object('dedupe_key','promotion:'||new.id::text||':'||new.updated_at::text,'promotion_id',new.id)
      );
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists promotions_notify_users on public.promotions;
create trigger promotions_notify_users
after insert or update of active,starts_at,ends_at,updated_at
on public.promotions
for each row execute function public.notify_new_promotion();

revoke all on function public.create_user_notification(uuid,text,text,text,jsonb) from public;
grant execute on function public.create_user_notification(uuid,text,text,text,jsonb) to authenticated;
