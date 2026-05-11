/**
 * AIEmailComposer
 * ---------------
 * Turns a user-profile + a list of recommended items into:
 *   - subject line          (8-12 words, personalised)
 *   - intro paragraph       (2 short sentences, friendly tone)
 *   - per-item reason       ("Because you saved a wireless mouse last week")
 *   - CTA copy              (button text, e.g. "See all picks")
 *
 * Provider: Groq (reuses config.groq.apiKeys + config.groq.model — same plumbing
 * as ChatbotService and ListingAssistService so no new env vars are needed).
 *
 * Falls back to deterministic templates if Groq is unavailable. The fallback
 * still personalises using the user's most-searched keyword and top category,
 * so degraded emails don't feel generic.
 */

const config = require('../config');

const SYSTEM_PROMPT = `You are the marketing copywriter for CommuneX, a campus marketplace.
Your job is to write a SHORT, friendly, modern recommendation email for one specific student.

Rules:
- The student's first name and behavioural signals are provided.
- Write naturally, like a human, not a marketing bot. No exclamation-mark spam.
- Reasons must reference the student's actual behaviour ("Because you searched for X last week").
- Subjects should feel like a Spotify or Airbnb email — warm, curious, specific.
- Output ONLY a single JSON object. No markdown fences. No commentary.

Required JSON shape:
{
  "subject":  "<8 to 12 word subject line>",
  "preheader": "<short 1-line teaser visible in inbox preview>",
  "intro":    "<2 short sentences that greet the user and tease the picks>",
  "ctaLabel": "<2-3 word button label, e.g. 'See your picks'>",
  "reasons":  [
    "<reason for item 1, max 14 words>",
    "<reason for item 2, max 14 words>",
    "..."
  ]
}`;

const buildUserBrief = ({ profile, items, campaignType }) => {
  const lines = [];
  lines.push(`Campaign type: ${campaignType}`);
  lines.push(`Student first name: ${profile.firstName || 'there'}`);
  if (profile.topCategory) lines.push(`Most-viewed category: ${profile.topCategory}`);
  if (profile.mostSearchedQuery) lines.push(`Most recent search: "${profile.mostSearchedQuery}"`);
  if (profile.topKeywords?.length) {
    lines.push(`Top search keywords: ${profile.topKeywords.slice(0, 5).map((k) => k.keyword).join(', ')}`);
  }
  if (profile.savedTags?.length) {
    lines.push(`Recently saved tags: ${profile.savedTags.slice(0, 6).join(', ')}`);
  }
  if (profile.unmetSearches?.length) {
    lines.push(`Searches that returned NO results: ${profile.unmetSearches.join(', ')}`);
  }
  lines.push('');
  lines.push('Items being recommended (in display order):');
  items.forEach((item, idx) => {
    const tags = (item.tags || []).slice(0, 4).join(', ');
    lines.push(`  ${idx + 1}. "${item.title}" — category: ${item.category}, ₹${item.price}, tags: [${tags}]`);
  });
  return lines.join('\n');
};

const parseJsonLoose = (text) => {
  if (!text) return null;
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  }
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

const callGroq = async (userBrief) => {
  const keys = config.groq.apiKeys || [];
  if (!keys.length || typeof fetch !== 'function') return null;

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userBrief },
  ];

  for (const key of keys) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.groq.model,
          messages,
          temperature: 0.7,
          max_tokens: 600,
          response_format: { type: 'json_object' },
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      const parsed = parseJsonLoose(text);
      if (parsed?.subject) return parsed;
    } catch (_) {
      continue;
    }
  }
  return null;
};

/* Deterministic fallback so the agent never blocks on AI downtime. */
const buildFallback = ({ profile, items, campaignType }) => {
  const name = profile?.firstName || 'there';
  const topic = profile?.mostSearchedQuery || profile?.topCategory || 'your interests';

  const subjectByCampaign = {
    'daily-digest': `${name}, fresh ${profile?.topCategory || 'campus'} picks for you`,
    'new-match-alert': `${name}, a new "${topic}" listing just went live`,
    're-engagement': `We've missed you, ${name} — see what's new on CommuneX`,
    'price-drop': `${name}, a price drop on something you viewed`,
  };

  return {
    subject: subjectByCampaign[campaignType] || `Recommended for you on CommuneX`,
    preheader: `Hand-picked items based on your recent activity`,
    intro: `Hey ${name}, we noticed you've been exploring ${topic}. Here are a few items that match what you've been looking at.`,
    ctaLabel: 'See your picks',
    reasons: items.map((item) => {
      const tag = (item.tags || [])[0];
      if (tag && profile?.savedTags?.includes(tag)) {
        return `Because you saved items tagged "${tag}"`;
      }
      if (item.category && item.category === profile?.topCategory) {
        return `Matches the ${item.category} items you've been browsing`;
      }
      return `Picked from new ${item.category || 'campus'} listings`;
    }),
  };
};

class AIEmailComposer {
  /**
   * compose({ profile, items, campaignType })
   *
   * Returns:
   *   {
   *     subject, preheader, intro, ctaLabel, reasons: string[],
   *     provider: 'groq' | 'fallback'
   *   }
   */
  static async compose({ profile, items, campaignType = 'daily-digest' }) {
    if (!profile || !items?.length) {
      return { ...buildFallback({ profile, items: items || [], campaignType }), provider: 'fallback' };
    }

    const brief = buildUserBrief({ profile, items, campaignType });
    const aiResult = await callGroq(brief);

    if (aiResult && Array.isArray(aiResult.reasons) && aiResult.reasons.length === items.length) {
      return {
        subject: String(aiResult.subject || '').slice(0, 140),
        preheader: String(aiResult.preheader || '').slice(0, 160),
        intro: String(aiResult.intro || '').slice(0, 600),
        ctaLabel: String(aiResult.ctaLabel || 'See your picks').slice(0, 30),
        reasons: aiResult.reasons.map((r) => String(r).slice(0, 140)),
        provider: 'groq',
      };
    }

    /* AI returned wrong shape or fewer reasons than items — fall back. */
    return { ...buildFallback({ profile, items, campaignType }), provider: 'fallback' };
  }
}

module.exports = AIEmailComposer;
