// Password-recovery redirect handling that does not depend on the Supabase client.
//
// Supabase's recovery email links back with a URL fragment: a token on success,
// or error fields when the link is expired or invalid. The client consumes (or
// ignores) that fragment on start-up, so the app reads it first with
// captureAuthRedirect() and keeps only a coarse state: the kind and, for errors,
// a reason. The token, the fragment and the email are never stored or logged.

export type RecoveryState =
  | { kind: 'recovery' }
  | { kind: 'error'; reason: 'expired' | 'invalid' };

export type AuthRedirect = RecoveryState | { kind: 'none' };

const STORAGE_KEY = 'sghomie:auth-recovery';
const RESET_PATH = '/reset-password';

function paramsFrom(value: string): URLSearchParams {
  return new URLSearchParams(value.replace(/^[#?]/, ''));
}

// Reads the fragment and the query string. An auth error wins over a token, as
// it does in the Supabase client. Returns no token and no raw description.
export function parseAuthRedirect(hash: string, search: string): AuthRedirect {
  const fragment = paramsFrom(hash);
  const query = paramsFrom(search);
  const read = (name: string) => fragment.get(name) ?? query.get(name);

  const code = read('error_code');
  const description = read('error_description');
  if (read('error') !== null || code !== null || description !== null) {
    const expired = code === 'otp_expired' || /expired/i.test(description ?? '');
    return { kind: 'error', reason: expired ? 'expired' : 'invalid' };
  }
  if (fragment.get('type') === 'recovery' && fragment.get('access_token')) return { kind: 'recovery' };
  return { kind: 'none' };
}

let current: RecoveryState | null = null;
let capturedFromUrl = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(listener => listener());
}

function isRecoveryState(value: unknown): value is RecoveryState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { kind?: unknown; reason?: unknown };
  if (candidate.kind === 'recovery') return true;
  return candidate.kind === 'error' && (candidate.reason === 'expired' || candidate.reason === 'invalid');
}

function readStored(): RecoveryState | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecoveryState(parsed)) return null;
    return parsed.kind === 'recovery' ? { kind: 'recovery' } : { kind: 'error', reason: parsed.reason };
  } catch {
    return null;
  }
}

function writeStored(state: RecoveryState | null) {
  try {
    if (state) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable; the in-memory state still serves this page load.
  }
}

// Call once, before the Supabase client is created. A redirect in the URL sets
// the state; otherwise a state kept from earlier in this tab is restored so a
// reload of the reset page keeps its form.
export function captureAuthRedirect(): void {
  const parsed = parseAuthRedirect(window.location.hash, window.location.search);
  // An auth error fragment also arrives from other links, such as an expired
  // sign-up confirmation, and cannot be told apart from a reset-link error. It is
  // treated as a reset-link error only on the reset page itself.
  const redirect = parsed.kind === 'error' && window.location.pathname !== RESET_PATH ? { kind: 'none' as const } : parsed;
  if (redirect.kind === 'none') {
    const stored = readStored();
    if (stored) {
      current = stored;
      notify();
    }
    return;
  }
  current = redirect.kind === 'recovery' ? { kind: 'recovery' } : { kind: 'error', reason: redirect.reason };
  capturedFromUrl = true;
  writeStored(current);
  notify();
}

// True only when this page load arrived through a recovery or error redirect, as
// opposed to a state restored from earlier in the tab.
export function wasCapturedFromUrl(): boolean {
  return capturedFromUrl;
}

// The same object is returned until the state changes, so it is safe to compare by reference.
export function getRecoveryState(): RecoveryState | null {
  return current;
}

export function clearRecoveryState(): void {
  if (current === null) {
    writeStored(null);
    return;
  }
  current = null;
  writeStored(null);
  notify();
}

export function subscribeRecoveryState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
