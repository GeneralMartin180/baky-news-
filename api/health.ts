import { getBackendHealth } from "../server/news-service.ts";

export default {
  async fetch() {
    return new Response(JSON.stringify(getBackendHealth()), {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  },
};
