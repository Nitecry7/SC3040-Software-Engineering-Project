import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, content, nodes } from './helpers/frontend-component.mjs';
import * as policy from '../FrontEnd/src/lib/passwordPolicy.ts';

// Renders the real meter with the real policy module. Icons are stand-ins. This
// proves the markup and text the component emits, not browser layout or colour.
function meter(props) {
  const app = componentHarness(new URL('../FrontEnd/src/components/PasswordStrength.tsx', import.meta.url), {
    'lucide-react': { Check: 'CheckIcon', X: 'XIcon' },
    '../lib/passwordPolicy': policy,
  }, props);
  return app.render();
}

const find = (tree, predicate) => nodes(tree).find(predicate);
const bar = tree => find(tree, node => node.props['aria-hidden'] === 'true' && typeof node.type === 'string' && Array.isArray(node.props.children) && node.props.children.length === 3);
const filled = tree => bar(tree).props.children.filter(segment => /bg-(red|amber|green)-/.test(segment.props.className)).length;
const segmentColour = tree => bar(tree).props.children[0].props.className.match(/bg-(red|amber|green)-\d+/)[0];
const status = tree => find(tree, node => node.props.role === 'status');
const items = tree => nodes(tree).filter(node => node.type === 'li');

test('an empty password shows the unmet checklist and an empty status region, without bar or label text', () => {
  const tree = meter({ password: '', id: 'pw-strength' });
  assert.equal(tree.props.id, 'pw-strength');
  assert.equal(bar(tree), undefined);
  assert.equal(content(status(tree)), '');
  assert.equal(nodes(tree).filter(node => node.props.role === 'status').length, 1);
  const states = items(tree).map(item => content(nodes(item).find(node => /sr-only/.test(node.props.className ?? ''))).trim());
  assert.deepEqual(states, ['not met', 'not met', 'not met', 'not met']);
});

test('weak input fills one red segment and labels it Weak', () => {
  const tree = meter({ password: 'Password1', id: 'pw-strength' });
  assert.equal(filled(tree), 1);
  assert.match(segmentColour(tree), /bg-red-/);
  assert.equal(content(status(tree)), 'Strength estimate: Weak');
});

test('fair input fills two amber segments and labels it Fair', () => {
  const tree = meter({ password: 'Zebra4Lamp', id: 'pw-strength' });
  assert.equal(filled(tree), 2);
  assert.match(segmentColour(tree), /bg-amber-/);
  assert.equal(content(status(tree)), 'Strength estimate: Fair');
});

test('strong input fills three green segments and labels it Strong', () => {
  const tree = meter({ password: 'Cobalt-Heron-Quilt-47', id: 'pw-strength' });
  assert.equal(filled(tree), 3);
  assert.match(segmentColour(tree), /bg-green-/);
  assert.equal(content(status(tree)), 'Strength estimate: Strong');
});

test('the email is passed to the estimator', () => {
  const tree = meter({ password: 'Cobalt-Heron-Quilt-47', email: 'heron@example.invalid', id: 'pw-strength' });
  assert.equal(content(status(tree)), 'Strength estimate: Weak');
});

test('the label sits in one polite status region and the bar is decorative', () => {
  const tree = meter({ password: 'Zebra4Lamp', id: 'pw-strength' });
  const regions = nodes(tree).filter(node => node.props.role === 'status');
  assert.equal(regions.length, 1);
  assert.equal(regions[0].props['aria-live'], 'polite');
  assert.equal(bar(tree).props['aria-hidden'], 'true');
  // The label text is dark, not coloured by rating.
  assert.match(regions[0].props.className, /text-gray-700/);
});

test('the root carries the id used by aria-describedby', () => {
  const tree = meter({ password: 'x', id: 'pw-strength' });
  assert.equal(tree.props.id, 'pw-strength');
});

test('every checklist item exposes met or not met as text and hides its icon', () => {
  const tree = meter({ password: 'abcdefgh', id: 'pw-strength' });
  const list = items(tree);
  assert.equal(list.length, 4);
  const expected = { length: 'met', lowercase: 'met', uppercase: 'not met', digit: 'not met' };
  policy.PASSWORD_RULES.forEach((rule, index) => {
    const item = list[index];
    assert.ok(content(item).includes(rule.label), rule.label);
    const hidden = nodes(item).find(node => node.props.className && /sr-only/.test(node.props.className));
    assert.ok(hidden, `${rule.id} has visually hidden state text`);
    assert.equal(content(hidden).trim(), expected[rule.id]);
    const icons = nodes(item).filter(node => node.type === 'CheckIcon' || node.type === 'XIcon');
    assert.equal(icons.length, 1);
    assert.equal(icons[0].props['aria-hidden'], 'true');
    assert.equal(icons[0].type, expected[rule.id] === 'met' ? 'CheckIcon' : 'XIcon');
  });
});

test('a compliant password shows all four rules as met', () => {
  const tree = meter({ password: 'Zebra4Lamp', id: 'pw-strength' });
  const states = items(tree).map(item => content(nodes(item).find(node => /sr-only/.test(node.props.className ?? ''))).trim());
  assert.deepEqual(states, ['met', 'met', 'met', 'met']);
});
