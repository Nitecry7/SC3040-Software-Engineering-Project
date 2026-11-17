import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PASSWORD_RULES,
  checkPasswordPolicy,
  estimatePasswordStrength,
} from '../FrontEnd/src/lib/passwordPolicy.ts';

// All passwords here are synthetic. The estimator is advisory only; Supabase Auth
// stays the authority for what is accepted.
const rating = (password, context) => estimatePasswordStrength(password, context).rating;
const level = (password, context) => estimatePasswordStrength(password, context).level;
const ruleMet = (password, id) => checkPasswordPolicy(password).rules.find(rule => rule.id === id).met;

test('PASSWORD_RULES lists four rules with stable ids and labels', () => {
  assert.equal(PASSWORD_RULES.length, 4);
  assert.deepEqual(PASSWORD_RULES.map(rule => rule.id), ['length', 'lowercase', 'uppercase', 'digit']);
  for (const rule of PASSWORD_RULES) assert.ok(typeof rule.label === 'string' && rule.label.length > 0);
});

test('empty password meets no rule, is invalid and has strength level 0', () => {
  const result = checkPasswordPolicy('');
  assert.equal(result.valid, false);
  assert.deepEqual(result.rules.map(rule => rule.met), [false, false, false, false]);
  assert.deepEqual(estimatePasswordStrength(''), { rating: 'weak', level: 0 });
});

test('each unmet rule is reported on its own', () => {
  const cases = [
    ['Ab1', 'length'],
    ['ABCDEFG1', 'lowercase'],
    ['abcdefg1', 'uppercase'],
    ['Abcdefgh', 'digit'],
  ];
  for (const [password, missing] of cases) {
    const result = checkPasswordPolicy(password);
    assert.equal(result.valid, false, password);
    const unmet = result.rules.filter(rule => !rule.met).map(rule => rule.id);
    // 'Ab1' also lacks nothing but length; the others lack exactly one rule.
    assert.deepEqual(unmet, [missing], password);
  }
  assert.equal(checkPasswordPolicy('Abcdefg1').valid, true);
});

test('length is met at exactly 8 characters', () => {
  assert.equal(ruleMet('Kq7mWx2', 'length'), false);
  assert.equal(ruleMet('Kq7mWx2p', 'length'), true);
});

test('a minimal compliant 8-character password is valid and not strong', () => {
  assert.equal(checkPasswordPolicy('Kq7mWx2p').valid, true);
  assert.notEqual(rating('Kq7mWx2p'), 'strong');
  assert.equal(rating('Kq7mWx2p'), 'fair');
});

test('Password1 meets the policy but rates weak', () => {
  assert.equal(checkPasswordPolicy('Password1').valid, true);
  assert.deepEqual(estimatePasswordStrength('Password1'), { rating: 'weak', level: 1 });
});

test('a password that fails the policy is weak however long it is', () => {
  assert.equal(rating('alllowercaseandlongenoughbutnodigit'), 'weak');
  assert.equal(rating('Sh0rt'), 'weak');
});

test('fair and strong examples', () => {
  assert.deepEqual(estimatePasswordStrength('Zebra4Lamp'), { rating: 'fair', level: 2 });
  assert.deepEqual(estimatePasswordStrength('Cobalt-Heron-Quilt-47'), { rating: 'strong', level: 3 });
});

test('strong needs 12 or more characters', () => {
  assert.equal(rating('Cobalt-Her7'), 'fair');
  assert.equal(rating('Cobalt-Hero7'), 'strong');
});

test('each penalty lowers a rating that would otherwise be higher', () => {
  // Control: strong without any penalty.
  assert.equal(level('Cobalt-Heron-Quilt-47'), 3);
  const lowersStrong = {
    'keyboard run': 'Cobalt-Heron-Qwerty-47',
    'alphabetic sequence': 'Cobalt-Heron-Abcd-47',
    'numeric sequence': 'Cobalt-Heron-Quilt-1234',
    'repeated character': 'Cobalt-Heron-Quiiilt-47',
    'year suffix': 'Cobalt-Heron-Quilt-2024',
  };
  for (const [name, password] of Object.entries(lowersStrong)) {
    assert.equal(checkPasswordPolicy(password).valid, true, name);
    assert.equal(level(password), 2, `${name}: ${password}`);
  }
  // Control: fair without any penalty, weak with one.
  assert.equal(level('Zebra4Lamp'), 2);
  const lowersFair = {
    'keyboard run': 'Zebra4Lqwer',
    'alphabetic sequence': 'Zebra4Lcdef',
    'numeric sequence': 'Zebra-L5678',
    'repeated character': 'Zebra4Lammm',
    'year suffix': 'Zebra-L1999',
  };
  for (const [name, password] of Object.entries(lowersFair)) {
    assert.equal(checkPasswordPolicy(password).valid, true, name);
    assert.ok(password.length < 12, name);
    assert.equal(level(password), 1, `${name}: ${password}`);
  }
});

test('common passwords and base words are weak, ignoring case and trailing digits and symbols', () => {
  for (const password of ['Password1', 'Password!1', 'PASSWORd99', 'Welcome123', 'Qwerty123!', 'Letmein99']) {
    assert.equal(rating(password), 'weak', password);
  }
  assert.equal(checkPasswordPolicy('Welcome123').valid, true);
  assert.equal(checkPasswordPolicy('Letmein99').valid, true);
  // Long enough to be strong otherwise, but a common base word keeps it weak.
  assert.equal(checkPasswordPolicy('Singapore2024!').valid, true);
  assert.equal(rating('Singapore2024!'), 'weak');
});

test('a password containing the email local part is penalised', () => {
  const password = 'Cobalt-Heron-Quilt-47';
  assert.equal(rating(password), 'strong');
  assert.equal(rating(password, { email: 'heron@example.invalid' }), 'weak');
  assert.equal(rating(password, { email: 'HERON@example.invalid' }), 'weak');
  assert.equal(rating(password, { email: 'someone.else@example.invalid' }), 'strong');
  // Very short local parts and a missing email are ignored.
  assert.equal(rating(password, { email: 'qu@example.invalid' }), 'strong');
  assert.equal(rating(password, { email: '' }), 'strong');
  assert.equal(rating(password, {}), 'strong');
});

test('only lowercase a-z, uppercase A-Z and digits 0-9 count as the required classes', () => {
  // Accented and non-Latin letters are not a-z / A-Z, so they cannot satisfy those rules.
  assert.deepEqual(checkPasswordPolicy('éééééééé').rules.map(rule => rule.met), [true, false, false, false]);
  assert.equal(ruleMet('ÉÉÉÉÉÉÉÉ', 'uppercase'), false);
  // Non-ASCII digits are not 0-9.
  assert.equal(ruleMet('Abcdefg٣', 'digit'), false);
  // Length counts code points: seven emoji are seven characters, not fourteen code units.
  assert.equal(ruleMet('😀😀😀😀😀😀😀', 'length'), false);
  assert.equal(ruleMet('😀😀😀😀😀😀😀😀', 'length'), true);
  // Unicode letters add length but an ASCII mix is still required.
  assert.equal(checkPasswordPolicy('Ünïcödé-9').valid, false);
  assert.equal(checkPasswordPolicy('Ünïcödé-9aB').valid, true);
});

test('containing a common word of 5 or more characters lowers the rating one level, not to weak', () => {
  assert.equal(checkPasswordPolicy('MyPassword123').valid, true);
  assert.notEqual(rating('MyPassword123'), 'strong');
  assert.equal(level('MyPassword123'), 2);
  // Short list entries (under 5 characters) do not trigger the containment penalty.
  assert.equal(level('Cobalt-Test-Quilt-47'), 3);
});

test('low character variety is penalised', () => {
  assert.equal(checkPasswordPolicy('Abababababab1').valid, true);
  assert.notEqual(rating('Abababababab1'), 'strong');
  assert.equal(level('Abababababab1'), 2);
  assert.equal(level('Cobalt-Heron-Quilt-47'), 3);
});
