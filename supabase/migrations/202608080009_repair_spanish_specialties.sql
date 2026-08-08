-- Repara acentos que estaban dentro de arreglos de especialidades.
update public.barber_profiles
set specialties = array['Fades', 'Cortes clásicos', 'Barba']
where id = '20000000-0000-4000-8000-000000000001';

update public.barber_profiles
set specialties = array['Cortes largos', 'Color', 'Asesoría de imagen']
where id = '20000000-0000-4000-8000-000000000003';
