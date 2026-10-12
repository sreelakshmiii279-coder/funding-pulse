import { GoogleGenAI } from '@google/genai';

// Every AI call in this project goes through here, and only to Gemini Flash.
// The model ID comes from GEMINI_MODEL so it can be updated from AI Studio.
let ai;

function client() {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
  if (!process.env.GEMINI_MODEL) throw new Error('GEMINI_MODEL is not set');
  // 60 s per request: one stuck call must not eat the whole function budget.
  if (!ai) ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 60000 } });
  return ai;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Structured call: forces JSON output matching `schema` and returns the parsed object.
// Retries rate-limit / transient errors with backoff (free tier has low RPM).
export async function generateJson({ system, prompt, schema, temperature = 0 }) {
  return withRetry(async () => {
    const res = await client().models.generateContent({
      model: process.env.GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: system,
        temperature,
        responseMimeType: 'application/json',
        responseJsonSchema: schema,
      },
    });
    return JSON.parse(res.text);
  });
}

// Free-text call (used by the brief writer, which returns markdown).
export async function generateText({ system, prompt, temperature = 0.2 }) {
  return withRetry(async () => {
    const res = await client().models.generateContent({
      model: process.env.GEMINI_MODEL,
      contents: prompt,
      config: { systemInstruction: system, temperature },
    });
    return res.text || '';
  });
}

async function withRetry(fn, attempts = 4) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const status = err.status || err.code;
      // Rate limits, server errors, truncated JSON, and dropped connections
      // ("fetch failed") are all worth another try.
      const network = /fetch failed|ECONNRESET|ETIMEDOUT|socket hang up/i.test(`${err.message} ${err.cause?.code || ''}`);
      const retryable = status === 429 || status >= 500 || err instanceof SyntaxError || network;
      if (!retryable || i >= attempts) throw err;
      const wait = 2000 * 2 ** (i - 1);
      console.warn(`[gemini] attempt ${i} failed (${status || err.message}); retrying in ${wait}ms`);
      await sleep(wait);
    }
  }
}

// Run async tasks with limited concurrency (keeps us under Gemini's free-tier RPM).
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
