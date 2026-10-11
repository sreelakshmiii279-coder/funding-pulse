import { createHash } from 'node:crypto';
import { query } from '@/lib/db';
import { isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Telegram sends this header on every webhook call when setWebhook is given a
// secret_token, so random requests to /api/telegram are rejected.
function webhookSecret() {
  return createHash('sha256').update(`telegram:${process.env.TELEGRAM_BOT_TOKEN}`).digest('hex');
}

async function reply(chatId, text) {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

// Text of a message plus any hidden links (text_link entities) and the
// original author of a forwarded post.
function messageText(msg) {
  const body = msg.text || msg.caption || '';
  const entities = msg.entities || msg.caption_entities || [];
  const links = entities.filter((e) => e.type === 'text_link').map((e) => e.url);
  const o = msg.forward_origin;
  const from = o && (o.sender_user?.first_name || o.sender_user_name || o.chat?.title || o.sender_chat?.title);
  return [from ? `Forwarded from ${from}:` : null, body, ...links].filter(Boolean).join('\n').trim();
}

const START_TEXT =
  'Funding Pulse bot.\n\n' +
  'Forward me any funding post you see on LinkedIn or X (or paste the text/link). ' +
  "I'll save it and Monday's brief will extract the deal from it.\n\n" +
  '/status - how many forwards are waiting for the next brief';

export async function POST(request) {
  if (request.headers.get('x-telegram-bot-api-secret-token') !== webhookSecret()) {
    return new Response('forbidden', { status: 403 });
  }
  const update = await request.json();
  const msg = update.message || update.edited_message;
  if (!msg) return Response.json({ ok: true });

  const chatId = String(msg.chat.id);
  const allowed = process.env.TELEGRAM_ALLOWED_CHAT_ID;
  if (!allowed) {
    // Setup helper: tell the owner their chat ID; store nothing.
    await reply(chatId, `Bot not configured yet. Your chat ID is ${chatId}. Set TELEGRAM_ALLOWED_CHAT_ID to it.`);
    return Response.json({ ok: true });
  }
  if (chatId !== allowed) return Response.json({ ok: true }); // ignore everyone else silently

  const text = messageText(msg);
  if (text === '/start' || text.startsWith('/start ') || text === '/help') {
    await reply(chatId, START_TEXT);
  } else if (text.startsWith('/status')) {
    const [{ n }] = await query('SELECT count(*)::int AS n FROM manual_submissions WHERE processed = false');
    await reply(chatId, `${n} forwarded post${n === 1 ? '' : 's'} waiting for Monday's brief.`);
  } else if (text) {
    await query('INSERT INTO manual_submissions (text) VALUES ($1)', [text.slice(0, 8000)]);
    await reply(chatId, "Saved for Monday's brief.");
  } else {
    await reply(chatId, 'Please send text or a link.');
  }
  return Response.json({ ok: true });
}

// GET /api/telegram?setup=1 (admin only): registers this deployment's URL as
// the bot webhook with the secret token, so no manual setWebhook call is needed.
export async function GET(request) {
  if (!(await isAdmin())) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const url = new URL(request.url);
  const api = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
  if (url.searchParams.get('setup') === '1') {
    const res = await fetch(`${api}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${url.origin}/api/telegram`,
        secret_token: webhookSecret(),
        allowed_updates: ['message', 'edited_message'],
      }),
    });
    return Response.json(await res.json());
  }
  const res = await fetch(`${api}/getWebhookInfo`);
  return Response.json(await res.json());
}
