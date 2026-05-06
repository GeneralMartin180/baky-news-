import { getNewsWithMeta } from "../server/news-service";
import type { LanguageCode, LocalEdition, NewsFeedResponse, RegionCode } from "../src/types";

function buildJsonResponse(payload: unknown, init?: ResponseInit) {
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
    const url = new URL(request.url);
    const category = url.searchParams.get("category") ?? "general";
    const query = (url.searchParams.get("q") ?? "").trim();
    const refresh = url.searchParams.get("refresh") === "true";
    const language = (url.searchParams.get("lang") ?? "sk") as LanguageCode;
    const region = (url.searchParams.get("region") ?? "SK") as RegionCode;
    const localEdition = (url.searchParams.get("localEdition") ?? "all") as LocalEdition;

    try {
      const result = await getNewsWithMeta({
        category,
        language,
        localEdition,
        query,
        refresh,
        region,
      });

      const isProduction = process.env.NODE_ENV === "production";
      return buildJsonResponse(result.feed, {
        status: 200,
        headers: {
          "Cache-Control": !isProduction
            ? "no-store"
            : refresh
            ? "no-store"
            : "public, max-age=60, s-maxage=120, stale-while-revalidate=300",
          "X-Baky-Cache-State": result.meta.cacheState,
          "X-Baky-Feed-Updated-At": result.meta.updatedAt,
          "X-Baky-Source-Mode": result.meta.sourceMode,
        },
      });
    } catch (error) {
      console.error("Error fetching news:", error);

      if (process.env.NODE_ENV === "production") {
        const emptyFeed = {
          articles: [],
          editorial: null,
          localEdition: null,
        } satisfies NewsFeedResponse;

        return buildJsonResponse(emptyFeed, {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
            "X-Baky-Cache-State": "error-empty",
            "X-Baky-Feed-Updated-At": new Date().toISOString(),
            "X-Baky-Source-Mode": "error-empty",
          },
        });
      }

      return buildJsonResponse({ error: "Chyba pri stahovani sprav." }, { status: 500 });
    }
  },
};
