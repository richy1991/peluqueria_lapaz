alter table public.gallery_posts
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists source_type text not null default 'own_work'
    check (source_type in ('own_work', 'reference')),
  add column if not exists source_url text;

drop policy if exists "Public can read published gallery" on public.gallery_posts;
create policy "Public can read published gallery"
  on public.gallery_posts for select
  using (
    status = 'published'
    and (
      (source_type = 'own_work' and client_consent)
      or (source_type = 'reference' and source_url is not null)
    )
  );

create policy "Barbers read own gallery"
  on public.gallery_posts for select to authenticated
  using (
    exists (
      select 1 from public.barber_profiles barber
      where barber.id = barber_id and barber.user_id = auth.uid()
    )
  );

create policy "Barbers upload own public media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'public-media'
    and (storage.foldername(name))[1] = 'barbers'
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1 from public.barber_profiles barber
      where barber.user_id = auth.uid() and barber.active
    )
  );

create policy "Barbers update own public media"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'public-media'
    and (storage.foldername(name))[1] = 'barbers'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'public-media'
    and (storage.foldername(name))[1] = 'barbers'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "Barbers delete own public media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'public-media'
    and (storage.foldername(name))[1] = 'barbers'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create or replace function public.update_my_barber_profile(
  public_name text,
  biography text,
  barber_specialties text[],
  profile_photo_path text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  barber_id uuid;
  clean_name text := trim(coalesce(public_name, ''));
begin
  select id into barber_id
  from public.barber_profiles
  where user_id = auth.uid() and active;

  if barber_id is null then
    raise exception 'No existe un perfil de peluquero activo para esta cuenta.' using errcode = 'P0001';
  end if;
  if length(clean_name) < 2 or length(clean_name) > 80 then
    raise exception 'El nombre público debe tener entre 2 y 80 caracteres.' using errcode = 'P0001';
  end if;
  if profile_photo_path is not null
    and profile_photo_path not like ('barbers/' || auth.uid()::text || '/%') then
    raise exception 'La fotografía no pertenece a tu carpeta personal.' using errcode = 'P0001';
  end if;

  update public.barber_profiles
  set display_name = clean_name,
      bio = nullif(trim(coalesce(biography, '')), ''),
      specialties = coalesce(barber_specialties, '{}'),
      photo_path = coalesce(profile_photo_path, photo_path),
      updated_at = now()
  where id = barber_id;

  insert into public.audit_logs(actor_id, action, entity, entity_id, data)
  values (auth.uid(), 'barber_public_profile_updated', 'barber_profiles', barber_id::text, '{}');
end;
$$;

create or replace function public.barber_publish_gallery(
  post_title text,
  post_description text,
  post_image_path text,
  post_source_type text default 'own_work',
  post_source_url text default null,
  has_client_consent boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  barber_id uuid;
  post_id uuid;
  clean_title text := trim(coalesce(post_title, ''));
  clean_source text := lower(trim(coalesce(post_source_type, 'own_work')));
  clean_url text := nullif(trim(coalesce(post_source_url, '')), '');
begin
  select id into barber_id
  from public.barber_profiles
  where user_id = auth.uid() and active;

  if barber_id is null then
    raise exception 'No existe un perfil de peluquero activo para esta cuenta.' using errcode = 'P0001';
  end if;
  if length(clean_title) < 2 or length(clean_title) > 120 then
    raise exception 'El título debe tener entre 2 y 120 caracteres.' using errcode = 'P0001';
  end if;
  if post_image_path is null
    or post_image_path not like ('barbers/' || auth.uid()::text || '/%') then
    raise exception 'La imagen no pertenece a tu carpeta personal.' using errcode = 'P0001';
  end if;
  if clean_source not in ('own_work', 'reference') then
    raise exception 'El tipo de publicación no es válido.' using errcode = 'P0001';
  end if;
  if clean_source = 'own_work' and not has_client_consent then
    raise exception 'Debes confirmar la autorización del cliente.' using errcode = 'P0001';
  end if;
  if clean_source = 'reference' and (clean_url is null or clean_url !~* '^https?://') then
    raise exception 'Una referencia debe incluir el enlace de la fuente.' using errcode = 'P0001';
  end if;

  insert into public.gallery_posts(
    title, description, image_path, barber_id, status, client_consent,
    consent_date, created_by, source_type, source_url
  ) values (
    clean_title, nullif(trim(coalesce(post_description, '')), ''), post_image_path,
    barber_id, 'published', has_client_consent,
    case when has_client_consent then now() else null end,
    auth.uid(), clean_source, clean_url
  ) returning id into post_id;

  insert into public.audit_logs(actor_id, action, entity, entity_id, data)
  values (auth.uid(), 'barber_gallery_published', 'gallery_posts', post_id::text,
    jsonb_build_object('source_type', clean_source));

  return post_id;
end;
$$;

revoke all on function public.update_my_barber_profile(text, text, text[], text) from public;
revoke all on function public.barber_publish_gallery(text, text, text, text, text, boolean) from public;
grant execute on function public.update_my_barber_profile(text, text, text[], text) to authenticated;
grant execute on function public.barber_publish_gallery(text, text, text, text, text, boolean) to authenticated;
