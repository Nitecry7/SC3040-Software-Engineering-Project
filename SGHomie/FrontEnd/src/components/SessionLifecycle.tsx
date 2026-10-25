import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  ACTIVITY_PERSIST_THROTTLE_MS,
  createIdleSession,
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_ACTIVITY_STORAGE_KEY,
  SESSION_WARNING_BEFORE_MS,
  type IdleSessionController,
  verifySessionUser,
} from '../lib/sessionLifecycle';
import SessionExpiryModal from './SessionExpiryModal';

const INACTIVITY_MESSAGE = 'Your session expired after 60 minutes of inactivity. Please sign in again to continue.';
const SESSION_ENDED_MESSAGE = 'Your session ended. Please sign in again to continue.';
const SESSION_TEST_TIMING = { idleTimeoutMs: 10_000, warningBeforeMs: 5_000 };
const useSessionTestTiming = import.meta.env.DEV
  && new URLSearchParams(window.location.search).get('sessionTestMode') === '1';

function readActivity(): number | null {
  try {
    const value = Number(window.localStorage.getItem(SESSION_ACTIVITY_STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

const SessionLifecycle: React.FC = () => {
  const { user, authLoading, authTransition, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const controllerRef = useRef<IdleSessionController | null>(null);
  const signOutRef = useRef(signOut);
  signOutRef.current = signOut;
  const warningVisibleRef = useRef(false);
  const [warningVisible, setWarningVisible] = useState(false);
  const [expiresAt, setExpiresAt] = useState(0);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const userId = user && user.is_anonymous !== true ? user.id : null;

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      controllerRef.current?.stop();
      controllerRef.current = null;
      setWarningVisible(false);
      setVerificationError(null);
      try { window.localStorage.removeItem(SESSION_ACTIVITY_STORAGE_KEY); } catch { /* storage may be unavailable */ }
      return;
    }

    let lastActivityWrite = 0;
    const controller = createIdleSession({
      readActivity,
      writeActivity: timestamp => {
        const now = Date.now();
        if (now - lastActivityWrite < ACTIVITY_PERSIST_THROTTLE_MS) return;
        window.localStorage.setItem(SESSION_ACTIVITY_STORAGE_KEY, String(timestamp));
        lastActivityWrite = now;
      },
      schedule: (callback, delay) => window.setTimeout(callback, delay),
      cancel: timer => window.clearTimeout(timer),
      onWarning: (visible, deadline) => {
        warningVisibleRef.current = visible;
        setWarningVisible(visible);
        setExpiresAt(deadline);
        if (visible) setVerificationError(null);
      },
      onExpire: () => {
        void (async () => {
          try {
            await signOutRef.current('inactivity');
          } finally {
            toast.error(INACTIVITY_MESSAGE, { id: 'session-ended:inactivity' });
            navigate('/', { replace: true });
          }
        })();
      },
      idleTimeoutMs: useSessionTestTiming ? SESSION_TEST_TIMING.idleTimeoutMs : SESSION_IDLE_TIMEOUT_MS,
      warningBeforeMs: useSessionTestTiming ? SESSION_TEST_TIMING.warningBeforeMs : SESSION_WARNING_BEFORE_MS,
    });
    controllerRef.current = controller;
    controller.start();

    const handleActivity = (event: Event) => {
      if (warningVisibleRef.current) return;
      const target = event.target;
      if (target instanceof Element && target.closest('[data-session-warning-dialog]')) return;
      controller.activity();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SESSION_ACTIVITY_STORAGE_KEY) {
        const timestamp = event.newValue === null ? null : Number(event.newValue);
        controller.syncActivity(Number.isFinite(timestamp) ? timestamp : null);
      }
    };
    const recheck = () => controller.check();

    document.addEventListener('pointerdown', handleActivity, true);
    document.addEventListener('keydown', handleActivity, true);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('pageshow', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      document.removeEventListener('pointerdown', handleActivity, true);
      document.removeEventListener('keydown', handleActivity, true);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('pageshow', recheck);
      document.removeEventListener('visibilitychange', recheck);
      controller.stop();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [authLoading, userId, navigate]);

  useEffect(() => {
    if (authTransition === 'session-ended') {
      toast.error(SESSION_ENDED_MESSAGE, { id: 'session-ended:auth' });
      if (location.pathname !== '/') navigate('/', { replace: true });
    }
  }, [authTransition, location.pathname, navigate]);

  useLayoutEffect(() => {
    const shell = document.getElementById('app-shell');
    if (!shell) return;
    shell.inert = warningVisible;
    const oldOverflow = document.body.style.overflow;
    if (warningVisible) document.body.style.overflow = 'hidden';
    return () => {
      shell.inert = false;
      document.body.style.overflow = oldOverflow;
    };
  }, [warningVisible]);

  const staySignedIn = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setVerificationError(null);
    try {
      if (!userId || !await verifySessionUser(() => supabase.auth.getUser(), userId)) {
        setVerificationError('We could not verify your session. Please try again.');
        return;
      }
      controllerRef.current?.activity(Date.now());
      setWarningVisible(false);
    } finally {
      setBusy(false);
    }
  }, [busy, userId]);

  const dismissWarning = useCallback(() => controllerRef.current?.dismissWarning(), []);
  const signOutNow = useCallback(() => {
    void signOut().then(() => {
      navigate('/', { replace: true });
      toast.success('Signed out successfully');
    }).catch(() => {
      toast.error('Failed to sign out. Please try again.', { id: 'session-warning:sign-out-error' });
    });
  }, [navigate, signOut]);

  if (!warningVisible) return null;
  return (
    <SessionExpiryModal
      expiresAt={expiresAt}
      error={verificationError}
      busy={busy}
      onStaySignedIn={staySignedIn}
      onSignOut={signOutNow}
      onDismiss={dismissWarning}
    />
  );
};

export default SessionLifecycle;
