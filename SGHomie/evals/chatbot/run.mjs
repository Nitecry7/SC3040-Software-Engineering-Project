import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import caseFile from './cases.json' with { type: 'json' };
import { executeCase } from './harness.mjs';
import { exitCodeForResults, makeReport, scoreCase } from './scoring.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const resultsDirectory = path.join(directory, 'results');
const args = process.argv.slice(2);
const modeIndex = args.indexOf('--mode');
const mode = modeIndex >= 0 ? args[modeIndex + 1] : 'deterministic';
if (!['deterministic', 'live'].includes(mode)) throw new Error('Use --mode deterministic or --mode live');

async function liveRun() {
  if (process.env.SGHOMIE_EVAL_LIVE !== '1') throw new Error('Live mode requires SGHOMIE_EVAL_LIVE=1');
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SGHOMIE_EVAL_USER_JWT'];
  if (required.some(key => !process.env[key])) throw new Error('Live mode configuration is incomplete');
  const cases = caseFile.cases.filter(item => item.live_safe).slice(0, 3);
  const results = [];
  let quotaRemaining;
  let resolvedModel = 'unknown';
  for (let index = 0; index < cases.length; index++) {
    if (index > 0 && (quotaRemaining === undefined || quotaRemaining <= 1)) {
      results.push(...cases.slice(index).map(item => ({ id: item.id, category: item.category, criticality: item.criticality, status: 'skipped', failures: ['quota_budget_guard'], human_review_needed: item.requires_human_review === true })));
      break;
    }
    const item = cases[index];
    const body = { ...item.request, stream: false, conversation_id: crypto.randomUUID() };
    let payload = {};
    let status = 0;
    try {
      const response = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/, '')}/functions/v1/chatbot`, {
        method: 'POST',
        headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.SGHOMIE_EVAL_USER_JWT}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      status = response.status;
      payload = await response.json().catch(() => ({}));
      if (typeof payload.model === 'string') resolvedModel = payload.model;
    } catch {
      results.push({ id: item.id, category: item.category, criticality: item.criticality, status: 'failed', failures: ['endpoint_unavailable'], human_review_needed: item.requires_human_review === true });
      break;
    }
    quotaRemaining = payload?.quota?.minute_remaining;
    const failures = [];
    if (status !== 200) failures.push(status === 429 ? 'quota_denied' : 'unexpected_http_status');
    const text = typeof payload.response === 'string' ? payload.response : '';
    if (item.expected?.search_calls === 0 && payload.recommendations) failures.push('unexpected_search_result');
    if (item.expected?.response_must_include && !item.expected.response_must_include.some(part => text.toLowerCase().includes(part.toLowerCase()))) failures.push('missing_expected_behavior');
    results.push({ id: item.id, category: item.category, criticality: item.criticality, status: failures.length ? 'failed' : 'passed', failures, human_review_needed: item.requires_human_review === true });
    if (payload?.quota?.minute_remaining === 0 || payload?.quota?.daily_remaining === 0) {
      results.push(...cases.slice(index + 1).map(remaining => ({ id: remaining.id, category: remaining.category, criticality: remaining.criticality, status: 'skipped', failures: ['quota_budget_guard'], human_review_needed: remaining.requires_human_review === true })));
      break;
    }
  }
  return { results, resolvedModel };
}

const results = [];
let resolvedModel = 'unknown';
if (mode === 'deterministic') {
  for (const item of caseFile.cases) {
    try { results.push(scoreCase(item, await executeCase(item))); }
    catch { results.push({ id: item.id, category: item.category, criticality: item.criticality, status: 'failed', failures: ['fixture_execution_failed'], human_review_needed: item.requires_human_review === true }); }
  }
} else {
  const live = await liveRun();
  results.push(...live.results);
  resolvedModel = live.resolvedModel;
}

const report = makeReport({ mode, results, provider: mode === 'live' ? process.env.SGHOMIE_EVAL_PROVIDER ?? 'unknown' : 'mocked', model: mode === 'live' ? process.env.SGHOMIE_EVAL_MODEL ?? 'unknown' : 'mocked', resolvedModel, promptVersion: process.env.SGHOMIE_EVAL_PROMPT_VERSION ?? 'chatbot-v2' });
if (mode === 'live') report.skipped_case_ids = results.filter(result => result.status === 'skipped').map(result => result.id);
await mkdir(resultsDirectory, { recursive: true });
await writeFile(path.join(resultsDirectory, 'latest.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
const lines = [
  '# SG Homie chatbot evaluation', '',
  `- Mode: ${report.mode}`, `- Timestamp: ${report.timestamp}`, `- Prompt version: ${report.prompt_version}`,
  `- Provider / requested model / resolved model: ${report.provider} / ${report.requested_model} / ${report.resolved_model}`,
  `- Cases: ${report.passed} passed, ${report.failed} failed, ${report.skipped} skipped, ${report.critical_failed} critical failures`,
  `- Human review: ${report.review_needed_case_ids.length} case(s)`,
  `- Failed IDs: ${report.failed_case_ids.join(', ') || 'none'}`,
  `- Review-needed IDs: ${report.review_needed_case_ids.join(', ') || 'none'}`,
  ...(report.skipped_case_ids ? [`- Skipped IDs: ${report.skipped_case_ids.join(', ') || 'none'}`] : []), '',
  '| Category | Total | Passed | Failed |', '| --- | ---: | ---: | ---: |',
  ...Object.entries(report.by_category).map(([category, counts]) => `| ${category} | ${counts.total} | ${counts.passed} | ${counts.failed} |`), '',
  'Reports contain case identifiers and outcome codes only; raw conversation text, credentials, PII and provider errors are excluded.',
];
await writeFile(path.join(resultsDirectory, 'latest.md'), `${lines.join('\n')}\n`, 'utf8');

if (mode === 'deterministic' && report.critical_failed === 0) {
  const baselinePath = path.join(resultsDirectory, 'baseline.json');
  try { await readFile(baselinePath); }
  catch { await writeFile(baselinePath, `${JSON.stringify({ schema_version: 1, eval_set_version: report.eval_set_version, prompt_version: report.prompt_version, results: results.map(({ id, category, criticality, status, failures, human_review_needed }) => ({ id, category, criticality, status, failures, human_review_needed })) }, null, 2)}\n`, 'utf8'); }
}
console.log(`${report.mode}: ${report.passed}/${report.total} passed; ${report.critical_failed} critical failure(s); report in SGHomie/evals/chatbot/results/`);
process.exitCode = exitCodeForResults(results);
