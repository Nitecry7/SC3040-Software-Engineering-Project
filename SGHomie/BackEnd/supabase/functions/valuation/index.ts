import { createClient } from 'npm:@supabase/supabase-js@2.114.0';
import { createValuationHandler } from '../_shared/valuation.ts';

Deno.serve(createValuationHandler({
  supabaseUrl: Deno.env.get('SUPABASE_URL'),
  supabaseAnonKey: Deno.env.get('SUPABASE_ANON_KEY'),
  renderApiUrl: Deno.env.get('VALUATION_API_URL'),
  renderServiceToken: Deno.env.get('VALUATION_SERVICE_TOKEN'),
  allowDemoInputs: Deno.env.get('VALUATION_ALLOW_DEMO_INPUTS'),
  allowHostedDemoInputs: Deno.env.get('VALUATION_ALLOW_HOSTED_DEMO_INPUTS'),
  edgeRegion: Deno.env.get('SB_REGION'),
  createUserClient: (url, anonKey, authorization) => createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  }),
}));
