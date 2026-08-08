/**
 * Builds normalized SVG coordinates for available numeric trend values.
 * @param {object[]} points - Chronological vitals points.
 * @param {string} metric - Numeric point field to chart.
 * @returns {{coordinates: string, values: number[], minimum: number|null, maximum: number|null}} Plot coordinates and range.
 * @sideEffects None.
 */
function buildPlot(points, metric) {
  const values = points.map((point) => point[metric]).filter((value) => Number.isFinite(value));
  if (!values.length) return { coordinates: "", values: [], minimum: null, maximum: null };
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const span = maximum - minimum || 1;
  const coordinates = values
    .map((value, index) => {
      const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
      const y = 85 - ((value - minimum) / span) * 70;
      return `${x},${y}`;
    })
    .join(" ");
  return { coordinates, values, minimum, maximum };
}

/**
 * Renders a compact accessible trend chart without adding a chart dependency.
 * @param {{points: object[], metric: string, label: string, unit: string}} props - Series, field, display label, and unit.
 * @returns {import("react").ReactElement} Trend card with plot or empty state.
 * @sideEffects None.
 */
export function VitalsTrendChart({ points, metric, label, unit }) {
  const plot = buildPlot(points, metric);
  const latest = plot.values.at(-1);
  return (
    <article className="vitals-trend-card">
      <div className="vitals-trend-card__heading">
        <div><span>{label}</span><strong>{latest == null ? "No data" : `${latest} ${unit}`}</strong></div>
        {plot.values.length > 1 && <small>{plot.minimum}–{plot.maximum} {unit}</small>}
      </div>
      {plot.values.length ? (
        <svg className="vitals-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${label} trend containing ${plot.values.length} readings`}>
          <line x1="0" y1="85" x2="100" y2="85" />
          <line x1="0" y1="50" x2="100" y2="50" />
          <line x1="0" y1="15" x2="100" y2="15" />
          {plot.values.length === 1 ? <circle cx="50" cy="50" r="3" /> : <polyline points={plot.coordinates} />}
        </svg>
      ) : <div className="vitals-chart-empty">No readings in this period.</div>}
    </article>
  );
}
