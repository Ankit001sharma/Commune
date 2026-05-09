/**
 * ListingAssistService
 * --------------------
 * Two pieces of intelligence for the "Create Listing" flow:
 *
 *   1) analyseImage(imageBuffer, mimetype)
 *      Sends the image to Groq's vision-capable Llama model and asks it to
 *      return a structured JSON: { title, description, category, condition, keywords }.
 *      Falls back to a deterministic heuristic if no API key is set.
 *
 *   2) suggestPrice({ category, condition, title })
 *      Looks at past Listing + Transaction history for the same category to
 *      recommend a price that maximises sale probability.
 *      Returns: { suggested, min, max, sampleSize, rationale }.
 */

const Listing = require('../models/Listing');
const Transaction = require('../models/Transaction');
const config = require('../config');

const VALID_CATEGORIES = [
  'books', 'electronics', 'furniture', 'clothing', 'stationery',
  'sports', 'vehicles', 'food', 'accessories', 'other',
];
const VALID_CONDITIONS = ['new', 'like-new', 'good', 'fair', 'poor'];

/* Groq vision-capable models (try in order — provider rotates them). */
const VISION_MODELS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'llama-3.2-90b-vision-preview',
  'llama-3.2-11b-vision-preview',
];

/* Condition price multipliers, relative to "good". */
const CONDITION_MULT = {
  new: 1.45,
  'like-new': 1.2,
  good: 1.0,
  fair: 0.75,
  poor: 0.5,
};

/* ------------------------------------------------------------------ */
/* Image analysis (Groq Vision)                                         */
/* ------------------------------------------------------------------ */
const PROMPT = `You are an assistant inside a campus marketplace app called CommuneX.
A student just uploaded a photo of an item they want to sell.

Analyse the photo and reply with ONLY a single JSON object — no commentary, no markdown fences — with these exact keys:

{
  "title": "<3 to 8 word product title, like a craigslist headline>",
  "description": "<60 to 120 word friendly description highlighting brand if visible, condition cues from the photo, key features, and likely use cases>",
  "category": "<one of: books | electronics | furniture | clothing | stationery | sports | vehicles | food | accessories | other>",
  "condition": "<one of: new | like-new | good | fair | poor — inferred from visible wear>",
  "keywords": ["<3-6 short tag keywords>"]
}

Rules:
- Pick the category that best matches the dominant object in the photo.
- If multiple items appear, focus on the most prominent.
- Be honest about wear: scratches/scuffs => 'good' or 'fair'; pristine => 'like-new' or 'new'.
- Output ONLY the JSON object. No preamble.`;

const callGroqVision = async (base64DataUrl) => {
  const keys = config.groq.apiKeys || [];
  if (!keys.length || typeof fetch !== 'function') return null;

  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: PROMPT },
        { type: 'image_url', image_url: { url: base64DataUrl } },
      ],
    },
  ];

  for (const model of VISION_MODELS) {
    for (const key of keys) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.4,
            max_tokens: 600,
            response_format: { type: 'json_object' },
          }),
        });
        if (!res.ok) {
          // Some models don't support response_format — retry without it.
          const retry = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: 600 }),
          });
          if (!retry.ok) continue;
          const data = await retry.json();
          const text = data.choices?.[0]?.message?.content?.trim();
          const parsed = parseJsonLoose(text);
          if (parsed) return { ...parsed, modelUsed: model };
          continue;
        }
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        const parsed = parseJsonLoose(text);
        if (parsed) return { ...parsed, modelUsed: model };
      } catch (_) {
        continue;
      }
    }
  }
  return null;
};

/* Strip ```json fences if Groq returns them and JSON.parse safely. */
const parseJsonLoose = (text) => {
  if (!text) return null;
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  }
  // Sometimes models prepend "Here is the JSON:" — find first `{` to last `}`.
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    return null;
  }
};

/* Sanitise model output into our schema. */
const normaliseSuggestion = (raw) => {
  if (!raw) return null;
  const title = String(raw.title || '').slice(0, 100).trim();
  const description = String(raw.description || '').slice(0, 1500).trim();
  let category = String(raw.category || 'other').toLowerCase();
  if (!VALID_CATEGORIES.includes(category)) category = 'other';
  let condition = String(raw.condition || 'good').toLowerCase();
  if (!VALID_CONDITIONS.includes(condition)) condition = 'good';
  const keywords = Array.isArray(raw.keywords)
    ? raw.keywords.map((k) => String(k).toLowerCase().trim()).filter(Boolean).slice(0, 8)
    : [];
  return { title, description, category, condition, keywords, modelUsed: raw.modelUsed || null };
};

/* Heuristic fallback so the page still works without an API key. */
const heuristicSuggestion = () => ({
  title: 'Used Item In Good Condition',
  description:
    'A pre-owned item in working order. Add details such as the brand, model, age, included accessories, and any cosmetic wear so buyers know exactly what to expect. Mention why you are selling and whether you can deliver on campus.',
  category: 'other',
  condition: 'good',
  keywords: ['pre-owned', 'campus'],
  modelUsed: 'heuristic-fallback',
});

exports.analyseImage = async (buffer, mimetype = 'image/jpeg') => {
  if (!buffer || !buffer.length) return heuristicSuggestion();
  // Cap at 4 MB before encoding — Groq has request size limits.
  const safe = buffer.length > 4 * 1024 * 1024 ? buffer.slice(0, 4 * 1024 * 1024) : buffer;
  const dataUrl = `data:${mimetype};base64,${safe.toString('base64')}`;
  const parsed = await callGroqVision(dataUrl);
  return normaliseSuggestion(parsed) || heuristicSuggestion();
};

/* ------------------------------------------------------------------ */
/* Smart price suggestion                                               */
/* ------------------------------------------------------------------ */
const median = (arr) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const percentile = (arr, p) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx];
};

const niceRound = (n) => {
  if (!n) return 0;
  if (n < 100) return Math.round(n / 5) * 5;
  if (n < 1000) return Math.round(n / 10) * 10;
  if (n < 10000) return Math.round(n / 50) * 50;
  return Math.round(n / 100) * 100;
};

/* Tokenise title text for fuzzy similarity. */
const tokens = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

exports.suggestPrice = async ({ category = 'other', condition = 'good', title = '' }) => {
  const titleTokens = tokens(title);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  /* 1. Sold transactions — strongest signal. */
  const soldTx = await Transaction.find({
    status: 'completed',
    listing: { $ne: null },
    createdAt: { $gte: ninetyDaysAgo },
  })
    .populate({ path: 'listing', match: { category }, select: 'category title price' })
    .limit(200);
  const soldPrices = soldTx
    .filter((t) => t.listing && t.amount > 0)
    .map((t) => t.amount);

  /* 2. Active and sold listings in the same category — broader signal. */
  const recent = await Listing.find({
    category,
    status: { $in: ['active', 'sold', 'reserved'] },
    createdAt: { $gte: ninetyDaysAgo },
    price: { $gt: 0 },
  })
    .select('title price status')
    .limit(300);

  /* 3. Score each by token overlap with the proposed title. */
  const scored = recent.map((l) => {
    const lt = tokens(l.title);
    const overlap = titleTokens.filter((t) => lt.includes(t)).length;
    return { price: l.price, status: l.status, score: overlap };
  });

  const exactMatches = scored.filter((s) => s.score >= 2).map((s) => s.price);
  const looseMatches = scored.filter((s) => s.score >= 1).map((s) => s.price);
  const allCategory = scored.map((s) => s.price);

  let basis;
  let label;

  if (soldPrices.length >= 3) {
    basis = soldPrices;
    label = `${soldPrices.length} recent sales in ${category}`;
  } else if (exactMatches.length >= 3) {
    basis = exactMatches;
    label = `${exactMatches.length} similar ${category} listings`;
  } else if (looseMatches.length >= 3) {
    basis = looseMatches;
    label = `${looseMatches.length} ${category} listings with related keywords`;
  } else if (allCategory.length >= 1) {
    basis = allCategory;
    label = `${allCategory.length} ${category} listings`;
  } else {
    return {
      suggested: 0,
      min: 0,
      max: 0,
      sampleSize: 0,
      rationale: `Not enough ${category} history yet — set a price you're comfortable with.`,
      confidence: 'low',
    };
  }

  const med = median(basis);
  const p25 = percentile(basis, 25);
  const p75 = percentile(basis, 75);

  const mult = CONDITION_MULT[condition] ?? 1;
  const suggested = niceRound(med * mult);
  const min = niceRound(p25 * mult * 0.95);
  const max = niceRound(p75 * mult * 1.05);

  const confidence = basis.length >= 10 ? 'high' : basis.length >= 4 ? 'medium' : 'low';

  return {
    suggested,
    min: Math.max(0, min),
    max: Math.max(suggested, max),
    sampleSize: basis.length,
    rationale: `Based on ${label} (median ₹${niceRound(med)}, condition multiplier ${mult.toFixed(2)} for ${condition}).`,
    confidence,
  };
};
