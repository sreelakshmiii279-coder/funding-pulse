import DealTable, { SourceLink } from './DealTable';
import DistributionBars from './DistributionBars';
import { weekRange, usd, istDateTime } from '@/lib/format';
import { sectorColors, stageColor, sortStages } from '@/lib/colors';

// ---------- small building blocks ----------

const I = {
  deals: 'M4 19V9m5 10V5m5 14v-7m5 7V3',
  money: 'M12 3v18M17 7H9.5a3 3 0 000 6h5a3 3 0 010 6H6',
  target: 'M12 21a9 9 0 100-18 9 9 0 000 18zm0-5a4 4 0 100-8 4 4 0 000 8zm0-3a1 1 0 100-2 1 1 0 000 2z',
  bell: 'M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a2 2 0 003.4 0',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z',
  chart: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  users: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  gear: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
};
const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const SecIcon = ({ d, tone }) => <span className="sec-icon" style={{ '--tone': tone }}><Icon d={d} /></span>;
const Chevron = () => (
  <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

function Spark({ values = [] }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  return (
    <div className="spark" aria-hidden="true">
      {values.map((v, i) => (
        <span key={i} className={i === values.length - 1 ? 'now' : ''} style={{ height: `${Math.max(10, (v / max) * 100)}%` }} />
      ))}
    </div>
  );
}

function Stat({ label, value, sub, alert, tone, icon, spark, delta }) {
  return (
    <div className={`stat${alert ? ' alert' : ''}`} style={{ '--tone': tone }}>
      <div className="top">
        <span className="label">{label}</span>
        <span className="icon"><Icon d={icon} size={15} /></span>
      </div>
      <div className="value num">{value}</div>
      <div className="sub">
        {delta && <span className={`delta ${delta.dir}`}>{delta.text} </span>}
        {sub}
      </div>
      <Spark values={spark} />
    </div>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortWeek = (ymd) => {
  const [, m, d] = ymd.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

// ---------- sections ----------

function Alerts({ data, config, total }) {
  const count = data.watch.length + data.adjacency.length;
  if (!count) {
    return (
      <section className="card" id="alerts">
        <div className="all-clear">
          <span className="icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </span>
          <div>
            <p><strong>No watchlist or portfolio alerts this week.</strong></p>
            <p className="muted">None of the {total} deals involve a watchlist company or look adjacent to a portfolio company.</p>
            {config?.watchlist?.length > 0 && (
              <div className="watching">
                <span className="muted" style={{ fontSize: 12.5 }}>Watching</span>
                {config.watchlist.map((w) => <span key={w.name} className="pill">{w.name}</span>)}
                <a href="/config" style={{ fontSize: 12.5 }}>Edit watchlist →</a>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className="card" id="alerts">
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
            <div className="why">{w.note} <SourceLink d={w.deal} /></div>
          </div>
        ))}
        {data.adjacency.map((a, i) => (
          <div className="alert-card" key={`a${i}`}>
            <div className="tag">Possible adjacency · {a.portfolio}</div>
            <div className="headline">
              {a.deal.company} raised {a.deal.amount_text || 'an undisclosed amount'}
              {a.deal.stage !== 'undisclosed' && ` (${a.deal.stage})`}
            </div>
            <div className="why">Same sector ({a.sector}) and mentions “{a.keyword}”. {a.note} <SourceLink d={a.deal} /></div>
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
  const hist = stats.history || [];
  const max = Math.max(1, ...hist.map((h) => h.deals));
  return (
    <section className="card" id="trends">
      <div className="card-title">
        <h2><SecIcon d={I.trend} tone="var(--t-amber)" />Momentum</h2>
        <span className="hint">Deals per week</span>
      </div>
      {hist.length > 1 && (
        <>
          <div className="weekly" role="img" aria-label="Deals per week">
            {hist.map((h, i) => (
              <div key={h.week} className={`col${i === hist.length - 1 ? ' now' : ''}`} title={`Week of ${h.week}: ${h.deals} deals, ${usd(h.usd_m) || '$0'} disclosed`}>
                <span className="v">{h.deals}</span>
                <span className="bar" style={{ height: `${(h.deals / max) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="weekly-labels">
            {hist.map((h, i) => <span key={h.week} className={i === hist.length - 1 ? 'now' : ''}>{i === hist.length - 1 ? 'This week' : shortWeek(h.week)}</span>)}
          </div>
        </>
      )}
      {!t ? (
        <p className="muted">Comparisons start once 3 earlier weeks are stored (currently {stats.prior_weeks}).</p>
      ) : (
        <>
          <div className="scroll">
            <table className="table trend-table">
              <thead>
                <tr><th>Your sector</th><th className="right">This week</th><th className="right">{n}-wk avg</th><th>Direction</th></tr>
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
                      <td><span className={`trend ${d.cls}`} title={d.label}>{d.arrow} <span className="dlabel">{d.label}</span></span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="note">
            “Above/below” needs at least 1.5× (or 0.5×) the average and a gap of 2+ deals, so one extra deal is never called a trend.
            {stats.backfilled_weeks?.length > 0 &&
              ` Earlier weeks (${stats.backfilled_weeks.map(shortWeek).join(', ')}) were backfilled from news archives and may slightly undercount.`}
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
    <section className="card" id="investors">
      <div className="card-title">
        <h2><SecIcon d={I.users} tone="var(--t-violet)" />Investor moves</h2>
        <span className="hint">{inv.investors_this_week} investors named</span>
      </div>
      <div className="subhead" style={{ marginTop: 0 }}>Most active this week</div>
      {inv.most_active.length ? (
        <ul className="inv-list">
          {inv.most_active.map((i) => (
            <li key={i.name}>
              <div className="inv-who">
                <span className="inv-avatar">{initials(i.name)}</span>
                <div>
                  <strong>{i.name}</strong>
                  <div className="muted inv-sub">{i.companies.join(', ')}</div>
                </div>
              </div>
              <span className="pill num">{i.deals} deals{i.leads ? ` · ${i.leads} led` : ''}</span>
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
          {inv.new_in_focus.slice(0, 6).map((n, k) => (
            <li key={`${n.investor}-${k}`}>
              <div className="inv-who">
                <span className="inv-avatar" style={{ background: 'var(--gold-soft)', color: 'var(--gold)' }}>{initials(n.investor)}</span>
                <div>
                  <strong>{n.investor}</strong> <span className="muted">→ {n.sector}</span>
                  <div className="muted inv-sub">
                    {n.lead ? 'Led' : 'Joined'} {n.company} ({n.amount_text || 'undisclosed'})
                    {n.first_time_seen ? ' · not seen in any sector before' : ''}
                  </div>
                </div>
              </div>
              <SourceLink d={n} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Every investor in your sectors this week has backed deals there before.</p>
      )}
      <p className="note">“New” = first time in our stored history, not first time ever.</p>
    </section>
  );
}

// The run as a funnel: how ~700 stories became a short list of checked deals.
function Method({ data }) {
  const f = data.funnel;
  if (!f) return null;
  const v = data.verification;
  const steps = [
    { what: 'Stories collected', how: `${f.sources} sources: RSS, Google News, GDELT`, n: f.raw },
    { what: 'From the last 7 days', how: 'Older items dropped', n: f.in_window },
    { what: 'Unique stories', how: 'Same URL or near-identical title merged', n: f.deduped },
    { what: 'Funding candidates', how: 'Keyword filter in code (no AI)', n: f.candidates },
    { what: 'Funding mentions', how: 'Gemini Flash extraction', n: f.funding_mentions, ai: true },
    { what: 'Unique deals', how: 'Same round across outlets merged', n: f.deals },
    { what: 'Fact-checked', how: 'Gemini + Google Search, focus deals', n: f.verified, ai: true },
  ].filter((s) => s.n != null);
  const top = Math.log10(Math.max(10, f.raw));
  return (
    <section className="card" id="method">
      <div className="card-title">
        <h2><SecIcon d={I.gear} tone="var(--t-gray)" />How this brief was made</h2>
        <span className="hint">This run, step by step</span>
      </div>
      <div className="funnel">
        {steps.map((s) => (
          <div className={`step${s.ai ? ' ai' : ''}`} key={s.what}>
            <div className="what"><strong>{s.what}</strong><span>{s.how}</span></div>
            <div className="track"><div className="fill" style={{ width: `${Math.max(3, (Math.log10(Math.max(1, s.n)) / top) * 100)}%` }} /></div>
            <div className="n num">{s.n}</div>
          </div>
        ))}
      </div>
      {v && (
        <p className="note">
          Fact-check this run: {v.checked} focus deals checked → {v.verified} verified, {v.mismatch} where other sources report a
          different amount, {v.unconfirmed} not found online.
          {v.quota_reached && ` The free Google Search allowance ran out, so ${v.skipped} deals will be checked on the next run.`}{' '}
          Gemini only fills fields the news left blank; it never overwrites them. Bars use a log scale. Purple steps use AI; teal
          steps are plain code.
        </p>
      )}
      <div className="stack-badges">
        <span className="pill">Gemini Flash · extraction, fact-check, writing</span>
        <span className="pill">Code · filtering, matching, stats, trends</span>
        <span className="pill">Neon Postgres · history</span>
        <span className="pill">Vercel cron · Mon 06:00 IST</span>
      </div>
    </section>
  );
}

// ---------- page ----------

export default function BriefDashboard({ brief, config, issue }) {
  const data = brief.data;
  const s = data.stats;
  const c = data.counts;
  const alerts = data.watch.length + data.adjacency.length;
  const allDeals = [...data.focus, ...data.sector_only, ...data.other];
  const colorOf = sectorColors(config?.sectors || [], [...allDeals.map((d) => d.sector), ...s.by_sector.map((r) => r.sector)]);
  const hist = s.history || [];
  const sources = c.rss_feeds + c.google_news_queries + (c.gdelt_ok !== undefined ? 1 : 0);
  const avg = s.overall_4wk_avg;
  const dealsDelta = avg?.avg_deals ? Math.round(((s.total_deals - avg.avg_deals) / avg.avg_deals) * 100) : null;
  const verifiedCount = allDeals.filter((d) => d.verify_status === 'verified').length;
  const fx = data.fx;

  const toc = [
    ['overview', 'Overview'],
    ['alerts', 'Alerts', alerts],
    ['patterns', 'Patterns', data.patterns.length],
    ['trends', 'Momentum'],
    ['investors', 'Investor moves'],
    ['focus', 'Focus deals', data.focus.length + data.sector_only.length],
    ['other', 'Everything else', data.other.length],
    ['method', 'How it was made'],
  ];

  return (
    <main className="page">
      <div className="brief-layout">
        <nav className="toc" aria-label="Sections">
          <div className="toc-title">In this issue</div>
          {toc.map(([id, label, count]) => (
            <a key={id} href={`#${id}`}>
              {label} {count != null && <span className="count">{count}</span>}
            </a>
          ))}
          <div className="toc-foot">
            Prepared for Aarav every Monday, 6:00 AM IST. Sectors, stages and watchlist live in <a href="/config">Config</a>.
          </div>
        </nav>

        <div>
          <header className="masthead rise" id="overview">
            <div className="issue-row">
              <span><strong>Issue {issue || '—'}</strong> · Week of {weekRange(data.week_start)}</span>
              <span>Prepared for Aarav · Bengaluru</span>
            </div>
            <h1>Where Indian startup capital <em>moved</em> last week</h1>
            {data.summary && <p className="summary">{data.summary}</p>}
            <div className="meta">
              <span>Generated {istDateTime(brief.created_at)} IST</span>
              <span className={`pill ${c.sources_failed ? 'warn' : ''}`}><span className="dot" /> {sources} sources · {c.sources_failed} failed</span>
              {verifiedCount > 0 && <span className="pill">✓ {verifiedCount} deals fact-checked</span>}
              {fx && <span className="pill">₹{fx.rate} = $1{fx.date ? ` · ${fx.date}` : ''}</span>}
            </div>
          </header>

          <div className="stats rise-2">
            <Stat
              tone="var(--t-blue)" icon={I.deals} label="Deals tracked" value={s.total_deals}
              delta={dealsDelta != null ? { dir: dealsDelta >= 0 ? 'up' : 'down', text: `${dealsDelta >= 0 ? '▲' : '▼'} ${Math.abs(dealsDelta)}%` } : null}
              sub={avg ? `vs ${avg.avg_deals}/wk avg` : `${s.disclosed_deals} disclosed`}
              spark={hist.map((h) => h.deals)}
            />
            <Stat
              tone="var(--t-green)" icon={I.money} label="Disclosed capital" value={usd(s.total_disclosed_usd_m) || '$0'}
              sub={`${s.disclosed_deals} of ${s.total_deals} amounts disclosed`}
              spark={hist.map((h) => h.usd_m)}
            />
            <Stat tone="var(--t-violet)" icon={I.target} label="In your focus" value={data.focus.length} sub={`+${data.sector_only.length} in your sectors at other stages`} />
            <Stat tone={alerts ? 'var(--t-amber)' : 'var(--t-gray)'} icon={I.bell} label="Alerts" value={alerts} sub="Watchlist + portfolio" alert={alerts > 0} />
          </div>

          <Alerts data={data} config={config} total={allDeals.length} />

          <div className="grid-2">
            <section className="card" id="patterns">
              <div className="card-title">
                <h2><SecIcon d={I.spark} tone="var(--t-violet)" />Patterns</h2>
                <span className="hint">Gemini, from code-computed counts</span>
              </div>
              {data.patterns.length ? (
                <ol className="patterns">{data.patterns.map((p, i) => <li key={i}>{p}</li>)}</ol>
              ) : (
                <p className="muted">Not enough deals this week to describe patterns.</p>
              )}
            </section>

            <section className="card">
              <div className="card-title">
                <h2><SecIcon d={I.chart} tone="var(--t-blue)" />Where the money went</h2>
                <span className="hint">Deals · disclosed $</span>
              </div>
              <DistributionBars rows={s.by_sector} keyName="sector" focus={config?.sectors || []} toneOf={colorOf} />
              <div className="chart-sub">By stage</div>
              <DistributionBars rows={sortStages(s.by_stage)} keyName="stage" focus={config?.stages || []} toneOf={stageColor} />
              <div className="legend">
                <span><strong style={{ color: 'var(--text)' }}>Bold</strong> = in your focus</span>
                <span>Stages shade light → dark, early → late</span>
              </div>
            </section>
          </div>

          <div className="grid-2">
            <Trends stats={s} colorOf={colorOf} />
            <Investors inv={data.investors} />
          </div>

          <section className="card" id="focus">
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
            <section className="card" id="other">
              <details className="more">
                <summary>
                  <div className="card-title" style={{ margin: 0 }}>
                    <h2><SecIcon d={I.list} tone="var(--t-gray)" />Everything else <span className="pill">{data.other.length}</span></h2>
                  </div>
                  <Chevron />
                </summary>
                <DealTable deals={data.other} colorOf={colorOf} />
              </details>
            </section>
          )}

          <Method data={data} />

          <section className="coverage">
            <div><strong>Coverage.</strong> {data.coverage}</div>
            <div>
              Every deal links to its source. Amounts are as reported; rupee amounts are converted at ₹{data.inr_per_usd}/USD
              {fx?.source ? ` (${fx.source}${fx.date ? `, ${fx.date}` : ''})` : ''}.
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
