// Pure report builders. They read only the whitelisted fields of classified results.

const COLUMNS = [
  ['TARGET', r => r.target],
  ['STATUS', r => r.status],
  ['REASON', r => r.reason],
  ['HTTP', r => (r.httpStatus === null ? '-' : String(r.httpStatus))],
  ['MS', r => String(r.durationMs)],
  ['HOST', r => r.host ?? '-'],
  ['VERSION', r => r.versionCheck],
  ['STARTED', r => r.startedAt],
];

/** @param {import('./classify.mjs').Result[]} results */
export function summarize(results) {
  const summary = { healthy: 0, failed: 0, unknown: 0 };
  for (const r of results) summary[r.status] += 1;
  return summary;
}

/** @param {import('./classify.mjs').Result[]} results */
export function exitCodeFor(results) {
  return results.some(r => r.status === 'failed') ? 1 : 0;
}

/** Aligned plain-text table, one line per target. */
export function renderTable(results) {
  const rows = [COLUMNS.map(([name]) => name), ...results.map(r => COLUMNS.map(([, get]) => get(r)))];
  const widths = COLUMNS.map((_, i) => Math.max(...rows.map(row => row[i].length)));
  const lines = rows.map(row => row.map((cell, i) => cell.padEnd(widths[i])).join('  ').trimEnd());
  const s = summarize(results);
  return `${lines.join('\n')}\n\nhealthy=${s.healthy} failed=${s.failed} unknown=${s.unknown}\n`;
}

/** GitHub-flavoured Markdown table for a job summary. */
export function renderMarkdown(results) {
  const head = COLUMNS.map(([name]) => name);
  const lines = [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`,
    ...results.map(r => `| ${COLUMNS.map(([, get]) => get(r)).join(' | ')} |`)];
  const s = summarize(results);
  return `${lines.join('\n')}\n\nhealthy=${s.healthy} failed=${s.failed} unknown=${s.unknown}\n`;
}

/**
 * Fixed-shape JSON document.
 * @param {import('./classify.mjs').Result[]} results
 * @param {string} generatedAt ISO 8601 timestamp supplied by the caller
 */
export function buildJson(results, generatedAt) {
  const summary = summarize(results);
  return {
    schema_version: 1,
    generated_at: generatedAt,
    overall: summary.failed > 0 ? 'failed' : summary.unknown > 0 ? 'unknown' : 'healthy',
    exit_code: exitCodeFor(results),
    summary,
    results: results.map(r => ({
      target: r.target,
      status: r.status,
      reason: r.reason,
      started_at: r.startedAt,
      duration_ms: r.durationMs,
      http_status: r.httpStatus,
      host: r.host,
      version_check: r.versionCheck,
    })),
  };
}
