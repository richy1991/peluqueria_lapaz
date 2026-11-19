drop policy if exists "Users delete own notifications" on public.notifications;
create policy "Users delete own notifications"
on public.notifications
for delete
to authenticated
using (user_id = auth.uid());

grant delete on public.notifications to authenticated;
