import { Check, X } from 'lucide-react';
import { checkPasswordPolicy, estimatePasswordStrength } from '../lib/passwordPolicy';

interface PasswordStrengthProps {
  password: string;
  email?: string;
  id: string;
}

const LABELS = { weak: 'Weak', fair: 'Fair', strong: 'Strong' } as const;
const FILL = { weak: 'bg-red-500', fair: 'bg-amber-500', strong: 'bg-green-600' } as const;

// Shows which password rules are met and an advisory strength estimate.
// The estimate is a heuristic, not a breach check; the server stays the authority.
const PasswordStrength = ({ password, email, id }: PasswordStrengthProps) => {
  const empty = password === '';
  const { rules } = checkPasswordPolicy(password);
  const { rating, level } = estimatePasswordStrength(password, { email });

  return (
    <div id={id} className="mt-2">
      <div className="flex items-center gap-3">
        {/* Decorative bar; the text label carries the meaning. */}
        {!empty && (
          <div aria-hidden="true" className="flex flex-1 gap-1">
            {[1, 2, 3].map(segment => (
              <div
                key={segment}
                className={`h-1.5 flex-1 rounded-full ${segment <= level ? FILL[rating] : 'bg-gray-200'}`}
              />
            ))}
          </div>
        )}
        {/* Stays mounted, empty until a password is typed, so the first rating is announced. */}
        <span role="status" aria-live="polite" className="text-sm text-gray-700">
          {!empty && <>Strength estimate: {LABELS[rating]}</>}
        </span>
      </div>
      <ul className="mt-2 space-y-1">
        {rules.map(rule => (
          <li key={rule.id} className="flex items-center gap-2 text-sm text-gray-700">
            {rule.met
              ? <Check className="h-4 w-4 text-green-700" aria-hidden="true" />
              : <X className="h-4 w-4 text-gray-500" aria-hidden="true" />}
            <span>{rule.label}</span>
            <span className="sr-only">{rule.met ? 'met' : 'not met'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PasswordStrength;
