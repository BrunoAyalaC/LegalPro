import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: 'legalpro_supabase_auth',
  },
  db: { schema: 'public' },
  realtime: { params: { eventsPerSecond: 5 } },
  global: { headers: { 'x-application-name': 'legalpro-web-frontend' } },
});

export async function setSupabaseSession(jwt) {
  if (!jwt) return;
  await supabase.auth.setSession({ access_token: jwt, refresh_token: '' }).catch(() => {});
}
