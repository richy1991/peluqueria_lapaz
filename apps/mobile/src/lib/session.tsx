import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type AppRole = 'client' | 'barber' | 'unsupported';
export type BarberProfile = { id: string; display_name: string };

type SessionContextValue = {
  session: Session | null;
  role: AppRole | null;
  barber: BarberProfile | null;
  loading: boolean;
  roleError: string;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [barber, setBarber] = useState<BarberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleError, setRoleError] = useState('');
  const requestId = useRef(0);

  const loadRole = useCallback(async (current: Session | null) => {
    const currentRequest = ++requestId.current;
    setRoleError('');
    if (!current) {
      setRole(null);
      setBarber(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [adminResult, cashierResult, barberResult, rolesResult] = await Promise.all([
      supabase.rpc('is_admin'),
      supabase.rpc('is_cashier'),
      supabase.from('barber_profiles').select('id,display_name').eq('user_id', current.user.id).eq('active', true).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', current.user.id),
    ]);
    if (currentRequest !== requestId.current) return;

    if (adminResult.error || cashierResult.error || barberResult.error || rolesResult.error) {
      setRoleError(adminResult.error?.message ?? cashierResult.error?.message ?? barberResult.error?.message ?? rolesResult.error?.message ?? 'No se pudo validar tu acceso.');
      setRole(null);
      setBarber(null);
    } else if (adminResult.data || cashierResult.data) {
      setRole('unsupported');
      setBarber(null);
    } else if (barberResult.data) {
      setRole('barber');
      setBarber({ id: barberResult.data.id, display_name: barberResult.data.display_name });
    } else if ((rolesResult.data ?? []).some((item) => item.role === 'client')) {
      setRole('client');
      setBarber(null);
    } else {
      setRole('unsupported');
      setBarber(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setRoleError(error.message);
      setSession(data.session);
      void loadRole(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setRole(null);
      setBarber(null);
      setLoading(true);
      // Supabase auth methods are kept outside its auth-state callback.
      setTimeout(() => { if (active) void loadRole(nextSession); }, 0);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadRole]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const refreshRole = useCallback(async () => loadRole(session), [loadRole, session]);

  return (
    <SessionContext.Provider value={{ session, role, barber, loading, roleError, signOut, refreshRole }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession debe usarse dentro de SessionProvider');
  return context;
}
