import { usd, isLink } from '@/lib/format';
import { stageColor } from '@/lib/colors';

function Amount({ d }) {
  const converted = usd(d.amount_usd_m);
  const alreadyUsd = /\$|usd/i.test(d.amount_text || '');
  return (
    <>
      <div className="amount num">{d.amount_text || <span className="muted">Undisclosed</span>}</div>
      {converted && !alreadyUsd && <div className="usd num">≈ {converted}</div>}
    </>
  );
}

export function SourceLink({ d }) {
  if (!isLink(d.source_url)) return <span className="pill">Telegram</span>;
  return (
    <a href={d.source_url} target="_blank" rel="noopener noreferrer" title={d.headline || ''}>
      {d.source_name || 'Source'} ↗
    </a>
  );
}

// Result of the Gemini + Google Search fact-check, with the pages it used.
function VerifyBadge({ d }) {
  // Only positive results and real warnings get a badge; unchecked or
  // not-found deals stay clean (the source link is always there).
  const label = { verified: '✓ Verified', mismatch: '⚠ Check amount' }[d.verify_status];
  if (!label) return null;
  const sources = Array.isArray(d.verify_sources) ? d.verify_sources : [];
  return (
    <details className={`vbadge ${d.verify_status}`}>
      <summary title="Fact-checked with Gemini + Google Search">{label}</summary>
      <div className="pop">
        <strong>Gemini + Google Search fact-check</strong>
        {d.verify_note && <div style={{ marginTop: 4 }}>{d.verify_note}</div>}
        {sources.length > 0 && (
          <ul>
            {sources.map((s, i) => (
              <li key={i}><a href={s.uri} target="_blank" rel="noopener noreferrer">{s.title}</a></li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

export default function DealTable({ deals, colorOf = () => 'var(--c-other)' }) {
  return (
    <div className="table-wrap">
      <table className="deals">
        <thead>
          <tr>
            <th>Company</th>
            <th className="right">Amount</th>
            <th>Stage · Sector</th>
            <th>Lead investor</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((d, i) => (
            <tr key={`${d.company}-${i}`} style={{ '--tone': colorOf(d.sector) }}>
              <td className="c-company">
                <div className="company">
                  {d.company} {d.origin === 'manual' && <span className="pill accent">via Telegram</span>}
                  <VerifyBadge d={d} />
                </div>
                {d.headline && <div className="headline">{d.headline}</div>}
              </td>
              <td className="c-amount right"><Amount d={d} /></td>
              <td className="c-tags">
                <span className="tag-chip" style={{ '--tone': stageColor(d.stage) }}><i />{d.stage === 'undisclosed' ? 'Stage n/a' : d.stage}</span>{' '}
                {d.sector && <span className="tag-chip" style={{ '--tone': colorOf(d.sector) }}><i />{d.sector}</span>}
              </td>
              <td className="c-lead lead">{d.lead_investor || ''}</td>
              <td className="c-source source"><SourceLink d={d} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
