// Client-side password policy and an advisory strength estimate.
//
// The policy mirrors the Supabase Auth setting for this project: at least 8
// characters with a lowercase letter, an uppercase letter and a digit. Supabase
// matches those classes against the ASCII sets a-z, A-Z and 0-9 only, so accented
// or non-Latin letters do not satisfy a class. Supabase Auth remains the final
// authority; this module only gives earlier feedback.
//
// The strength estimate is a small heuristic, not a breach check. It compares
// against a short built-in word list and a few common patterns. It does not look
// passwords up anywhere and must not be described as doing more than that.

export type PasswordRuleId = 'length' | 'lowercase' | 'uppercase' | 'digit';

export interface PasswordRule {
  id: PasswordRuleId;
  label: string;
}

export interface PasswordRuleResult extends PasswordRule {
  met: boolean;
}

export interface PasswordPolicyResult {
  rules: PasswordRuleResult[];
  valid: boolean;
}

export type PasswordRating = 'weak' | 'fair' | 'strong';

export interface PasswordStrength {
  rating: PasswordRating;
  level: 0 | 1 | 2 | 3;
}

// Shown when Supabase reports `same_password`, and by the change-password form
// before any request. Only the current password is refused; earlier ones are not tracked.
export const SAME_PASSWORD_MESSAGE = 'Your new password must be different from your current password.';

export const MIN_PASSWORD_LENGTH = 8;
const STRONG_MIN_LENGTH = 12;

export const PASSWORD_RULES: readonly PasswordRule[] = [
  { id: 'length', label: `At least ${MIN_PASSWORD_LENGTH} characters` },
  { id: 'lowercase', label: 'A lowercase letter (a-z)' },
  { id: 'uppercase', label: 'An uppercase letter (A-Z)' },
  { id: 'digit', label: 'A number (0-9)' },
];

// Supabase counts characters, not UTF-16 code units, for the minimum length.
const characterCount = (password: string) => Array.from(password).length;

const RULE_TESTS: Record<PasswordRuleId, (password: string) => boolean> = {
  length: password => characterCount(password) >= MIN_PASSWORD_LENGTH,
  lowercase: password => /[a-z]/.test(password),
  uppercase: password => /[A-Z]/.test(password),
  digit: password => /[0-9]/.test(password),
};

export function checkPasswordPolicy(password: string): PasswordPolicyResult {
  const rules = PASSWORD_RULES.map(rule => ({ ...rule, met: RULE_TESTS[rule.id](password) }));
  return { rules, valid: rules.every(rule => rule.met) };
}

// A short illustrative list of very common passwords and base words. It is not
// exhaustive and is not a breach corpus.
const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  'password', 'passw0rd', 'letmein', 'welcome', 'admin', 'administrator', 'qwerty', 'qwertyuiop',
  'abc123', 'iloveyou', 'monkey', 'dragon', 'master', 'login', 'sunshine', 'princess', 'football',
  'baseball', 'superman', 'batman', 'shadow', 'michael', 'jennifer', 'trustno', 'trustno1',
  'singapore', 'sghomie', 'homie', 'hdb', 'secret', 'changeme', 'default', 'test', 'testing',
  'guest', 'user', 'hello', 'freedom', 'whatever', 'summer', 'winter', 'flower', 'starwars',
  'computer', 'asdfgh', 'zxcvbn', '123456', '12345678', '123456789', '111111',
]);

const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890'];
const SEQUENCES = ['abcdefghijklmnopqrstuvwxyz', '0123456789'];
const RUN_LENGTH = 4;
const MIN_EMAIL_LOCAL_LENGTH = 3;
const MIN_CONTAINED_WORD_LENGTH = 5;
const MIN_DISTINCT_CHARACTERS = 6;

const reverse = (value: string) => Array.from(value).reverse().join('');

function containsRun(lowered: string, alphabets: readonly string[]): boolean {
  return alphabets.some(alphabet => [alphabet, reverse(alphabet)].some(text => {
    for (let start = 0; start + RUN_LENGTH <= text.length; start++) {
      if (lowered.includes(text.slice(start, start + RUN_LENGTH))) return true;
    }
    return false;
  }));
}

// Common words are compared case-insensitively after removing trailing digits and symbols.
function isCommonPassword(lowered: string): boolean {
  if (COMMON_PASSWORDS.has(lowered)) return true;
  return COMMON_PASSWORDS.has(lowered.replace(/[^\p{L}]+$/u, ''));
}

// A longer common word embedded anywhere in the password lowers the rating.
function containsCommonWord(lowered: string): boolean {
  for (const word of COMMON_PASSWORDS) {
    if (word.length >= MIN_CONTAINED_WORD_LENGTH && lowered.includes(word)) return true;
  }
  return false;
}

function containsEmailLocalPart(lowered: string, email: string | undefined): boolean {
  const local = (email ?? '').split('@')[0].trim().toLowerCase();
  if (!local) return false;
  const candidates = [local, local.replace(/[^a-z0-9]/g, '')];
  return candidates.some(candidate => candidate.length >= MIN_EMAIL_LOCAL_LENGTH && lowered.includes(candidate));
}

function classCount(password: string): number {
  // Symbols are the ASCII punctuation Supabase documents as allowed.
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~]/];
  return classes.filter(pattern => pattern.test(password)).length;
}

export function estimatePasswordStrength(password: string, context: { email?: string } = {}): PasswordStrength {
  if (password === '') return { rating: 'weak', level: 0 };
  if (!checkPasswordPolicy(password).valid) return { rating: 'weak', level: 1 };

  const lowered = password.toLowerCase();
  // A common word or the account's own email makes the password easy to guess whatever its length.
  if (isCommonPassword(lowered) || containsEmailLocalPart(lowered, context.email)) return { rating: 'weak', level: 1 };

  const penalised = containsCommonWord(lowered)
    || new Set(Array.from(password)).size < MIN_DISTINCT_CHARACTERS
    || containsRun(lowered, KEYBOARD_ROWS)
    || containsRun(lowered, SEQUENCES)
    || /(.)\1\1/iu.test(password)
    || /(?:19|20)\d{2}[^\p{L}\d]*$/u.test(password);

  const eligibleForStrong = characterCount(password) >= STRONG_MIN_LENGTH && classCount(password) >= 3;
  if (eligibleForStrong) return penalised ? { rating: 'fair', level: 2 } : { rating: 'strong', level: 3 };
  return penalised ? { rating: 'weak', level: 1 } : { rating: 'fair', level: 2 };
}
