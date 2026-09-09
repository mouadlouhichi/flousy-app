/**
 * Optional "deep search" knowledge slot for food-label analysis.
 *
 * When the LOCAL food-knowledge base cannot recognise an ingredient name, the
 * analyze route may ask a provider-agnostic, OpenAI-compatible chat-completions
 * endpoint (DeepSeek, OpenAI, a self-hosted gateway, …) for a short neutral
 * explanation of that name. It is enabled ONLY when KNOWLEDGE_API_URL and
 * KNOWLEDGE_API_KEY are both set — otherwise this module is a pure no-op with
 * zero network. Everything is bounded and fail-open:
 *
 *   - 4 s timeout, ≤ 40 names per call, summary ≤ 400 chars;
 *   - answers are only ever INFORMATIONAL (attributed to the provider, clearly
 *     flagged "external, not locally verified") — they never change the local
 *     analysis, never add an allergen or an additive, never produce a verdict;
 *   - any HTTP/network/parse error returns an empty map and the route falls
 *     back to the exact pure-local result.
 *
 * The endpoint receives ONLY the unknown ingredient names (never the whole
 * label, never user data), matching the app's privacy stance.
 */

import { MAX_INGREDIENT_TEXT_LENGTH } from '@/lib/ingredient-safety/types';

type EnvVarMap = Record<string, string | undefined>;

const KNOWLEDGE_TIMEOUT_MS = 4_000;
const MAX_NAMES = 40;
const MAX_NAME_LENGTH = 500;
const MAX_SUMMARY = 400;
const MAX_WRAPPED_JSON_LENGTH = 32_000;

export function knowledgeConfig(env: EnvVarMap = process.env): {
  url: string;
  key: string;
  model: string;
} | null {
  const url = env.KNOWLEDGE_API_URL?.trim();
  const key = env.KNOWLEDGE_API_KEY?.trim();
  if (!url || !key) return null;
  return { url: url.replace(/\/+$/, ''), key, model: env.KNOWLEDGE_API_MODEL?.trim() || 'gpt-4o-mini' };
}

export function isKnowledgeConfigured(env: EnvVarMap = process.env): boolean {
  return knowledgeConfig(env) !== null;
}

export interface KnowledgeAnswer {
  /** Exact requested name the answer refers to. */
  name: string;
  summary: string;
}

type KnowledgeFetchImpl = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

const defaultFetch: KnowledgeFetchImpl = (url, init) =>
  fetch(url, init as RequestInit) as Promise<{ ok: boolean; json: () => Promise<unknown> }>;

/** Parse `{ "ingredients": [{ "name": … , "summary": … }] }` defensively. */
export function parseKnowledgeBody(body: unknown, requested: readonly string[]): KnowledgeAnswer[] {
  if (!body || typeof body !== 'object') return [];
  const root = body as { ingredients?: unknown; choices?: unknown[] };
  const raw = Array.isArray(root.ingredients) ? root.ingredients : undefined;
  if (!raw) {
    // Some OpenAI-compatible endpoints wrap JSON in choices[0].message.content.
    const choices = Array.isArray(root.choices) ? root.choices : [];
    const content = choices[0] as { message?: { content?: unknown } } | undefined;
    if (
      content?.message
      && typeof content.message.content === 'string'
      && content.message.content.length <= MAX_WRAPPED_JSON_LENGTH
    ) {
      try {
        const inner = JSON.parse(content.message.content) as { ingredients?: unknown };
        if (Array.isArray(inner.ingredients)) {
          return parseKnowledgeBody({ ingredients: inner.ingredients }, requested);
        }
      } catch {
        return [];
      }
    }
    return [];
  }

  if (raw.length > MAX_NAMES) return [];
  const requestedSet = new Set(
    requested
      .filter((name) => name.trim().length <= MAX_NAME_LENGTH)
      .map((name) => name.trim().toLowerCase()),
  );
  const out: KnowledgeAnswer[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as { name?: unknown; summary?: unknown };
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    if (!name || name.length > MAX_NAME_LENGTH || !requestedSet.has(name.toLowerCase())) continue;
    const summary = typeof entry.summary === 'string' ? entry.summary.trim() : '';
    if (!summary || summary.length > MAX_SUMMARY) continue;
    out.push({ name, summary });
  }
  return out;
}

/**
 * Ask the configured knowledge endpoint to explain `names` (bounded). Returns
 * answers for names the endpoint actually addressed; empty map on any failure
 * or when unconfigured (never throws).
 */
export async function fetchKnowledgeSummaries(
  names: readonly string[],
  env: EnvVarMap = process.env,
  language = 'fr',
  fetchImpl: KnowledgeFetchImpl = defaultFetch,
): Promise<KnowledgeAnswer[]> {
  const config = knowledgeConfig(env);
  if (!config || names.length === 0) return [];
  const requested = names.slice(0, MAX_NAMES).map((name) => name.trim());
  if (
    requested.some((name) => !name || name.length > MAX_NAME_LENGTH)
    || requested.reduce((length, name) => length + name.length, 0)
      + Math.max(0, requested.length - 1) > MAX_INGREDIENT_TEXT_LENGTH
  ) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), KNOWLEDGE_TIMEOUT_MS);
  const system =
    'You explain EU/MA grocery-food label ingredient names for a shopping app. ' +
    'Answer with neutral, factual, non-medical explanations (what the ingredient is, ' +
    'its typical role, and — only when true — EU-approved additive or allergen status). ' +
    'Never make safety, health, or medical claims. Reply ONLY with strict JSON: ' +
    '{"ingredients":[{"name":"<exact requested name>","summary":"1-3 short sentences"}]}.';
  try {
    const res = await fetchImpl(`${config.url}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: `Language: ${language}. Explain these label ingredients:\n${requested
              .map((n, i) => `${i + 1}. ${n}`)
              .join('\n')}`,
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const body = await res.json();
    return parseKnowledgeBody(body, requested);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
