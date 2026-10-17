import { chatResponse } from "../lib/concierge.mjs";

export function POST(request) {
  return chatResponse(request);
}
