import { getArticleContent, HttpError } from "../server/news-service";

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
    const articleUrl = url.searchParams.get("url");

    if (!articleUrl) {
      return buildJsonResponse({ error: "URL is required" }, { status: 400 });
    }

    try {
      const result = await getArticleContent(articleUrl);
      const isProduction = process.env.NODE_ENV === "production";

      return buildJsonResponse(result, {
        status: 200,
        headers: {
          "Cache-Control": !isProduction
            ? "no-store"
            : result.content
            ? "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
            : "no-store",
        },
      });
    } catch (error) {
      if (error instanceof HttpError) {
        return buildJsonResponse({ error: error.message }, { status: error.statusCode });
      }

      console.warn("Error scraping article, returning empty content for fallback:", error);
      return buildJsonResponse({ content: "" }, { status: 200 });
    }
  },
};
