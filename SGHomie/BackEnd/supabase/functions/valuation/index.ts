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
  persistMonitoring: async (event, alert) => {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const failed = (sink: string, failureClass: string) => console.error(JSON.stringify({
      event: 'telemetry_persist_failed', request_id: event.request_id,
      telemetry_sink: sink, failure_class: failureClass,
    }));
    if (!url || !serviceKey) {
      failed('valuation_events', 'configuration_unavailable');
      return;
    }
    let service: ReturnType<typeof createClient>;
    try {
      service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    } catch {
      failed('valuation_events', 'client_unavailable');
      return;
    }
    try {
      const { error } = await service.from('valuation_events').upsert(event, {
        onConflict: 'request_id', ignoreDuplicates: true,
      });
      if (error) failed('valuation_events', 'write_failed');
    } catch {
      failed('valuation_events', 'write_failed');
    }
    if (alert) {
      try {
        const { error } = await service.rpc('record_monitoring_alert', {
          p_severity: alert.severity,
          p_source: alert.source,
          p_category: alert.category,
          p_request_id: alert.requestId,
        });
        if (error) failed('system_alerts', 'write_failed');
      } catch {
        failed('system_alerts', 'write_failed');
      }
    }
  },
  scheduleBackgroundTask: (task) => EdgeRuntime.waitUntil(task),
}));
