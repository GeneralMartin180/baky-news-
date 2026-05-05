import { handleArticleContentRequest } from "../server/api-handlers";

export default async function handler(request: any, response: any) {
  return handleArticleContentRequest(request, response);
}
