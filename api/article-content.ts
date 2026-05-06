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

function readArticleUrl(request: any) {
  if (request?.query) {
    const value = request.query.url;
    if (typeof value === "string") return value;
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    return "";
  }

  return new URL(request.url).searchParams.get("url") ?? "";
}

function isUrlSafe(value: string) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(host)) return false;
    return true;
  } catch {
    return false;
  }
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function stripHtml(value: string) {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
  );
}

function extractParagraphs(html: string) {
  const articleMatch =
    html.match(/<article\b[\s\S]*?<\/article>/i)?.[0] ??
    html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ??
    html;
  const paragraphs = Array.from(articleMatch.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    .map((match) => stripHtml(match[1]))
    .filter((paragraph) => paragraph.length > 45);

  const unique = Array.from(new Set(paragraphs));
  return unique.slice(0, 12).join("\n\n");
}

async function fetchArticleContent(articleUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(articleUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 BakyNews/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return "";
    }

    return extractParagraphs(await response.text());
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(request: any, response?: any) {
  const articleUrl = readArticleUrl(request);
  if (!articleUrl || !isUrlSafe(articleUrl)) {
    return sendJson(response, { content: "" }, 200, { "Cache-Control": "no-store" });
  }

  const content = await fetchArticleContent(articleUrl);
  return sendJson(response, { content }, 200, {
    "Cache-Control": content
      ? "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400"
      : "no-store",
  });
}
