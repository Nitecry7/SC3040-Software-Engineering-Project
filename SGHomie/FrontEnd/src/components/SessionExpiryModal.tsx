import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { sessionExpiryMinutesRemaining } from '../lib/sessionLifecycle';

interface SessionExpiryModalProps {
  expiresAt: number;
  error: string | null;
  busy: boolean;
  onStaySignedIn: () => void;
  onSignOut: () => void;
  onDismiss: () => void;
}

const COUNTDOWN_REFRESH_MS = 1_000;

const SessionExpiryModal: React.FC<SessionExpiryModalProps> = ({
  expiresAt, error, busy, onStaySignedIn, onSignOut, onDismiss,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const remainingMinutes = sessionExpiryMinutesRemaining(expiresAt, now);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    stayRef.current?.focus({ preventScroll: true });
    const timer = window.setInterval(() => setNow(Date.now()), COUNTDOWN_REFRESH_MS);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDismiss();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled)'));
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog?.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearInterval(timer);
      dialog?.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus({ preventScroll: true });
    };
  }, [onDismiss]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/55 px-4 py-8 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-expiry-title"
        aria-describedby="session-expiry-description"
        data-session-warning-dialog
        className="relative my-auto w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200 sm:p-8"
      >
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close session warning"
          className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
        <h2 id="session-expiry-title" className="pr-10 text-xl font-semibold text-slate-900 sm:text-2xl">
          Your session is about to expire
        </h2>
        <p id="session-expiry-description" className="mt-4 text-base leading-7 text-slate-700">
          You&apos;ve been inactive for a while. You&apos;ll be signed out in {remainingMinutes} {remainingMinutes === 1 ? 'minute' : 'minutes'} to help keep your account secure.
        </p>
        <p className="mt-3 text-sm text-slate-600">Choose Stay signed in to continue where you left off.</p>
        {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</p>}
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onSignOut}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
          >
            Sign out
          </button>
          <button
            ref={stayRef}
            type="button"
            onClick={onStaySignedIn}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
          >
            {busy ? 'Checking session…' : 'Stay signed in'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default SessionExpiryModal;
