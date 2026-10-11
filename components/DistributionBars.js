import { usd } from '@/lib/format';

// Horizontal bars (deal count). Each bar wears its entity colour (same as
// the chips in the deal tables); focus rows are bold; every bar is labelled.
export default function DistributionBars({ rows, keyName, focus = [], toneOf = () => null }) {
  const max = Math.max(1, ...rows.map((r) => r.deals));
  const focusSet = new Set(focus.map((f) => f.toLowerCase()));
  return (
    <div className="bars" role="table" aria-label={`Deals by ${keyName}`}>
      {rows.map((r) => {
        const name = r[keyName] === 'unknown' || r[keyName] === 'undisclosed' ? 'Not stated' : r[keyName];
        const money = usd(r.total_usd_m);
        const tip = `${name}: ${r.deals} deal${r.deals === 1 ? '' : 's'}, ${r.disclosed_deals} disclosed${money ? `, ${money} total` : ''}`;
        return (
          <div key={name} role="row" title={tip} className={`bar-row${focusSet.has(String(r[keyName]).toLowerCase()) ? ' focus' : ''}`} style={toneOf(r[keyName]) ? { '--tone': toneOf(r[keyName]) } : undefined}>
            <span className="name" role="cell">{toneOf(r[keyName]) && <i />}{name}</span>
            <span className="track" role="cell" aria-hidden="true">
              <span className="fill" style={{ width: `${(r.deals / max) * 100}%`, display: 'block' }} />
            </span>
            <span className="val num" role="cell">
              {r.deals} {money && <span className="muted">· {money}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
