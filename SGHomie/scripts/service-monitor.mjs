// Level 1 service monitor runner. Checks three public endpoints from outside, classifies each
// result deterministically and prints a table plus a JSON document.
// Usage: node SGHomie/scripts/service-monitor.mjs [--fixtures <name>] [--json <path>]
// Fixture mode makes no network call. Output never contains tokens, keys, query strings or bodies.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runChecks } from './monitor/checks.mjs';
import { classify } from './monitor/classify.mjs';
import { buildJson, exitCodeFor, renderTable } from './monitor/report.mjs';

const DEFAULT_TIMEOUT_MS = 60_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 120_000;
const FIXTURE_NAME = /^[a-z0-9-]{1,64}$/;

/** @param {Record<string, string | undefined>} env */
export function loadMonitorConfig(env = process.env) {
  const text = key => env[key]?.trim() ?? '';
  const timeout = /^\d+$/.test(text('MONITOR_TIMEOUT_MS')) ? Number(text('MONITOR_TIMEOUT_MS')) : DEFAULT_TIMEOUT_MS;
  return {
    frontendUrl: text('MONITOR_FRONTEND_URL'),
    renderUrl: text('MONITOR_RENDER_URL'),
    supabaseUrl: text('MONITOR_SUPABASE_URL'),
    supabaseAnonKey: text('MONITOR_SUPABASE_ANON_KEY'),
    renderToken: text('MONITOR_RENDER_TOKEN'),
    expectedModelVersion: text('MONITOR_EXPECTED_MODEL_VERSION'),
    timeoutMs: timeout >= MIN_TIMEOUT_MS && timeout <= MAX_TIMEOUT_MS ? timeout : DEFAULT_TIMEOUT_MS,
  };
}

function flagValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i === -1 ? undefined : (argv[i + 1] ?? '');
}

async function loadFixture(name) {
  if (!FIXTURE_NAME.test(name)) throw new Error('FIXTURE_NOT_FOUND');
  try {
    const text = await readFile(new URL(`./monitor/fixtures/${name}.json`, import.meta.url), 'utf8');
    const fixture = JSON.parse(text);
    if (!Array.isArray(fixture.observations)) throw new Error('FIXTURE_NOT_FOUND');
    return fixture.observations;
  } catch {
    throw new Error('FIXTURE_NOT_FOUND');
  }
}

/**
 * Runs the monitor. Everything with a side effect is injectable so tests need no network.
 * @returns {Promise<{ exitCode: number, stdout: string, json: object | null }>}
 */
export async function runMonitor({ env = process.env, argv = [], fetcher = fetch, now = () => Date.now() } = {}) {
  const fixtureName = flagValue(argv, '--fixtures');
  const jsonPath = flagValue(argv, '--json');
  let observations;
  if (fixtureName !== undefined) {
    try {
      observations = await loadFixture(fixtureName);
    } catch {
      return { exitCode: 2, stdout: 'FIXTURE_NOT_FOUND\n', json: null };
    }
  } else {
    observations = await runChecks(loadMonitorConfig(env), { fetcher, now });
  }
  const results = observations.map(classify);
  const json = buildJson(results, new Date(now()).toISOString());
  let stdout = renderTable(results);
  if (jsonPath) {
    try {
      await writeFile(resolve(jsonPath), `${JSON.stringify(json, null, 2)}\n`);
    } catch {
      stdout += 'JSON_WRITE_FAILED\n';
    }
  }
  return { exitCode: exitCodeFor(results), stdout, json };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  const { exitCode, stdout, json } = await runMonitor({ argv: process.argv.slice(2) });
  process.stdout.write(stdout);
  if (json) process.stdout.write(`\n${JSON.stringify(json, null, 2)}\n`);
  process.exitCode = exitCode;
}
