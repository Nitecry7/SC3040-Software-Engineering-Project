import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from '../FrontEnd/node_modules/typescript/lib/typescript.js';
import * as range from '../FrontEnd/src/lib/valuationRange.ts';

const valuation = {
  estimated_value: 101,
  lower_bound: 80,
  upper_bound: 120,
  interval_half_width: 20,
  interval_full_width: 40,
  coverage_target: 0.9,
  model_version: 'research',
  uncertainty_method: 'town_conformal',
  uncertainty_group: 'TOWN',
  uncertainty_support: 100,
  used_global_fallback: false,
  price_position: 'within_estimated_market_range',
};

const layout = (askingPrice, bounds = [80, 120], estimate = 101) => range.getValuationRangeLayout({
  lowerBound: bounds[0], upperBound: bounds[1], estimatedValue: estimate, askingPrice,
});

test('ordinary scale keeps 12% padding and maps the actual estimate linearly', () => {
  const result = layout(100, [80, 120], 95);
  assert.ok(result);
  assert.equal(result.scaleMode, 'linear');
  assert.equal(result.domainMin, 75.2);
  assert.equal(result.domainMax, 124.8);
  assert.equal(result.displayDomainMin, result.domainMin);
  assert.equal(result.displayDomainMax, result.domainMax);
  assert.ok(result.estimatePosition < (result.lowerPosition + result.upperPosition) / 2);
  assert.equal(result.estimatePosition, ((95 - 75.2) / (124.8 - 75.2)) * 100);
});

test('asking marker maps below, within, above, and at either bound without changing classification inputs', () => {
  for (const [asking, expected] of [[40, 'below'], [100, 'within'], [160, 'above'], [80, 'lower'], [120, 'upper']]) {
    const result = layout(asking);
    assert.ok(result);
    assert.equal(result.scaleMode, 'linear');
    if (expected === 'below') assert.ok(result.askingPosition < result.lowerPosition);
    if (expected === 'within') assert.ok(result.askingPosition > result.lowerPosition && result.askingPosition < result.upperPosition);
    if (expected === 'above') assert.ok(result.askingPosition > result.upperPosition);
    if (expected === 'lower') assert.equal(result.askingPosition, result.lowerPosition);
    if (expected === 'upper') assert.equal(result.askingPosition, result.upperPosition);
    assert.equal(result.askingBeyondScale, null);
  }
});

test('narrow and equal ranges have a safe non-zero display domain', () => {
  const narrow = layout(100, [99.99, 100.01], 100);
  const equal = layout(100, [100, 100], 100);
  assert.ok(narrow && narrow.displayDomainMax > narrow.displayDomainMin);
  assert.ok(equal && equal.displayDomainMax > equal.displayDomainMin);
  assert.equal(equal.lowerPosition, equal.upperPosition);
});

test('extreme outliers compress tails while preserving a readable linear likely range and continuation', () => {
  for (const [bounds, estimate, asking, direction] of [
    [[100_000_000, 100_000_040], 100_000_017, 1, 'below'],
    [[80, 120], 101, 100_000_000, 'above'],
  ]) {
    const result = layout(asking, bounds, estimate);
    assert.ok(result);
    assert.equal(result.scaleMode, 'compressed');
    assert.equal(result.askingBeyondScale, direction);
    assert.equal(result.askingPosition, direction === 'below' ? 0 : 100);
    const width = bounds[1] - bounds[0];
    if (direction === 'below') {
      assert.equal(result.displayDomainMin, bounds[0] - width * 3);
      assert.equal(result.displayDomainMax, bounds[1] + width * 0.12);
    } else {
      assert.equal(result.displayDomainMin, bounds[0] - width * 0.12);
      assert.equal(result.displayDomainMax, bounds[1] + width * 3);
    }
    assert.ok(result.upperPosition - result.lowerPosition >= 18);
    assert.ok(result.estimatePosition > result.lowerPosition && result.estimatePosition < result.upperPosition);
    assert.ok([result.lowerPosition, result.estimatePosition, result.upperPosition, result.askingPosition].every((point) => point >= 0 && point <= 100));
  }
});

test('moderate outliers stay linear and positions share the same mapping', () => {
  const result = layout(480_000, [500_000, 520_000], 507_000);
  assert.ok(result);
  assert.equal(result.scaleMode, 'linear');
  assert.ok(result.askingPosition < result.lowerPosition);
});

test('invalid, inconsistent, non-finite and overflowing values fail safely', () => {
  const invalidInputs = [
    { lowerBound: 120, upperBound: 80, estimatedValue: 100, askingPrice: 100 },
    { lowerBound: 80, upperBound: 120, estimatedValue: 130, askingPrice: 100 },
    { lowerBound: 80, upperBound: 120, estimatedValue: 100, askingPrice: Number.NaN },
    { lowerBound: Number.POSITIVE_INFINITY, upperBound: 120, estimatedValue: 100, askingPrice: 100 },
    { lowerBound: Number.MAX_VALUE * 0.8, upperBound: Number.MAX_VALUE, estimatedValue: Number.MAX_VALUE * 0.9, askingPrice: Number.MAX_VALUE },
  ];
  for (const input of invalidInputs) assert.equal(range.getValuationRangeLayout(input), null);
  assert.equal(range.formatSingaporeDollars(Number.NaN), 'Unavailable');
});

function gaugeComponent() {
  const source = readFileSync(new URL('../FrontEnd/src/components/ValuationRangeGauge.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(compiled, {
    exports,
    require(name) {
      if (name === '../lib/valuationRange') return range;
      if (name === 'react/jsx-runtime') {
        const jsx = (type, props) => ({ type, props });
        return { jsx, jsxs: jsx };
      }
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports.ValuationRangeGauge;
}

const flatten = (node) => {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (node && typeof node === 'object') return flatten(node.props?.children ?? []);
  return [];
};

test('gauge anchors all three valuation labels and retains an accessible asking marker', () => {
  const Gauge = gaugeComponent();
  const tree = Gauge({ valuation, askingPrice: 100, pricePosition: valuation.price_position });
  const pending = [tree];
  const markers = [];
  const anchors = [];
  while (pending.length) {
    const node = pending.pop();
    if (Array.isArray(node)) { pending.push(...node); continue; }
    if (!node || typeof node !== 'object') continue;
    if (node.props?.tabIndex === 0) markers.push(node);
    if (/valuation-gauge-anchor--(?:lower|estimate|upper)/.test(node.props?.className ?? '')) anchors.push(node);
    pending.push(node.props?.children);
  }
  const text = flatten(tree).join(' ').replace(/\s+/g, ' ').trim();
  assert.match(text, /Lower bound S\$80/);
  assert.match(text, /Est\. market value S\$101/);
  assert.match(text, /Upper bound S\$120/);
  assert.match(text, /Asking: S\$100/);
  assert.match(text, /90% calibration target across evaluation data/);
  assert.equal(anchors.length, 3);
  const expected = range.getValuationRangeLayout({ lowerBound: 80, upperBound: 120, estimatedValue: 101, askingPrice: 100 });
  assert.equal(anchors.find((node) => node.props.className.includes('anchor--lower')).props.style.left, `${expected.lowerPosition}%`);
  assert.equal(anchors.find((node) => node.props.className.includes('anchor--estimate')).props.style.left, `${expected.estimatePosition}%`);
  assert.equal(anchors.find((node) => node.props.className.includes('anchor--upper')).props.style.left, `${expected.upperPosition}%`);
  assert.ok(markers.some((marker) => /Asking price S\$100\. Within expected range/.test(marker.props['aria-label'])));
  assert.ok(markers.every((marker) => marker.props.role === 'img' && marker.props['aria-describedby']));
});

test('asking marker keeps its below, within and above status text', () => {
  const Gauge = gaugeComponent();
  for (const [askingPrice, pricePosition, expected] of [
    [60, 'below_estimated_market_range', 'Below expected range'],
    [100, 'within_estimated_market_range', 'Within expected range'],
    [160, 'above_estimated_market_range', 'Above expected range'],
  ]) {
    const tree = Gauge({ valuation, askingPrice, pricePosition });
    const askingMarker = [];
    const pending = [tree];
    while (pending.length) {
      const node = pending.pop();
      if (Array.isArray(node)) { pending.push(...node); continue; }
      if (!node || typeof node !== 'object') continue;
      if (node.props?.tabIndex === 0 && /Asking price/.test(node.props['aria-label'] ?? '')) askingMarker.push(node);
      pending.push(node.props?.children);
    }
    assert.match(askingMarker[0].props['aria-label'], new RegExp(expected));
  }
});

test('outlier asking marker has exact value and explicit displayed-scale cue', () => {
  const Gauge = gaugeComponent();
  const tree = Gauge({
    valuation: { ...valuation, lower_bound: 80, upper_bound: 120, estimated_value: 101 },
    askingPrice: 100_000_000,
    pricePosition: 'above_estimated_market_range',
  });
  const text = flatten(tree).join(' ').replace(/\s+/g, ' ');
  assert.match(text, /Asking: S\$100,000,000 → Above displayed scale/);
  assert.match(text, /Marker positions are nonlinear/);
  const nodes = [];
  const pending = [tree];
  while (pending.length) {
    const node = pending.pop();
    if (Array.isArray(node)) { pending.push(...node); continue; }
    if (!node || typeof node !== 'object') continue;
    if (node.props?.tabIndex === 0 && /Asking price/.test(node.props['aria-label'] ?? '')) nodes.push(node);
    pending.push(node.props?.children);
  }
  assert.match(nodes[0].props['aria-label'], /Above displayed scale/);
});

test('valuation motion is reduced when the user requests less motion', () => {
  const css = readFileSync(new URL('../FrontEnd/src/index.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.valuation-cta::before\s*\{\s*animation:\s*none/);
  assert.match(css, /\.valuation-result-enter\s*\{\s*animation:\s*none/);
});

test('invalid gauge values render an explanatory fallback instead of a broken scale', () => {
  const Gauge = gaugeComponent();
  const tree = Gauge({ valuation: { ...valuation, upper_bound: Number.NaN }, askingPrice: 100, pricePosition: valuation.price_position });
  assert.match(flatten(tree).join(' '), /Range visualisation is unavailable/);
  assert.equal(tree.props.role, 'status');
});
