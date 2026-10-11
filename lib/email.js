import { Resend } from 'resend';
import { marked } from 'marked';

export function briefHtml(contentMd) {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:680px;margin:0 auto;color:#1a1a1a;line-height:1.5">${marked.parse(contentMd)}</div>`;
}

// Step 6: deliver to Aarav only. BRIEF_TO_EMAIL is the single recipient.
export async function sendBriefEmail({ weekStart, contentMd }) {
  if (!process.env.RESEND_API_KEY || !process.env.BRIEF_TO_EMAIL) {
    return { sent: false, error: 'RESEND_API_KEY or BRIEF_TO_EMAIL not set' };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: 'Funding Pulse <onboarding@resend.dev>',
    to: [process.env.BRIEF_TO_EMAIL],
    subject: `Funding Pulse · week of ${weekStart}`,
    html: briefHtml(contentMd),
    text: contentMd,
  });
  return error ? { sent: false, error: error.message } : { sent: true, id: data?.id };
}
