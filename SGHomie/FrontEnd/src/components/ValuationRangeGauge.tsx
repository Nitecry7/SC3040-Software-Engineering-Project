import { getValuationRangeLayout, formatSingaporeDollars } from '../lib/valuationRange';
import type { PropertyValuation } from '../lib/valuation';

type ValuationRangeGaugeProps = {
  valuation: PropertyValuation;
  askingPrice: number;
  pricePosition: PropertyValuation['price_position'];
};

const askingMarkerLabel = (position: ValuationRangeGaugeProps['pricePosition']) => {
  switch (position) {
    case 'below_estimated_market_range': return 'Below expected range';
    case 'above_estimated_market_range': return 'Above expected range';
    default: return 'Within expected range';
  }
};

const markerTone = (position: ValuationRangeGaugeProps['pricePosition']) => {
  switch (position) {
    case 'below_estimated_market_range': return 'border-amber-800 bg-amber-500';
    case 'above_estimated_market_range': return 'border-rose-800 bg-rose-500';
    default: return 'border-emerald-800 bg-emerald-500';
  }
};

const tooltipClass = 'pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-56 -translate-x-1/2 rounded-lg bg-slate-950 px-3 py-2 text-left text-xs font-medium leading-relaxed text-white opacity-0 shadow-lg transition duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100';

export const ValuationRangeGauge = ({ valuation, askingPrice, pricePosition }: ValuationRangeGaugeProps) => {
  const layout = getValuationRangeLayout({
    lowerBound: valuation.lower_bound,
    upperBound: valuation.upper_bound,
    estimatedValue: valuation.estimated_value,
    askingPrice,
  });

  if (!layout) {
    return <p role="status" className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">Range visualisation is unavailable for these values.</p>;
  }

  const rangeWidth = layout.upperPosition - layout.lowerPosition;
  const coverageLabel = `${Math.round(valuation.coverage_target * 100)}% calibration target`;
  const positionLabel = askingMarkerLabel(pricePosition);

  return (
    <figure className="mt-5" aria-labelledby="valuation-range-caption">
      <div className="relative h-12 overflow-visible" role="group" aria-label="Interactive likely market range gauge">
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-full bg-gray-100 ring-1 ring-inset ring-gray-200">
          <div className="absolute inset-y-0 left-0 bg-amber-100" style={{ width: `${layout.lowerPosition}%` }} />
          <div className="valuation-market-band absolute inset-y-0 bg-emerald-100" style={{ left: `${layout.lowerPosition}%`, width: `${rangeWidth}%` }} />
          <div className="absolute inset-y-0 right-0 bg-rose-100" style={{ left: `${layout.upperPosition}%` }} />
        </div>

        <div
          tabIndex={0}
          role="img"
          className="group absolute inset-y-0 z-10 min-w-6 rounded-full bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-emerald-800 focus-visible:ring-offset-2"
          style={{ left: `${layout.lowerPosition}%`, width: `${rangeWidth}%` }}
          aria-label={`Likely market range ${formatSingaporeDollars(layout.lowerBound)} to ${formatSingaporeDollars(layout.upperBound)}. ${coverageLabel}.`}
          aria-describedby="valuation-range-band-tooltip"
        >
          <span id="valuation-range-band-tooltip" role="tooltip" className={`${tooltipClass} valuation-tooltip-y`}>
            <span className="block font-semibold">Likely market range</span>
            <span>{formatSingaporeDollars(layout.lowerBound)} – {formatSingaporeDollars(layout.upperBound)}</span>
            <span className="block text-slate-300">{coverageLabel}</span>
          </span>
        </div>

        <div
          tabIndex={0}
          role="img"
          className="group absolute inset-y-0 z-20 w-8 -translate-x-1/2 rounded-full bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-amber-800 focus-visible:ring-offset-2"
          style={{ left: `${layout.lowerPosition}%` }}
          aria-label={`Lower likely-market bound ${formatSingaporeDollars(layout.lowerBound)}`}
          aria-describedby="valuation-lower-bound-tooltip"
        >
          <span id="valuation-lower-bound-tooltip" role="tooltip" className={`${tooltipClass} valuation-tooltip-y`}>
            <span className="block font-semibold">Lower likely-market bound</span>
            {formatSingaporeDollars(layout.lowerBound)}
          </span>
        </div>

        <div
          tabIndex={0}
          role="img"
          className="group absolute inset-y-0 z-20 w-8 -translate-x-1/2 rounded-full bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-rose-800 focus-visible:ring-offset-2"
          style={{ left: `${layout.upperPosition}%` }}
          aria-label={`Upper likely-market bound ${formatSingaporeDollars(layout.upperBound)}`}
          aria-describedby="valuation-upper-bound-tooltip"
        >
          <span id="valuation-upper-bound-tooltip" role="tooltip" className={`${tooltipClass} valuation-tooltip-y`}>
            <span className="block font-semibold">Upper likely-market bound</span>
            {formatSingaporeDollars(layout.upperBound)}
          </span>
        </div>

        <div
          tabIndex={0}
          role="img"
          className="group absolute inset-y-0 z-30 w-8 -translate-x-1/2 rounded-full bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2"
          style={{ left: `${layout.estimatePosition}%` }}
          aria-label={`Estimated market value ${formatSingaporeDollars(layout.estimatedValue)}`}
          aria-describedby="valuation-estimate-tooltip"
        >
          <span aria-hidden="true" className="valuation-estimate-marker absolute left-1/2 top-2 h-8 w-[3px] -translate-x-1/2 rounded-full bg-blue-800 shadow-sm" />
          <span id="valuation-estimate-tooltip" role="tooltip" className={`${tooltipClass} valuation-tooltip-y`}>
            <span className="block font-semibold">Estimated market value</span>
            {formatSingaporeDollars(layout.estimatedValue)}
          </span>
        </div>

        <div
          tabIndex={0}
          role="img"
          className="group absolute inset-y-0 z-40 w-8 -translate-x-1/2 rounded-full bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
          style={{ left: `${layout.askingPosition}%` }}
          aria-label={`Asking price ${formatSingaporeDollars(layout.askingPrice)}. ${positionLabel}.`}
          aria-describedby="valuation-asking-price-tooltip"
        >
          <span aria-hidden="true" className={`valuation-asking-marker absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-sm ${markerTone(pricePosition)}`} />
          <span id="valuation-asking-price-tooltip" role="tooltip" className={`${tooltipClass} valuation-tooltip-y`}>
            <span className="block font-semibold">Asking price</span>
            <span>{formatSingaporeDollars(layout.askingPrice)}</span>
            <span className="block text-slate-300">{positionLabel}</span>
          </span>
        </div>
      </div>

      <figcaption id="valuation-range-caption" className="mt-3 grid gap-2 text-xs text-gray-700 sm:grid-cols-3">
        <span><span className="block font-semibold text-slate-800">Lower bound</span>{formatSingaporeDollars(layout.lowerBound)}</span>
        <span><span className="block font-semibold text-emerald-900">Likely market range</span>{formatSingaporeDollars(layout.lowerBound)} – {formatSingaporeDollars(layout.upperBound)}<span className="mt-0.5 block text-gray-500">{coverageLabel}</span></span>
        <span><span className="block font-semibold text-slate-800">Upper bound</span>{formatSingaporeDollars(layout.upperBound)}</span>
        <span className="sm:col-span-3">
          <span className="font-semibold text-blue-900">Estimated market value:</span> {formatSingaporeDollars(layout.estimatedValue)}.
          {' '}<span className="font-semibold text-slate-900">Asking price:</span> {formatSingaporeDollars(layout.askingPrice)} — {positionLabel.toLowerCase()}.
        </span>
      </figcaption>
    </figure>
  );
};

export default ValuationRangeGauge;
