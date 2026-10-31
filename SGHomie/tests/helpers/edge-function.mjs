import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import {
  boundFeedbackConversation, serializeFeedbackJson, serializeFeedbackMarkdown, serializeFeedbackText,
} from '../../BackEnd/supabase/functions/_shared/feedbackConversation.ts';
import { isCanaryModelVersion, isCanaryRequestId, validateValuationCanaryResponse } from '../../BackEnd/supabase/functions/_shared/valuationCanary.ts';

// Run the actual Deno handler in an isolated realm. Only external SDK imports,
// secrets, network and logging are substituted; business logic is unchanged.
export async function loadEdgeFunction(name, { env = {}, createClient, fetch, SMTPClient } = {}) {
  const path = new URL(`../../BackEnd/supabase/functions/${name}/index.ts`, import.meta.url);
  const source = (await readFile(path, 'utf8'))
    .replace(/^import \{ createClient \} from 'npm:@supabase\/supabase-js@2\.114\.0';\r?\n/m, '')
    .replace(/^import \{[\s\S]*?\} from '\.\.\/_shared\/feedbackConversation\.ts';\r?\n/m, '')
    .replace(/^import \{ isCanaryModelVersion, isCanaryRequestId, validateValuationCanaryResponse \} from '\.\.\/_shared\/valuationCanary\.ts';\r?\n/m, '')
    .replace(/^import \{ SMTPClient \} from "npm:emailjs@4\.0\.3";\r?\n/m, '');
  let handler;
  const logs = [];
  const context = vm.createContext({
    createClient: createClient ?? (() => { throw new Error('Unexpected SDK call'); }),
    boundFeedbackConversation, serializeFeedbackJson, serializeFeedbackMarkdown, serializeFeedbackText,
    isCanaryModelVersion, isCanaryRequestId, validateValuationCanaryResponse,
    SMTPClient: SMTPClient ?? class { constructor() { throw new Error('Unexpected SMTP call'); } },
    fetch: fetch ?? (() => { throw new Error('Unexpected network call'); }),
    Deno: { env: { get: key => env[key] }, serve: callback => { handler = callback; } },
    console: Object.fromEntries(['log', 'info', 'warn', 'error'].map(level => [level, (...args) => logs.push({ level, args })])),
    Request, Response, Headers, URL, URLSearchParams, crypto, Error, Date, AbortSignal, performance,
  });
  vm.runInContext(stripTypeScriptTypes(source), context, { filename: path.pathname });
  if (typeof handler !== 'function') throw new Error(`No handler registered by ${name}`);
  return { handler, logs };
}

export function edgeRequest(body, { method = 'POST', headers = {}, raw } = {}) {
  return new Request('https://functions.example.test/fixture', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(!['GET', 'HEAD', 'OPTIONS'].includes(method) ? { body: raw ?? JSON.stringify(body ?? {}) } : {}),
  });
}
