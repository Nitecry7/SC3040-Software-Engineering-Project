const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

const isAnonymousJwt = (key: string) => {
  const payload = key.split('.')[1];
  if (!payload) return false;

  try {
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decodedPayload = atob(normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '='));
    return JSON.parse(decodedPayload).role === 'anon';
  } catch {
    return false;
  }
};

export const getSupabaseConfigError = (): string | null => {
  if (!supabaseUrl || !supabaseAnonKey) {
    return 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in FrontEnd/.env, then restart the development server.';
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    return 'VITE_SUPABASE_URL must be a valid Supabase project URL.';
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol) || /your-project-ref|placeholder|example/i.test(supabaseUrl)) {
    return 'VITE_SUPABASE_URL is still a placeholder. Set it to your actual Supabase project URL.';
  }

  if (supabaseAnonKey.startsWith('sb_secret_')) {
    return 'VITE_SUPABASE_ANON_KEY contains a Supabase secret key. Replace it with the project’s publishable key or legacy anon key; secret keys must never be used in a browser.';
  }

  if (!supabaseAnonKey.startsWith('sb_publishable_') && !isAnonymousJwt(supabaseAnonKey)) {
    return 'VITE_SUPABASE_ANON_KEY must be the project’s publishable key or a legacy anon key from Supabase Project Settings → API.';
  }

  return null;
};
