import { getNewsWithMeta } from "../server/news-service.ts";
import type { LanguageCode, LocalEdition, NewsFeedResponse, RegionCode } from "../src/types";

export const runtime = "nodejs";

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

export default {
  async fetch(request: Request) {
    try {
      const searchParams = new URL(request.url).searchParams;
      const category = searchParams.get("category") ?? "general";
      const query = (searchParams.get("q") ?? "").trim();
      const refresh = searchParams.get("refresh") === "true";
      const language = (searchParams.get("lang") ?? "sk") as LanguageCode;
      const region = (searchParams.get("region") ?? "SK") as RegionCode;
      const localEdition = (searchParams.get("localEdition") ?? "all") as LocalEdition;

      const result = await getNewsWithMeta({
        category,
        language,
        localEdition,
        query,
        refresh,
        region,
      });

      return jsonResponse(result.feed, {
        headers: {
          "Cache-Control": refresh
            ? "no-store"
            : "public, max-age=60, s-maxage=120, stale-while-revalidate=300",
          "X-Baky-Cache-State": result.meta.cacheState,
          "X-Baky-Feed-Updated-At": result.meta.updatedAt,
          "X-Baky-Source-Mode": result.meta.sourceMode,
        },
        status: 200,
      });
    } catch (error) {
      console.error("Error fetching news:", error);

      const emptyFeed = {
        articles: [],
        editorial: null,
        localEdition: null,
      } satisfies NewsFeedResponse;

      return jsonResponse(emptyFeed, {
        headers: {
          "Cache-Control": "no-store",
          "X-Baky-Cache-State": "error-empty",
          "X-Baky-Feed-Updated-At": new Date().toISOString(),
          "X-Baky-Source-Mode": "error-empty",
        },
        status: 200,
      });
    }
  },
};
