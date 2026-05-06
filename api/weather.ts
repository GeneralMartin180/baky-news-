import { getWeatherSnapshot } from "../server/weather-service";
import type { LanguageCode, LocalEdition, RegionCode } from "../src/types";

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
    const language = (url.searchParams.get("lang") ?? "sk") as LanguageCode;
    const region = (url.searchParams.get("region") ?? "SK") as RegionCode;
    const localEdition = (url.searchParams.get("localEdition") ?? "all") as LocalEdition;

    try {
      const snapshot = await getWeatherSnapshot({
        language,
        localEdition,
        region,
      });

      return buildJsonResponse(snapshot, {
        status: 200,
        headers: {
          "Cache-Control":
            process.env.NODE_ENV === "production"
              ? "public, max-age=300, s-maxage=600, stale-while-revalidate=1800"
              : "no-store",
        },
      });
    } catch (error) {
      console.error("Error fetching weather:", error);
      return buildJsonResponse({ error: "Chyba pri nacitani pocasia." }, { status: 500 });
    }
  },
};
