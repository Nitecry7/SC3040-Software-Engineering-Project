import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfigError } from './supabaseConfig';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';
const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL?.trim() || supabaseUrl;

const configError = getSupabaseConfigError();
if (configError) {
  throw new Error(configError);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Keep database/auth on the configured Supabase project while allowing local
// Edge Functions to run against http://127.0.0.1:54321 during development.
export const functionsSupabase = functionsUrl === supabaseUrl
  ? supabase
  : createClient(functionsUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

export const chatbotSupabase = functionsSupabase;

// Handle auth state changes
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    localStorage.clear();
  }
});
