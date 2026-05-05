import { handleNewsRequest } from "../server/api-handlers";

export default async function handler(request: any, response: any) {
  return handleNewsRequest(request, response);
}
