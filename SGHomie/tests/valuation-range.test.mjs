import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from '../FrontEnd/node_modules/typescript/lib/typescript.js';
import * as range from '../FrontEnd/src/lib/valuationRange.ts';

const valuation = {
  estimated_value: 100,
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

test('range layout spans range, estimate and asking price with visible outlying markers', () => {
  for (const askingPrice of [40, 100, 160]) {
    const layout = range.getValuationRangeLayout({ lowerBound: 80, upperBound: 120, estimatedValue: 100, askingPrice });
    assert.ok(layout);
    for (const marker of [layout.lowerPosition, layout.upperPosition, layout.estimatePosition, layout.askingPosition]) {
      assert.ok(marker >= 0 && marker <= 100);
    }
    if (askingPrice < 80) assert.ok(layout.askingPosition < layout.lowerPosition);
    if (askingPrice > 120) assert.ok(layout.askingPosition > layout.upperPosition);
  }
});

test('narrow and equal ranges receive a non-zero display domain', () => {
  const narrow = range.getValuationRangeLayout({ lowerBound: 99.99, upperBound: 100.01, estimatedValue: 100, askingPrice: 100 });
  const equal = range.getValuationRangeLayout({ lowerBound: 100, upperBound: 100, estimatedValue: 100, askingPrice: 100 });
  assert.ok(narrow && narrow.domainMax > narrow.domainMin);
  assert.ok(equal && equal.domainMax > equal.domainMin);
  assert.ok(equal.askingPosition >= 0 && equal.askingPosition <= 100);
});

test('invalid, inconsistent and overflowing values fail safely', () => {
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

test('gauge exposes only model boundaries and text equivalents for each asking-price position', () => {
  const Gauge = gaugeComponent();
  const markerClasses = [];
  for (const pricePosition of ['below_estimated_market_range', 'within_estimated_market_range', 'above_estimated_market_range']) {
    const askingPrice = pricePosition === 'below_estimated_market_range' ? 50 : pricePosition === 'above_estimated_market_range' ? 150 : 100;
    const tree = Gauge({ valuation, askingPrice, pricePosition });
    const layout = range.getValuationRangeLayout({ lowerBound: 80, upperBound: 120, estimatedValue: 100, askingPrice });
    assert.ok(layout);
    const paddedDomainCopy = [range.formatSingaporeDollars(layout.domainMin), range.formatSingaporeDollars(layout.domainMax)];
    const pending = [tree];
    let group = null;
    const focusTargets = [];
    const tooltipClasses = [];
    while (pending.length) {
      const node = pending.pop();
      if (Array.isArray(node)) {
        pending.push(...node);
        continue;
      }
      if (!node || typeof node !== 'object') continue;
      if (node.props?.role === 'group') group = node;
      if (node.props?.tabIndex === 0) focusTargets.push(node);
      if (node.props?.role === 'tooltip') tooltipClasses.push(node.props.className);
      if (node.props?.className?.includes('rounded-full border-2')) markerClasses.push(node.props.className);
      pending.push(node.props?.children);
    }
    const text = flatten(tree).join(' ').replace(/\s+/g, ' ').trim();
    assert.ok(group, JSON.stringify(tree));
    assert.match(text, /Lower bound S\$80/);
    assert.match(text, /Likely market range S\$80\s*–\s*S\$120/);
    assert.match(text, /Upper bound S\$120/);
    assert.match(text, /Estimated market value S\$100/);
    assert.match(text, /Asking price S\$/);
    assert.match(text, /Below expected range|Within expected range|Above expected range/);
    for (const displayOnlyValue of paddedDomainCopy) assert.equal(text.includes(displayOnlyValue), false, `${displayOnlyValue} is chart padding, not a valuation boundary`);
    assert.ok(focusTargets.every((target) => target.props.role === 'img' && target.props['aria-label'] && target.props['aria-describedby']), 'all important values are keyboard-focusable tooltip targets');
    assert.ok(focusTargets.some((target) => /Likely market range/.test(target.props['aria-label'])));
    assert.ok(focusTargets.some((target) => /Estimated market value/.test(target.props['aria-label'])));
    assert.ok(focusTargets.some((target) => /Asking price/.test(target.props['aria-label'])));
    assert.ok(focusTargets.some((target) => target.props['aria-label'].includes(pricePosition === 'below_estimated_market_range' ? 'Below expected range' : pricePosition === 'above_estimated_market_range' ? 'Above expected range' : 'Within expected range')));
    assert.ok(tooltipClasses.some((className) => className.includes('group-hover:opacity-100') && className.includes('group-focus-visible:opacity-100')));
  }
  assert.equal(new Set(markerClasses).size, 3, 'position markers remain distinguishable by style as well as text');
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
