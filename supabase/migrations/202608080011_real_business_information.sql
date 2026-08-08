-- Información real y editable de Barbería LEGEND CLUB.
alter table public.business_settings
  add column if not exists slogan text,
  add column if not exists amenities text[] not null default '{}';

update public.business_settings
set
  business_name = 'Barbería LEGEND CLUB',
  description = 'Trato personalizado, buen servicio, ambiente cómodo, mucha higiene y Wi-Fi libre.',
  slogan = 'Empezamos como un servicio al cliente y terminamos como amigos.',
  amenities = array['Trato personalizado', 'Buen servicio', 'Ambiente cómodo', 'Mucha higiene', 'Wi-Fi libre'],
  address = 'Av. Jaime Freyre, entre Av. Jaime Zudáñez y Caupolicán, casa N.º 2057, al lado de la Iglesia de los Mormones, La Paz',
  phone = '+591 62600874',
  whatsapp = '59162600874',
  map_url = 'https://maps.app.goo.gl/E2riV3QtnhfvmqKK9?g_st=ac',
  updated_at = now()
where id = true;
