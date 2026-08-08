-- Sincroniza el nombre comercial definitivo sin alterar datos administrables.
update public.business_settings
set
  business_name = 'Barbería LEGEND CLUB',
  description = 'Tradición, calle y precisión en cada corte.',
  updated_at = timezone('utc', now())
where id = 1;
