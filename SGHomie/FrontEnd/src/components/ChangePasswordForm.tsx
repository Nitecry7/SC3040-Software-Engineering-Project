import React, { useRef, useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { checkPasswordPolicy, SAME_PASSWORD_MESSAGE } from '../lib/passwordPolicy';
import PasswordStrength from './PasswordStrength';

const POLICY_MESSAGE = 'Password does not meet the requirements.';
const MISMATCH_MESSAGE = 'Passwords do not match.';
const WRONG_CURRENT_MESSAGE = 'Your current password is incorrect.';
const RATE_LIMIT_MESSAGE = 'Too many attempts. Please wait a moment and try again.';
const NETWORK_MESSAGE = "We couldn't reach the server. Check your connection and try again.";
const VERIFY_FAILURE_MESSAGE = "We couldn't verify your current password. Please try again.";
const REAUTH_MESSAGE = 'For your security, sign in again or use Forgot password to change your password.';
const SESSION_ENDED_MESSAGE = 'Your session has ended. Sign in again to change your password.';
const UPDATE_FAILURE_MESSAGE = "We couldn't update your password. Please try again.";
const SUCCESS_MESSAGE = 'Your password has been updated.';

type Target = 'current' | 'new' | 'confirm' | 'form';
interface Failure { target: Target; message: string }
type AuthFailure = { code?: string; status?: number; name?: string; message?: string };

const inputClass = 'block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
const primaryButtonClass = 'rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60';

const isRateLimit = (error: AuthFailure) => error.status === 429 || /rate_limit/.test(error.code ?? '');
const isNetwork = (error: AuthFailure) => error.status === 0;
const isSessionEnded = (error: AuthFailure) =>
  error.code === 'session_not_found' || error.code === 'session_expired'
  || error.name === 'AuthSessionMissingError' || error.status === 401 || error.status === 403;

// Lets a signed-in user change their password by entering the current one.
//
// Step 4 below re-checks the current password with signInWithPassword. That is a
// client-side check only: it gives early feedback and a fresh session, but a
// modified client could skip it. The control that holds on the server is the hosted
// Supabase Auth setting "Require current password when updating", which makes the
// server verify the `current_password` sent with the update.
const ChangePasswordForm = ({ email }: { email: string }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  const fail = (target: Target, message: string) => setFailure({ target, message });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    setFailure(null);
    setDone(false);
    if (!checkPasswordPolicy(next).valid) return fail('new', POLICY_MESSAGE);
    if (next !== confirm) return fail('confirm', MISMATCH_MESSAGE);
    if (next === current) return fail('new', SAME_PASSWORD_MESSAGE);

    inFlight.current = true;
    setSubmitting(true);
    try {
      // Step 4: client-side verification of the current password.
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password: current });
        if (error) {
          const verifyError = error as AuthFailure;
          if (verifyError.code === 'invalid_credentials') fail('current', WRONG_CURRENT_MESSAGE);
          else if (isRateLimit(verifyError)) fail('form', RATE_LIMIT_MESSAGE);
          else if (isNetwork(verifyError)) fail('form', NETWORK_MESSAGE);
          else fail('form', VERIFY_FAILURE_MESSAGE);
          return;
        }
      } catch {
        fail('form', NETWORK_MESSAGE);
        return;
      }

      // Step 5: the update. `current_password` is ignored by the server unless the
      // hosted "Require current password" setting is on.
      try {
        const { error } = await supabase.auth.updateUser({ password: next, current_password: current });
        if (error) {
          const updateError = error as AuthFailure;
          if (updateError.code === 'same_password') fail('new', SAME_PASSWORD_MESSAGE);
          else if (updateError.code === 'weak_password') fail('new', updateError.message ?? POLICY_MESSAGE);
          else if (updateError.code === 'reauthentication_needed') fail('form', REAUTH_MESSAGE);
          else if (isSessionEnded(updateError)) fail('form', SESSION_ENDED_MESSAGE);
          else fail('form', UPDATE_FAILURE_MESSAGE);
          return;
        }
      } catch {
        fail('form', UPDATE_FAILURE_MESSAGE);
        return;
      }

      setCurrent('');
      setNext('');
      setConfirm('');
      setShowPasswords(false);
      setDone(true);
      // Ends the account's other sessions. The scope leaves this browser signed in
      // and emits no auth event; a failure here does not undo the change.
      try { await supabase.auth.signOut({ scope: 'others' }); } catch { /* best effort */ }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const errorFor = (target: Target) => (failure?.target === target ? failure.message : null);
  const currentError = errorFor('current');
  const newError = errorFor('new');
  const confirmError = errorFor('confirm');
  const formError = errorFor('form');

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="change-password-current" className="block text-sm font-medium text-gray-700">Current password</label>
        <div className="relative mt-1">
          <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type={showPasswords ? 'text' : 'password'}
            id="change-password-current"
            autoComplete="current-password"
            value={current}
            onChange={(e) => { setCurrent(e.target.value); setFailure(null); }}
            aria-invalid={currentError ? true : undefined}
            aria-describedby={currentError ? 'change-password-current-error' : undefined}
            className={inputClass}
            required
          />
          <button
            type="button"
            aria-label="Show passwords"
            aria-pressed={showPasswords}
            onClick={() => setShowPasswords(previous => !previous)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {showPasswords ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
        {currentError && (
          <p id="change-password-current-error" role="alert" className="mt-2 text-sm font-medium text-red-700">{currentError}</p>
        )}
      </div>

      <div>
        <label htmlFor="change-password-new" className="block text-sm font-medium text-gray-700">New password</label>
        <div className="relative mt-1">
          <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type={showPasswords ? 'text' : 'password'}
            id="change-password-new"
            autoComplete="new-password"
            value={next}
            onChange={(e) => { setNext(e.target.value); setFailure(null); }}
            aria-invalid={newError ? true : undefined}
            aria-describedby={newError ? 'change-password-strength change-password-new-error' : 'change-password-strength'}
            className={inputClass}
            required
          />
        </div>
        <PasswordStrength password={next} email={email} id="change-password-strength" />
        {newError && (
          <p id="change-password-new-error" role="alert" className="mt-2 text-sm font-medium text-red-700">{newError}</p>
        )}
      </div>

      <div>
        <label htmlFor="change-password-confirm" className="block text-sm font-medium text-gray-700">Confirm new password</label>
        <div className="relative mt-1">
          <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type={showPasswords ? 'text' : 'password'}
            id="change-password-confirm"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setFailure(null); }}
            aria-invalid={confirmError ? true : undefined}
            aria-describedby={confirmError ? 'change-password-confirm-error' : undefined}
            className={inputClass}
            required
          />
        </div>
        {confirmError && (
          <p id="change-password-confirm-error" role="alert" className="mt-2 text-sm font-medium text-red-700">{confirmError}</p>
        )}
      </div>

      {formError && (
        <p id="change-password-error" role="alert" className="text-sm font-medium text-red-700">{formError}</p>
      )}
      {done && (
        <p role="status" className="text-sm font-medium text-green-700">{SUCCESS_MESSAGE}</p>
      )}

      <button type="submit" disabled={submitting} className={primaryButtonClass}>
        {submitting ? 'Updating...' : 'Change password'}
      </button>
    </form>
  );
};

export default ChangePasswordForm;
