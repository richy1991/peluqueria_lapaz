-- Dashboard operativo de reservas y administración segura de clientes.

create or replace function public.admin_set_appointment_status(target_appointment_id uuid, next_status text, reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare appt public.appointments%rowtype;
begin
  if not public.is_admin() then raise exception 'Acceso administrativo requerido'; end if;
  if next_status not in ('confirmed','canceled','needs_reschedule') then raise exception 'Estado administrativo no permitido'; end if;
  select * into appt from public.appointments where id=target_appointment_id for update;
  if not found then raise exception 'Cita no encontrada'; end if;
  update public.appointments set status=next_status,emergency_reason=reason,updated_at=now() where id=appt.id;
  insert into public.notifications(user_id,type,title,body,data) values(appt.client_id,case when next_status='canceled' then 'appointment_canceled' else 'appointment_rescheduled' end,'Actualización de tu cita',case when next_status='canceled' then 'El negocio canceló tu cita.' else 'Tu cita requiere una actualización.' end,jsonb_build_object('appointment_id',appt.id,'reason',reason));
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'appointment_'||next_status,'appointments',appt.id::text,jsonb_build_object('reason',reason));
end; $$;

create or replace function public.admin_reassign_appointment(target_appointment_id uuid, target_barber_id uuid, target_starts_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare appt public.appointments%rowtype; previous_barber uuid; new_end timestamptz;
begin
  if not public.is_admin() then raise exception 'Acceso administrativo requerido'; end if;
  select * into appt from public.appointments where id=target_appointment_id for update;
  if not found then raise exception 'Cita no encontrada'; end if;
  if target_starts_at<=now() then raise exception 'El nuevo horario debe ser futuro'; end if;
  if not exists(select 1 from public.barber_profiles where id=target_barber_id and active) then raise exception 'El peluquero no está disponible'; end if;
  new_end:=target_starts_at+make_interval(mins=>appt.duration_snapshot); previous_barber:=appt.barber_id;
  update public.appointments set barber_id=target_barber_id,reassigned_from_barber_id=previous_barber,starts_at=target_starts_at,ends_at=new_end,blocked_until=new_end+interval '5 minutes',status='pending_client_confirmation',client_confirmation_status='pending',updated_at=now() where id=appt.id;
  insert into public.notifications(user_id,type,title,body,data) values(appt.client_id,'appointment_rescheduled','Confirma tu nuevo horario','El negocio propuso un nuevo peluquero u horario para tu cita.',jsonb_build_object('appointment_id',appt.id));
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'appointment_reassigned','appointments',appt.id::text,jsonb_build_object('from_barber',previous_barber,'to_barber',target_barber_id,'starts_at',target_starts_at));
exception when exclusion_violation then raise exception 'El nuevo horario se superpone con otra cita';
end; $$;

create or replace function public.confirm_reassigned_appointment(target_appointment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.appointments set status='confirmed',client_confirmation_status='confirmed',updated_at=now()
  where id=target_appointment_id and client_id=auth.uid() and status='pending_client_confirmation';
  if not found then raise exception 'No hay una reprogramación pendiente'; end if;
end; $$;

create or replace function public.admin_update_client(target_user_id uuid, next_status text, blocked boolean, reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Acceso administrativo requerido'; end if;
  if target_user_id=auth.uid() then raise exception 'No puedes modificar tu propia cuenta'; end if;
  if exists(select 1 from public.user_roles where user_id=target_user_id and role in ('admin','superadmin')) then raise exception 'Las cuentas administrativas se gestionan desde Superadmin'; end if;
  if next_status not in ('active','inactive','deactivated','suspended') then raise exception 'Estado de cliente no permitido'; end if;
  update public.profiles set status=next_status,is_blocked=blocked,blocked_reason=case when blocked then reason else null end,blocked_by=case when blocked then auth.uid() else null end,blocked_at=case when blocked then now() else null end,updated_at=now() where id=target_user_id;
  if not found then raise exception 'Cliente no encontrado'; end if;
  insert into public.notifications(user_id,type,title,body) values(target_user_id,'account_update','Estado de tu cuenta',case when blocked then 'Tu cuenta fue bloqueada. Contacta al negocio.' when next_status='active' then 'Tu cuenta está activa.' else 'Tu cuenta cambió a estado: '||next_status end);
  insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'client_access_updated','profiles',target_user_id::text,jsonb_build_object('status',next_status,'blocked',blocked,'reason',reason));
end; $$;

revoke all on function public.admin_set_appointment_status(uuid,text,text) from public;
revoke all on function public.admin_reassign_appointment(uuid,uuid,timestamptz) from public;
revoke all on function public.confirm_reassigned_appointment(uuid) from public;
revoke all on function public.admin_update_client(uuid,text,boolean,text) from public;
grant execute on function public.admin_set_appointment_status(uuid,text,text) to authenticated;
grant execute on function public.admin_reassign_appointment(uuid,uuid,timestamptz) to authenticated;
grant execute on function public.confirm_reassigned_appointment(uuid) to authenticated;
grant execute on function public.admin_update_client(uuid,text,boolean,text) to authenticated;
