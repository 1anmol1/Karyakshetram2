import { config } from '../config/index.js';
import { inr, pct, round } from '../utils/index.js';

const GEMINI_API_KEY = config.geminiApiKey || process.env.GEMINI_API_KEY || '';
const MODELS = ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];

/**
 * Call Google Gemini API directly with resilience across models
 */
export async function callGemini(prompt, systemInstruction = '', maxTokens = 2048) {
  if (!GEMINI_API_KEY) return null;

  for (const model of MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 9500);

      const res = await fetch(url, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          generationConfig: {
            temperature: 0.25,
            maxOutputTokens: maxTokens,
          },
        }),
      });
      clearTimeout(timeout);

      if (!res.ok) {
        console.warn(`[Gemini API] Model ${model} returned status ${res.status}`);
        continue;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && text.trim()) {
        return text.trim();
      }
    } catch (err) {
      console.warn(`[Gemini API] Request to ${model} failed:`, err.message || err);
    }
  }

  return null;
}

/**
 * Generate a precise, grounded executive summary for a retail site
 */
export async function generateGeminiSummary(site, cann, fallback) {
  if (!GEMINI_API_KEY) return fallback;

  const systemInstruction = `You are Karyakshetram's AI Commercial Retail Expansion Strategist for Pune & PCMC, Maharashtra.
Your task is to write a crisp, articulate, high-impact executive summary (2-3 sentences, maximum 85 words) analyzing the commercial viability of a selected retail location.
Ground your response strictly in the provided data (viability tier, expected profit, downside P10, rent headroom, catchment households, competitor count, stress tests, and cannibalisation).
Highlight why this site is chosen, its financial upside vs downside risk, and competitive positioning. Do not add generic fluff. Never mention raw spatial cell hashes or cell IDs (e.g. 8860...); refer to the location strictly by its locality name.`;

  const households = site.catchment?.households ? site.catchment.households.toLocaleString('en-IN') : 'N/A';
  const popChange = site.popChange != null ? pct(site.popChange) : 'N/A';
  const competitors = site.catchment?.competitors ?? 0;
  const nearestComp = Number.isFinite(site.catchment?.nearestCompetitorKm) ? `${round(site.catchment.nearestCompetitorKm, 1)} km` : 'none nearby';
  const cannText = cann && cann.takenRs ? `Cannibalisation: Takes ${inr(cann.takenRs)}/yr from ${cann.affected || 1} own store(s), net network profit ${inr(cann.netNetworkProfit)}.` : 'No cannibalisation against own store network.';

  const prompt = `Location: ${site.locality || 'Selected site'}
Category: ${site.category || 'Retail'}
Viability Tier: Tier ${site.tier} (${site.confidence} confidence)
Expected Annual Profit: ${inr(site.profit?.exp)}
Downside (P10) Annual Profit: ${inr(site.profit?.p10)}
Expected Annual Revenue: P50 ${inr(site.revenue?.p50)} (P10: ${inr(site.revenue?.p10)}, P90: ${inr(site.revenue?.p90)})
Assumed Monthly Rent: ₹${Math.round(site.rent || 0)}/sq ft
Break-even Monthly Rent: ₹${Math.round(site.breakevenRent || 0)}/sq ft
Catchment Demographics: ${households} households within ${site.catchment?.km || 1.5} km, 5-year pop growth: ${popChange}
Competition & Anchors: ${competitors} direct competitors (nearest: ${nearestComp}), ${Math.round(site.catchment?.anchors || 0)} complementary anchors
Stress Test Resilience: Passes ${site.stress?.passes ?? 4} of 4 stress tests (rent +25%, competitor entry, margin dip, demand shock)
${cannText}

Write the executive site summary now:`;

  const result = await callGemini(prompt, systemInstruction, 1500);
  if (result) {
    const clean = result
      .replace(/\(?\bCell\s+8[0-9a-f]{14}\b\)?/gi, '')
      .replace(/\(Cell\s*8[0-9a-f]{14}\)/gi, '')
      .replace(/\b8[0-9a-f]{14}\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return {
      narrative: clean,
      claims: fallback.claims || [],
      narrative_source: 'gemini',
    };
  }

  return fallback;
}

/**
 * Generate intelligent, precise answers for the Chatbot
 */
export async function generateGeminiChat(message, category, sites, fallbackAnswer) {
  if (!GEMINI_API_KEY) return { answer: fallbackAnswer, narrative_source: 'template' };

  const systemInstruction = `You are Karyakshetram's AI Expansion Copilot, an expert commercial retail expansion consultant and site-selection strategist specializing in Pune and PCMC (Maharashtra, India).
Answer the user's question directly, insightfully, and concisely (2 to 4 sentences).
Rules:
1. Ground your answers firmly in the provided site metrics (expected annual profit, downside P10, quoted rent vs break-even rent, catchment households, competitor count, stress test results).
2. If asked about rent, mention the assumed rent and break-even rent threshold.
3. If asked about safety/risk, cite the downside (P10) profit and number of stress tests passed.
4. If asked about cannibalisation, explain the impact on existing stores.
5. If asked to compare or rank, provide a clear commercial rationale with numbers.
6. Tone: Authoritative, data-backed, business-focused, and encouraging. Never invent ungrounded data. Never mention raw spatial cell hashes or cell IDs (e.g. 8860...); refer to sites by name.`;

  const sitesContext = sites.map((s, idx) => {
    const site = s.site || s;
    const cann = s.cann;
    const households = site.catchment?.households ? site.catchment.households.toLocaleString('en-IN') : 'N/A';
    const nearest = Number.isFinite(site.catchment?.nearestCompetitorKm) ? `${round(site.catchment.nearestCompetitorKm, 1)} km` : 'none';
    return `[Site ${idx + 1}] ${site.locality || 'Site'}:
- Category: ${site.category || category}
- Tier: Tier ${site.tier} (${site.confidence} confidence)
- Annual Profit: Expected ${inr(site.profit?.exp)} | Downside P10 ${inr(site.profit?.p10)}
- Rent: Assumed ₹${Math.round(site.rent || 0)}/sq ft | Break-even ₹${Math.round(site.breakevenRent || 0)}/sq ft
- Catchment: ${households} households, 5-yr growth ${pct(site.popChange || 0)}, ${site.catchment?.competitors || 0} competitors (nearest: ${nearest})
- Stress Tests: Passes ${site.stress?.passes ?? 4} of 4 tests
- Cannibalisation: ${cann ? `${inr(cann.takenRs)} taken, net profit ${inr(cann.netNetworkProfit)}` : 'None'}`;
  }).join('\n\n');

  const prompt = `Retail Category: ${category}
Available Sites Context:
${sitesContext}

User Question: "${message}"

Your expert response:`;

  const result = await callGemini(prompt, systemInstruction, 1500);
  if (result) {
    const clean = result
      .replace(/\(?\bCell\s+8[0-9a-f]{14}\b\)?/gi, '')
      .replace(/\(Cell\s*8[0-9a-f]{14}\)/gi, '')
      .replace(/\b8[0-9a-f]{14}\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return {
      answer: clean,
      narrative_source: 'gemini',
    };
  }

  return {
    answer: fallbackAnswer,
    narrative_source: 'template',
  };
}
