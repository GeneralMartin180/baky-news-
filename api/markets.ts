import {
  getCommodityMarketSnapshot,
  isCommodityMarketRange,
} from "./_lib/commodity-markets.js";
import { enforceRequestPolicy, isBlockedRequestDecision } from "./_lib/request-security.js";

function buildJsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

function sendJson(response: any, payload: unknown, status = 200, headers: Record<string, string> = {}) {
  if (response?.setHeader) {
    for (const [name, value] of Object.entries({
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    })) {
      response.setHeader(name, value);
    }
  }

  if (response?.status && response?.json) {
    return response.status(status).json(payload);
  }

  return buildJsonResponse(payload, { status, headers });
}

export default async function handler(request: any, response?: any) {
  const decision = enforceRequestPolicy(request, "markets");
  if (isBlockedRequestDecision(decision)) {
    return sendJson(response, decision.payload, decision.status, decision.headers);
  }

  try {
    const requestUrl = new URL(request?.url ?? "/api/markets", "https://baky-news.vercel.app");
    const rawQueryRange = Array.isArray(request?.query?.range)
      ? request.query.range[0]
      : request?.query?.range ?? requestUrl.searchParams.get("range") ?? "1d";
    const queryRange = String(rawQueryRange);
    const range = isCommodityMarketRange(queryRange) ? queryRange : "1d";
    const snapshot = await getCommodityMarketSnapshot(range);
    return sendJson(response, snapshot, 200, {
      ...decision.headers,
      "Cache-Control": "public, max-age=15, s-maxage=30, stale-while-revalidate=600",
      "X-Baky-Markets-Source": "yahoo-finance-chart",
    });
  } catch (error) {
    console.error("Markets handler failed:", error);
    return sendJson(response, { error: "Chyba pri nacitani komoditnej burzy." }, 503, {
      ...decision.headers,
      "Cache-Control": "no-store",
    });
  }
}
