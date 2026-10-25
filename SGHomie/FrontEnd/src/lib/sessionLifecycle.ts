export const SESSION_IDLE_TIMEOUT_MS = 60 * 60 * 1000;
export const SESSION_WARNING_AT_MS = 55 * 60 * 1000;
export const SESSION_WARNING_BEFORE_MS = SESSION_IDLE_TIMEOUT_MS - SESSION_WARNING_AT_MS;
export const ACTIVITY_PERSIST_THROTTLE_MS = 1_000;
export const SESSION_ACTIVITY_STORAGE_KEY = 'sghomie:lastActivityAt:v1';

export interface IdleSessionDependencies {
  now?: () => number;
  readActivity: () => number | null;
  writeActivity: (timestamp: number) => void;
  schedule: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  cancel: (timer: ReturnType<typeof setTimeout>) => void;
  onWarning: (visible: boolean, expiresAt: number) => void;
  onExpire: () => void;
  idleTimeoutMs?: number;
  warningBeforeMs?: number;
}

export interface IdleSessionController {
  readonly lastActivityAt: number;
  start(): void;
  activity(timestamp?: number): void;
  syncActivity(timestamp: number | null): void;
  check(): void;
  dismissWarning(): void;
  stop(): void;
}

export async function verifySessionUser(
  getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown }>,
  expectedUserId: string,
): Promise<boolean> {
  try {
    const { data, error } = await getUser();
    return !error && data.user?.id === expectedUserId;
  } catch {
    return false;
  }
}

export function sessionExpiryMinutesRemaining(expiresAt: number, now: number): number {
  return Math.max(1, Math.ceil((expiresAt - now) / 60_000));
}

export function createIdleSession(dependencies: IdleSessionDependencies): IdleSessionController {
  const now = dependencies.now ?? Date.now;
  const idleTimeoutMs = dependencies.idleTimeoutMs ?? SESSION_IDLE_TIMEOUT_MS;
  const warningBeforeMs = dependencies.warningBeforeMs ?? SESSION_WARNING_BEFORE_MS;
  let lastActivityAt = 0;
  let warningShownAt: number | null = null;
  let dismissedAt: number | null = null;
  let warningVisible = false;
  let expired = false;
  let stopped = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastPersistedAt = 0;

  const setWarning = (visible: boolean) => {
    if (warningVisible === visible) return;
    warningVisible = visible;
    dependencies.onWarning(visible, lastActivityAt + idleTimeoutMs);
  };

  const persist = (timestamp: number, force = false) => {
    if (!force && timestamp - lastPersistedAt < ACTIVITY_PERSIST_THROTTLE_MS) return;
    try {
      dependencies.writeActivity(timestamp);
      lastPersistedAt = timestamp;
    } catch {
      // Private browsing/storage restrictions fall back to this tab's timer.
    }
  };

  const readLatest = () => {
    try {
      const value = dependencies.readActivity();
      return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
    } catch {
      return null;
    }
  };

  const scheduleNext = () => {
    if (stopped || expired) return;
    if (timer !== undefined) dependencies.cancel(timer);
    const warningAt = lastActivityAt + idleTimeoutMs - warningBeforeMs;
    const deadline = lastActivityAt + idleTimeoutMs;
    const nextAt = !warningVisible && dismissedAt !== lastActivityAt && warningShownAt !== lastActivityAt
      ? warningAt
      : deadline;
    timer = dependencies.schedule(check, Math.max(0, nextAt - now()));
  };

  const check = () => {
    if (stopped || expired) return;
    const sharedActivity = readLatest();
    if (sharedActivity !== null && sharedActivity > lastActivityAt) {
      lastActivityAt = sharedActivity;
      warningShownAt = null;
      dismissedAt = null;
      setWarning(false);
    }
    const elapsed = Math.max(0, now() - lastActivityAt);
    if (elapsed >= idleTimeoutMs) {
      expired = true;
      setWarning(false);
      dependencies.onExpire();
      return;
    }
    if (elapsed >= idleTimeoutMs - warningBeforeMs
      && warningShownAt !== lastActivityAt && dismissedAt !== lastActivityAt) {
      warningShownAt = lastActivityAt;
      setWarning(true);
    }
    scheduleNext();
  };

  return {
    get lastActivityAt() { return lastActivityAt; },
    start() {
      if (!stopped) return;
      stopped = false;
      const restored = readLatest();
      lastActivityAt = restored ?? now();
      lastPersistedAt = restored ?? 0;
      if (restored === null) persist(lastActivityAt, true);
      check();
    },
    activity(timestamp = now()) {
      if (stopped || expired) return;
      lastActivityAt = Math.max(timestamp, lastActivityAt);
      warningShownAt = null;
      dismissedAt = null;
      setWarning(false);
      persist(lastActivityAt);
      scheduleNext();
    },
    syncActivity(timestamp) {
      if (stopped || expired || timestamp === null || !Number.isFinite(timestamp)) return;
      if (timestamp > lastActivityAt) {
        lastActivityAt = timestamp;
        warningShownAt = null;
        dismissedAt = null;
        setWarning(false);
        scheduleNext();
      }
    },
    check,
    dismissWarning() {
      if (!warningVisible) return;
      dismissedAt = lastActivityAt;
      setWarning(false);
      scheduleNext();
    },
    stop() {
      stopped = true;
      if (timer !== undefined) dependencies.cancel(timer);
      timer = undefined;
      setWarning(false);
    },
  };
}

