import {
  handleNewsRequest,
  type ApiRequestLike,
  type ApiResponseLike,
} from "../server/api-handlers.ts";

type BufferedApiResponse = ApiResponseLike & {
  toResponse(): Response;
};

function readQuery(request: any): NonNullable<ApiRequestLike["query"]> {
  if (request?.query && typeof request.query === "object") {
    return request.query as NonNullable<ApiRequestLike["query"]>;
  }

  const searchParams = new URL(request.url).searchParams;
  const query: Record<string, string> = {};

  for (const [key, value] of searchParams.entries()) {
    query[key] = value;
  }

  return query;
}

function createBufferedApiResponse(): BufferedApiResponse {
  let payload: unknown = null;
  let statusCode = 200;
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
  });

  const response: BufferedApiResponse = {
    json(nextPayload: unknown) {
      payload = nextPayload;
      return nextPayload;
    },
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
    status(code: number) {
      statusCode = code;
      return response;
    },
    toResponse() {
      return new Response(JSON.stringify(payload), {
        headers,
        status: statusCode,
      });
    },
  };

  return response;
}

export default async function handler(request: any, response?: any) {
  const apiRequest = {
    query: readQuery(request),
  } satisfies ApiRequestLike;

  if (response?.status && response?.json) {
    return handleNewsRequest(apiRequest, response);
  }

  const bufferedResponse = createBufferedApiResponse();
  await handleNewsRequest(apiRequest, bufferedResponse);
  return bufferedResponse.toResponse();
}
