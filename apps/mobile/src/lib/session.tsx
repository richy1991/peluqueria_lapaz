import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type AppRole = 'client' | 'barber' | 'unsupported';
export type BarberProfile = { id: string; display_name: string };

type SessionContextValue = {
  session: Session | null;
  role: AppRole | null;
  barber: BarberProfile | null;
  profileComplete: boolean;
  loading: boolean;
  roleError: string;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);
const roleCheckTimeoutMs = 15_000;

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [barber, setBarber] = useState<BarberProfile | null>(null);
  const [profileComplete, setProfileComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roleError, setRoleError] = useState('');
  const requestId = useRef(0);
  const authEventReceived = useRef(false);

  const loadRole = useCallback(async (current: Session | null) => {
    const currentRequest = ++requestId.current;
    setRoleError('');
    if (!current) {
      setRole(null);
      setBarber(null);
      setProfileComplete(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), roleCheckTimeoutMs);
    try {
      const [adminResult, cashierResult, barberResult, rolesResult, profileResult] = await Promise.all([
        supabase.rpc('is_admin').abortSignal(controller.signal),
        supabase.rpc('is_cashier').abortSignal(controller.signal),
        supabase.from('barber_profiles').select('id,display_name').eq('user_id', current.user.id).eq('active', true).abortSignal(controller.signal).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', current.user.id).abortSignal(controller.signal),
        supabase.from('profiles').select('full_name,phone').eq('id', current.user.id).abortSignal(controller.signal).maybeSingle(),
      ]);
      if (currentRequest !== requestId.current) return;

      const queryError = adminResult.error ?? cashierResult.error ?? barberResult.error ?? rolesResult.error ?? profileResult.error;
      if (queryError) {
        setRoleError(queryError.message);
        setRole(null);
        setBarber(null);
        setProfileComplete(false);
      } else {
        setProfileComplete(Boolean(profileResult.data?.full_name?.trim() && profileResult.data?.phone?.trim()));
      }

      if (!queryError && (adminResult.data || cashierResult.data)) {
        setRole('unsupported');
        setBarber(null);
      } else if (!queryError && barberResult.data) {
        setRole('barber');
        setBarber({ id: barberResult.data.id, display_name: barberResult.data.display_name });
      } else if (!queryError && (rolesResult.data ?? []).some((item) => item.role === 'client')) {
        setRole('client');
        setBarber(null);
      } else if (!queryError) {
        setRole('unsupported');
        setBarber(null);
      }
    } catch (reason) {
      if (currentRequest !== requestId.current) return;
      setRoleError(controller.signal.aborted
        ? 'La validación tardó demasiado. Revisa tu conexión e inténtalo de nuevo.'
        : reason instanceof Error ? reason.message : 'No se pudo validar tu acceso. Revisa tu conexión e inténtalo de nuevo.');
      setRole(null);
      setBarber(null);
      setProfileComplete(false);
    } finally {
      clearTimeout(timeout);
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || authEventReceived.current) return;
      if (error) setRoleError(error.message);
      setSession(data.session);
      void loadRole(data.session);
    }).catch((reason: unknown) => {
      if (!active || authEventReceived.current) return;
      setRoleError(reason instanceof Error ? reason.message : 'No se pudo recuperar la sesión.');
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventReceived.current = true;
      setSession(nextSession);
      if (_event === 'TOKEN_REFRESHED' || _event === 'USER_UPDATED') return;
      setRole(null);
      setBarber(null);
      setLoading(true);
      // Supabase auth methods are kept outside its auth-state callback.
      setTimeout(() => { if (active) void loadRole(nextSession); }, 0);
    });
    return () => {
      active = false;
      requestId.current += 1;
      listener.subscription.unsubscribe();
    };
  }, [loadRole]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const refreshRole = useCallback(async () => loadRole(session), [loadRole, session]);
  const value = useMemo(() => ({ session, role, barber, profileComplete, loading, roleError, signOut, refreshRole }), [session, role, barber, profileComplete, loading, roleError, signOut, refreshRole]);

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession debe usarse dentro de SessionProvider');
  return context;
}
