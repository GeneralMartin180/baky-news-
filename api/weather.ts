import { handleWeatherRequest } from "../server/api-handlers";

export default async function handler(request: any, response: any) {
  return handleWeatherRequest(request, response);
}
