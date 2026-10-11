import DealTable, { SourceLink } from './DealTable';
import DistributionBars from './DistributionBars';
import { weekRange, usd, istDateTime } from '@/lib/format';
import { sectorColors, stageColor, sortStages } from '@/lib/colors';

const I = {
  deals: 'M4 19V9m5 10V5m5 14v-7m5 7V3',
  money: 'M12 3v18M17 7H9.5a3 3 0 000 6h5a3 3 0 010 6H6',
  target: 'M12 21a9 9 0 100-18 9 9 0 000 18zm0-5a4 4 0 100-8 4 4 0 000 8zm0-3a1 1 0 100-2 1 1 0 000 2z',
  bell: 'M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a2 2 0 003.4 0',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z',
  chart: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  users: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
};
const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const SecIcon = ({ d, tone }) => <span className="sec-icon" style={{ '--tone': tone }}><Icon d={d} /></span>;

function Stat({ label, value, sub, alert, tone, icon }) {
  return (
    <div className={`stat${alert ? ' alert' : ''}`} style={{ '--tone': tone }}>
      <div className="icon"><Icon d={icon} size={18} /></div>
      <div className="label">{label}</div>
      <div className="value num">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

const Chevron = () => (
  <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

function Alerts({ data, config }) {
  const total = data.watch.length + data.adjacency.length;
  if (!total) {
    return (
      <section className="card">
        <div className="all-clear">
          <span className="icon"><CheckIcon /></span>
          <div>
            <p><strong>No watchlist or portfolio alerts this week.</strong></p>
            <p className="muted">
              None of the {data.focus.length + data.sector_only.length + data.other.length} deals involve a watchlist company or
              look adjacent to a portfolio company.
            </p>
            {config?.watchlist?.length > 0 && (
              <div className="watching">
                <span className="muted" style={{ fontSize: 13 }}>Watching:</span>
                {config.watchlist.map((w) => <span key={w.name} className="pill">{w.name}</span>)}
                <a href="/config" style={{ fontSize: 13 }}>Edit</a>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className="card">
      <div className="card-title">
        <h2><SecIcon d={I.bell} tone="var(--t-amber)" />Alerts</h2>
        <span className="hint">Check the source before acting</span>
      </div>
      <div className="alerts">
        {data.watch.map((w, i) => (
          <div className="alert-card" key={`w${i}`}>
            <div className="tag">Watchlist · {w.watch}</div>
            <div className="headline">
              {w.deal.company} raised {w.deal.amount_text || 'an undisclosed amount'}
              {w.deal.stage !== 'undisclosed' && ` (${w.deal.stage})`}
              {w.deal.lead_investor && `, led by ${w.deal.lead_investor}`}
            </div>
            <div className="why">
              {w.note} <SourceLink d={w.deal} />
            </div>
          </div>
        ))}
        {data.adjacency.map((a, i) => (
          <div className="alert-card" key={`a${i}`}>
            <div className="tag">Possible adjacency · {a.portfolio}</div>
            <div className="headline">
              {a.deal.company} raised {a.deal.amount_text || 'an undisclosed amount'}
              {a.deal.stage !== 'undisclosed' && ` (${a.deal.stage})`}
            </div>
            <div className="why">
              Same sector ({a.sector}) and mentions “{a.keyword}”. {a.note} <SourceLink d={a.deal} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const DIRECTION = {
  up: { label: 'Above average', cls: 'up', arrow: '▲' },
  down: { label: 'Below average', cls: 'down', arrow: '▼' },
  steady: { label: 'In line', cls: 'steady', arrow: '—' },
};

// "Is deal activity in a space his portfolio touches accelerating or
// cooling?" Direction is computed in code (lib/match.js), not by Gemini.
function Trends({ stats, colorOf }) {
  const t = stats.sector_trends;
  const n = stats.overall_4wk_avg?.weeks || 4;
  return (
    <section className="card">
      <div className="card-title">
        <h2><SecIcon d={I.chart} tone="var(--t-amber)" />Your sectors vs recent average</h2>
        <span className="hint">Deals per week</span>
      </div>
      {!t ? (
        <p className="muted">
          Comparisons start once 3 earlier weeks are stored (currently {stats.prior_weeks}). Until then the brief only
          describes this week.
        </p>
      ) : (
        <>
          {stats.overall_4wk_avg && (
            <p className="trend-overall">
              <strong className="num">{stats.total_deals}</strong> deals this week vs{' '}
              <strong className="num">{stats.overall_4wk_avg.avg_deals}</strong> a week on average over the previous{' '}
              {stats.overall_4wk_avg.weeks} weeks.
            </p>
          )}
          <div className="scroll"><table className="table trend-table">
            <thead>
              <tr><th>Sector</th><th className="right">This week</th><th className="right">{n}-wk avg</th><th>Direction</th></tr>
            </thead>
            <tbody>
              {t.map((r) => {
                const d = DIRECTION[r.direction];
                return (
                  <tr key={r.sector}>
                    <td>
                      <span className="tag-chip" style={{ '--tone': colorOf(r.sector) }}><i />{r.sector}</span>
                      {r.portfolio && <span className="pill accent" style={{ marginLeft: 6 }}>portfolio</span>}
                    </td>
                    <td className="right num"><strong>{r.this_week}</strong></td>
                    <td className="right num muted">{r.avg_4wk}</td>
                    <td><span className={`trend ${d.cls}`}>{d.arrow} {d.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
          <p className="note">
            “Above/below” needs at least 1.5× (or 0.5×) the average and a gap of 2+ deals.
            {stats.backfilled_weeks?.length > 0 &&
              ` Earlier weeks (${stats.backfilled_weeks.join(', ')}) were backfilled from Google News archives, which can miss a few deals the live RSS feeds catch.`}
          </p>
        </>
      )}
    </section>
  );
}

// "Has a new investor started making moves in his target verticals?"
function Investors({ inv }) {
  if (!inv) return null;
  return (
    <section className="card">
      <div className="card-title">
        <h2><SecIcon d={I.users} tone="var(--t-violet)" />Investor activity</h2>
        <span className="hint">{inv.investors_this_week} investors named this week</span>
      </div>
      <div className="subhead" style={{ marginTop: 0 }}>Most active this week</div>
      {inv.most_active.length ? (
        <ul className="inv-list">
          {inv.most_active.map((i) => (
            <li key={i.name}>
              <div>
                <strong>{i.name}</strong>
                <div className="muted inv-sub">{i.companies.join(', ')}</div>
              </div>
              <span className="pill num">{i.deals} deal{i.deals === 1 ? '' : 's'}{i.leads ? ` · ${i.leads} led` : ''}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No investor appeared in more than one deal.</p>
      )}

      <div className="subhead">New to your sectors</div>
      {inv.new_in_focus === null ? (
        <p className="muted">Shown once 3 earlier weeks are stored, so “new” means something.</p>
      ) : inv.new_in_focus.length ? (
        <ul className="inv-list">
          {inv.new_in_focus.slice(0, 8).map((n, k) => (
            <li key={`${n.investor}-${k}`}>
              <div>
                <strong>{n.investor}</strong> <span className="muted">→ {n.sector}</span>
                <div className="muted inv-sub">
                  {n.lead ? 'Led' : 'Joined'} {n.company} ({n.amount_text || 'undisclosed'})
                  {n.first_time_seen ? ' · not seen in any sector before' : ''}
                </div>
              </div>
              <SourceLink d={n} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Every investor in your sectors this week has backed deals there before.</p>
      )}
      <p className="note">“New” = first time in our stored history (4 weeks), not first time ever.</p>
    </section>
  );
}

export default function BriefDashboard({ brief, config }) {
  const data = brief.data;
  const s = data.stats;
  const c = data.counts;
  const alerts = data.watch.length + data.adjacency.length;
  const focusCount = data.focus.length;
  const allDeals = [...data.focus, ...data.sector_only, ...data.other];
  const colorOf = sectorColors(config?.sectors || [], [...allDeals.map((d) => d.sector), ...s.by_sector.map((r) => r.sector)]);

  return (
    <main className="page">
      <section className="hero banner">
        <p className="eyebrow">Weekly brief · {weekRange(data.week_start)}</p>
        <h1>Where Indian startup capital moved last week</h1>
        {data.summary && <p className="summary">{data.summary}</p>}
        <div className="meta">
          <span>Generated {istDateTime(brief.created_at)} IST</span>
          <span aria-hidden="true">·</span>
          <span className={`pill ${c.sources_failed ? 'warn' : 'ok'}`}>
            <span className="dot" /> {c.rss_feeds + c.google_news_queries} sources, {c.sources_failed} failed
          </span>
        </div>
      </section>

      <div className="stats">
        <Stat tone="var(--t-blue)" icon={I.deals} label="Deals tracked" value={s.total_deals} sub={`${s.disclosed_deals} with disclosed amounts`} />
        <Stat tone="var(--t-green)" icon={I.money} label="Disclosed capital" value={usd(s.total_disclosed_usd_m) || '$0'} sub={`INR at ${data.inr_per_usd}/USD`} />
        <Stat tone="var(--t-violet)" icon={I.target} label="In your focus" value={focusCount} sub="Matching sectors and stages" />
        <Stat tone={alerts ? 'var(--t-amber)' : 'var(--t-gray)'} icon={I.bell} label="Alerts" value={alerts} sub="Watchlist + portfolio" alert={alerts > 0} />
      </div>

      <Alerts data={data} config={config} />

      <div className="grid-2 stack">
        <section className="card">
          <div className="card-title">
            <h2><SecIcon d={I.spark} tone="var(--t-violet)" />Patterns this week</h2>
            <span className="hint">Written by Gemini from the counts</span>
          </div>
          {data.patterns.length ? (
            <ol className="patterns">
              {data.patterns.map((p, i) => <li key={i}>{p}</li>)}
            </ol>
          ) : (
            <p className="muted">Not enough deals this week to describe patterns.</p>
          )}
          {!s.trend_allowed && (
            <p className="note">
              Week-over-week comparisons start after 3 weeks of history (currently {s.prior_weeks}), so this describes
              this week only.
            </p>
          )}
        </section>

        <section className="card">
          <div className="card-title">
            <h2><SecIcon d={I.chart} tone="var(--t-blue)" />Deals by sector</h2>
            <span className="hint">Count · disclosed $</span>
          </div>
          <DistributionBars rows={s.by_sector} keyName="sector" focus={config?.sectors || []} toneOf={colorOf} />
          <div className="chart-sub">By stage</div>
          <DistributionBars rows={sortStages(s.by_stage)} keyName="stage" focus={config?.stages || []} toneOf={stageColor} />
          <div className="legend">
            <span><strong style={{ color: 'var(--text)' }}>Bold</strong> = in your focus</span>
            <span>Stages shade light → dark from pre-seed to late stage</span>
          </div>
        </section>
      </div>

      <div className="grid-2 stack">
        <Trends stats={s} colorOf={colorOf} />
        <Investors inv={data.investors} />
      </div>

      <section className="card">
        <div className="card-title">
          <h2><SecIcon d={I.star} tone="var(--t-green)" />Focus deals</h2>
          <span className="hint">Your sectors and stages · largest first</span>
        </div>
        {data.focus.length ? <DealTable deals={data.focus} colorOf={colorOf} /> : <p className="muted">No deals matched both your sectors and stages this week.</p>}
        {data.sector_only.length > 0 && (
          <>
            <div className="subhead">Your sectors, other stages <span className="pill">{data.sector_only.length}</span></div>
            <DealTable deals={data.sector_only} colorOf={colorOf} />
          </>
        )}
      </section>

      {data.other.length > 0 && (
        <section className="card">
          <details className="more">
            <summary>
              <div className="card-title" style={{ margin: 0 }}>
                <h2><SecIcon d={I.list} tone="var(--t-gray)" />Other notable deals <span className="pill">{data.other.length}</span></h2>
              </div>
              <Chevron />
            </summary>
            <DealTable deals={data.other} colorOf={colorOf} />
          </details>
        </section>
      )}

      <section className="coverage">
        <div><strong>Coverage.</strong> {data.coverage}</div>
        <div>
          Every deal links to its source. Amounts are as reported; USD figures for INR rounds are converted at {data.inr_per_usd}/USD.
        </div>
      </section>
    </main>
  );
}
