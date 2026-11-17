import React, { useRef, useState } from 'react';
import { Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ForgotPasswordFormProps {
  onBack: () => void;
  initialEmail?: string;
}

const CONFIRMATION = "If an account exists for that address, we've sent a link to reset your password. Check your inbox and your junk or spam folder.";
const NETWORK_FAILURE = "We couldn't send the request. Check your connection and try again.";

// A connection failure is reported by Supabase as a returned error with status 0.
// It says nothing about the address, so it is safe to tell the user.
function isNetworkFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const authError = error as { name?: string; status?: number };
  return authError.name === 'AuthRetryableFetchError' && authError.status === 0;
}

// Requests a password reset email. Every outcome that reflects the server's view
// of the address (sent, unknown, rate limited, other) shows the same message so
// the form cannot be used to learn which addresses are registered.
const ForgotPasswordForm = ({ onBack, initialEmail = '' }: ForgotPasswordFormProps) => {
  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<'sent' | 'network' | null>(null);
  const inFlight = useRef(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setOutcome(isNetworkFailure(error) ? 'network' : 'sent');
    } catch {
      setOutcome('network');
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  return (
    <div>
      <div className="mb-8 text-center">
        <h2 id="auth-modal-title" className="text-3xl font-bold text-gray-900">Reset your password</h2>
        <p className="mt-2 text-gray-600">Enter your email and we'll send you a link to choose a new password.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700">
            Email Address
          </label>
          <div className="relative mt-1">
            <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="email"
              id="forgot-email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 py-3 pl-10 pr-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        {/* Stays mounted so the message is announced when it appears. */}
        <div role="status" aria-live="polite">
          {outcome === 'sent' && <p className="text-sm leading-relaxed text-gray-700">{CONFIRMATION}</p>}
          {outcome === 'network' && <p className="text-sm font-medium text-red-700">{NETWORK_FAILURE}</p>}
        </div>

        <button
          type="submit"
          disabled={sending}
          className="flex w-full items-center justify-center rounded-lg border border-transparent bg-blue-600 px-4 py-3 text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
        >
          {sending ? 'Sending...' : 'Send reset link'}
        </button>
      </form>

      <div className="mt-6">
        <button
          type="button"
          onClick={onBack}
          className="w-full text-center text-sm text-blue-600 hover:text-blue-500"
        >
          Back to sign in
        </button>
      </div>
    </div>
  );
};

export default ForgotPasswordForm;
