import { statusResponse } from "../lib/concierge.mjs";

export function GET() {
  return statusResponse();
}
