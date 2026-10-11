import { marked } from 'marked';

// Brief markdown comes from our own code (deal lines, links) and Gemini
// (prose). Raw HTML is escaped and only http(s) links are rendered.
const renderer = new marked.Renderer();
renderer.html = ({ text }) => text.replace(/</g, '&lt;');
renderer.link = function ({ href, tokens }) {
  const text = this.parser.parseInline(tokens);
  return /^https?:\/\//.test(href)
    ? `<a href="${href.replace(/"/g, '%22')}" target="_blank" rel="noopener noreferrer">${text}</a>`
    : text;
};

export default function BriefView({ brief }) {
  const html = marked.parse(brief.content_md, { renderer });
  const created = new Date(brief.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  return (
    <article className="card brief">
      <div className="meta">
        <span className="pill">Week of {new Date(brief.week_start).toISOString().slice(0, 10)}</span>
        <span className="pill">{brief.deals_count} deals</span>
        <span className="pill">
          {brief.sources_scanned} sources · {brief.sources_failed} failed
        </span>
        <span className="muted" style={{ fontSize: 14, alignSelf: 'center' }}>Generated {created} IST</span>
      </div>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
