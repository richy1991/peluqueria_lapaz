-- Edición auditable y vinculación de fichas públicas con cuentas Google.
alter table public.pending_barbers
  add column if not exists barber_profile_id uuid references public.barber_profiles(id);

create or replace function public.link_barber_account(target_barber_id uuid, target_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare target_user uuid; barber public.barber_profiles%rowtype;
begin
  if not public.is_admin() then raise exception 'Acceso administrativo requerido'; end if;
  select * into barber from public.barber_profiles where id=target_barber_id;
  if not found then raise exception 'Peluquero no encontrado'; end if;
  select id into target_user from public.profiles where lower(email)=lower(trim(target_email));
  if target_user is not null then
    if exists(select 1 from public.barber_profiles where user_id=target_user and id<>target_barber_id) then raise exception 'La cuenta ya está vinculada a otro peluquero'; end if;
    update public.barber_profiles set user_id=target_user,active=true,updated_at=now() where id=target_barber_id;
    insert into public.user_roles(user_id,role) values(target_user,'barber') on conflict do nothing;
    insert into public.notifications(user_id,type,title,body) values(target_user,'account_update','Perfil de peluquero activado','Ya puedes acceder a tu agenda de trabajo.');
  else
    insert into public.pending_barbers(email,full_name,specialties,bio,commission_percent,status,invited_by,expires_at,barber_profile_id)
    values(lower(trim(target_email)),barber.display_name,barber.specialties,barber.bio,barber.commission_percent,'pending',auth.uid(),now()+interval '30 days',target_barber_id)
    on conflict(email) do update set full_name=excluded.full_name,specialties=excluded.specialties,bio=excluded.bio,commission_percent=excluded.commission_percent,status='pending',invited_by=auth.uid(),expires_at=excluded.expires_at,barber_profile_id=excluded.barber_profile_id;
  end if;
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'barber_account_linked','barber_profiles',target_barber_id::text,jsonb_build_object('email',lower(trim(target_email))));
end; $$;

create or replace function public.admin_update_barber(target_barber_id uuid, public_name text, biography text, barber_specialties text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Acceso administrativo requerido'; end if;
  update public.barber_profiles set display_name=trim(public_name),bio=nullif(trim(biography),''),specialties=barber_specialties,updated_at=now() where id=target_barber_id;
  if not found then raise exception 'Peluquero no encontrado'; end if;
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'barber_updated','barber_profiles',target_barber_id::text,'{}');
end; $$;

create or replace function public.admin_update_product(target_product_id uuid, product_name text, product_description text, product_category text, product_price numeric, product_stock integer, product_image_path text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Acceso administrativo requerido'; end if;
  if product_price<0 or product_stock<0 then raise exception 'Precio y stock deben ser positivos'; end if;
  update public.products set name=trim(product_name),description=nullif(trim(product_description),''),category=nullif(trim(product_category),''),price=product_price,stock=product_stock,image_path=coalesce(product_image_path,image_path),updated_at=now() where id=target_product_id;
  if not found then raise exception 'Producto no encontrado'; end if;
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'product_updated','products',target_product_id::text,jsonb_build_object('price',product_price,'stock',product_stock));
end; $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare pending public.pending_barbers%rowtype; target_barber_id uuid;
begin
  insert into public.profiles(id,email,full_name,avatar_url) values(new.id,coalesce(new.email,''),new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'avatar_url')
  on conflict(id) do update set email=excluded.email,full_name=coalesce(excluded.full_name,public.profiles.full_name),avatar_url=coalesce(excluded.avatar_url,public.profiles.avatar_url);
  insert into public.user_roles(user_id,role) values(new.id,'client') on conflict do nothing;
  select * into pending from public.pending_barbers where lower(email)=lower(coalesce(new.email,'')) and status='pending' and expires_at>now() order by created_at desc limit 1;
  if found then
    if pending.barber_profile_id is not null then
      update public.barber_profiles set user_id=new.id,active=true,updated_at=now() where id=pending.barber_profile_id returning id into target_barber_id;
    else
      insert into public.barber_profiles(user_id,slug,display_name,bio,specialties,commission_percent,active)
      values(new.id,regexp_replace(lower(pending.full_name),'[^a-z0-9]+','-','g')||'-'||substr(new.id::text,1,6),pending.full_name,pending.bio,pending.specialties,pending.commission_percent,true)
      on conflict(user_id) do update set display_name=excluded.display_name,bio=excluded.bio,specialties=excluded.specialties,commission_percent=excluded.commission_percent,active=true returning id into target_barber_id;
    end if;
    insert into public.user_roles(user_id,role) values(new.id,'barber') on conflict do nothing;
    update public.pending_barbers set status='accepted',accepted_at=now() where id=pending.id;
    insert into public.notifications(user_id,type,title,body) values(new.id,'account_update','Perfil de peluquero activado','Ya puedes acceder a tu agenda de trabajo.');
  end if;
  return new;
end; $$;

revoke all on function public.link_barber_account(uuid,text) from public;
revoke all on function public.admin_update_barber(uuid,text,text,text[]) from public;
revoke all on function public.admin_update_product(uuid,text,text,text,numeric,integer,text) from public;
grant execute on function public.link_barber_account(uuid,text) to authenticated;
grant execute on function public.admin_update_barber(uuid,text,text,text[]) to authenticated;
grant execute on function public.admin_update_product(uuid,text,text,text,numeric,integer,text) to authenticated;
