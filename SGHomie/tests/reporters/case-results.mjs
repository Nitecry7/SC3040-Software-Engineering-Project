// Structured evidence for every completed test. This reporter preserves failure
// outcomes and never changes the test runner's exit status.
import { relative } from 'node:path';

export default async function* caseResults(events) {
  for await (const event of events) {
    if (!['test:pass', 'test:fail'].includes(event.type)) continue;
    const { name, file, line, column, details = {} } = event.data;
    yield `${JSON.stringify({
      name, file: file ? relative(process.cwd(), file) : null, line, column,
      outcome: event.type === 'test:pass' ? 'PASS' : 'FAIL',
      duration_ms: details.duration_ms,
      error: details.error?.message ?? null,
    })}\n`;
  }
}
