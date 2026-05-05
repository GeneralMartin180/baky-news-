import { handleHealthRequest } from "../server/api-handlers";

export default async function handler(request: any, response: any) {
  return handleHealthRequest(request, response);
}
