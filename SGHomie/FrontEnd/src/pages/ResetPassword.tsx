import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { clearRecoveryState, getRecoveryState, subscribeRecoveryState } from '../lib/authRecovery';
import { checkPasswordPolicy } from '../lib/passwordPolicy';
import PasswordStrength from '../components/PasswordStrength';

const SAME_PASSWORD_MESSAGE = "Choose a password you haven't used for this account.";
const GENERIC_FAILURE_MESSAGE = "We couldn't update your password. Please try again.";

const openAuthModal = (name: 'toggle-auth-modal' | 'open-forgot-password') => {
  window.dispatchEvent(new Event(name));
};

const inputClass = 'block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
const primaryButtonClass = 'w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60';

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mx-auto w-full max-w-md px-4 py-16">
    <div className="rounded-2xl bg-white p-8 shadow-xl">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      {children}
    </div>
  </div>
);

// Sets a new password from the emailed recovery link. The form appears only when
// the app captured a recovery redirect and a session exists, so this route is not
// a way to change a password without the current one.
const ResetPassword = () => {
  const { user, authLoading } = useAuth();
  const [recovery, setRecovery] = useState(getRecoveryState);
  const [done, setDone] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [policyError, setPolicyError] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const hasRegisteredUser = !!user && user.is_anonymous !== true;

  useEffect(() => {
    setRecovery(getRecoveryState());
    return subscribeRecoveryState(() => setRecovery(getRecoveryState()));
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    setFailure(null);
    if (!checkPasswordPolicy(password).valid) {
      setPolicyError(true);
      return;
    }
    if (password !== confirmPassword) {
      setMismatch(true);
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        const code = (error as { code?: string }).code;
        if (code === 'same_password') setFailure(SAME_PASSWORD_MESSAGE);
        else if (code === 'weak_password') setFailure(error.message);
        else setFailure(GENERIC_FAILURE_MESSAGE);
        return;
      }
      clearRecoveryState();
      setPassword('');
      setConfirmPassword('');
      setDone(true);
    } catch {
      setFailure(GENERIC_FAILURE_MESSAGE);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <Panel title="Password updated">
        <p role="status" className="mt-4 text-gray-600">Your password has been updated.</p>
        <Link to="/" className="mt-6 inline-block rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700">
          Continue to SG Homie
        </Link>
      </Panel>
    );
  }

  if (!recovery) {
    return (
      <Panel title="Reset your password">
        <p className="mt-4 text-gray-600">Open the link from your password reset email to choose a new password.</p>
        {hasRegisteredUser ? (
          <Link to="/profile" className="mt-6 inline-block text-sm font-medium text-blue-600 hover:text-blue-500">
            Go to your Profile
          </Link>
        ) : (
          <button type="button" onClick={() => openAuthModal('toggle-auth-modal')} className="mt-6 text-sm font-medium text-blue-600 hover:text-blue-500">
            Sign in
          </button>
        )}
      </Panel>
    );
  }

  if (recovery.kind === 'recovery' && authLoading) {
    return (
      <Panel title="Reset your password">
        <p role="status" className="mt-4 text-gray-600">Checking your reset link...</p>
      </Panel>
    );
  }

  if (recovery.kind === 'error' || !hasRegisteredUser) {
    const expired = recovery.kind === 'error' && recovery.reason === 'expired';
    return (
      <Panel title={expired ? 'This link has expired' : 'This link is not valid'}>
        <p role="alert" className="mt-4 text-gray-600">
          {expired ? 'This password reset link has expired.' : 'This password reset link is not valid.'}
          {' '}Request a new one to continue.
        </p>
        <button type="button" onClick={() => openAuthModal('open-forgot-password')} className={`mt-6 ${primaryButtonClass}`}>
          Request a new reset link
        </button>
      </Panel>
    );
  }

  return (
    <Panel title="Choose a new password">
      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div>
          <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">New password</label>
          <div className="relative mt-1">
            <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type={showPasswords ? 'text' : 'password'}
              id="new-password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPolicyError(false);
                setMismatch(false);
              }}
              aria-invalid={policyError ? true : undefined}
              aria-describedby={policyError ? 'new-password-strength new-password-policy-error' : 'new-password-strength'}
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
          <PasswordStrength password={password} email={user?.email} id="new-password-strength" />
          {policyError && (
            <p id="new-password-policy-error" role="alert" className="mt-2 text-sm font-medium text-red-700">
              Password does not meet the requirements.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="confirm-new-password" className="block text-sm font-medium text-gray-700">Confirm new password</label>
          <div className="relative mt-1">
            <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type={showPasswords ? 'text' : 'password'}
              id="confirm-new-password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setMismatch(false);
              }}
              aria-invalid={mismatch ? true : undefined}
              aria-describedby={mismatch ? 'confirm-new-password-error' : undefined}
              className={inputClass}
              required
            />
          </div>
          {mismatch && (
            <p id="confirm-new-password-error" role="alert" className="mt-2 text-sm font-medium text-red-700">
              Passwords do not match.
            </p>
          )}
        </div>

        {failure && (
          <p id="reset-error" role="alert" className="text-sm font-medium text-red-700">{failure}</p>
        )}

        <button type="submit" disabled={submitting} className={primaryButtonClass}>
          {submitting ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </Panel>
  );
};

export default ResetPassword;
