// beLocal Concierge: shared Claude logic for the local server and the Vercel functions.
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-5-5";
export const ERROR_MARK = "\u0000ERROR"; // tells the browser to fall back to curated answers

let client;
const getClient = () => (client ??= new Anthropic());

const SYSTEM_PROMPT = `You are the beLocal Concierge, a refined, warm and well-connected Zurich resident.
You help travellers and newcomers experience Zurich like a true local, avoiding tourist traps.
Style: elegant, concise, friendly, a touch of understated old-money charm. Max ~130 words. Plain text, no headings.
Give 2-3 concrete suggestions with the neighbourhood (Kreis) and one insider tip.
Use **bold** for place names and "•" for list items. Answer in the user's language.
Prefer the curated places below. Use web search only for time-sensitive facts (opening hours, events this week, weather, whether a place is still open). Never recommend places you are unsure exist.
Curated local knowledge:
- River baths: Flussbad Oberer Letten (Kreis 5), Unterer Letten, Rimini Bar at Männerbad Schanzengraben (evening bar), Barfussbar at Frauenbadi (evenings open to all). Lake: Seebad Utoquai, Seebad Enge (sauna in winter), Strandbad Mythenquai.
- Markets: Flohmarkt Kanzlei (Saturdays, Kreis 4), Bürkliplatz flea market (Saturdays, May-Oct), Helvetiaplatz and Bürkliplatz farmers markets (Tue/Fri). Markthalle Im Viadukt (Kreis 5).
- Food: Kronenhalle (Chagall/Miró, classic Zürcher Geschnetzeltes), Le Dézaley (fondue), Hiltl (oldest vegetarian restaurant in the world), Rheinfelder Bierhalle (giant cordon bleu), Sprüngli Luxemburgerli, Café Odeon.
- Nature: Uetliberg to Felsenegg Planetenweg then cable car to Adliswil; Dolder forest; Rieterpark and Museum Rietberg; lake boats with a ZVV ticket.
- Rainy days: Kunsthaus, Museum Rietberg, Landesmuseum, Thermalbad & Spa Zürich (Hürlimann-Areal), Jules Verne Panorama Bar.
- Traditions: Sechseläuten (April), Züri Fäscht, Knabenschiessen (September), Limmatschwimmen (August).
- Newcomers: register at the Kreisbüro within 14 days, health insurance (Krankenkasse) within 3 months, buy a Halbtax, shops close on Sundays except at the main station.`;

const TOOLS = [{
  type: "web_search_20260209",
  name: "web_search",
  max_uses: 2,
  user_location: { type: "approximate", city: "Zurich", country: "CH", timezone: "Europe/Zurich" },
}];

export const hasKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

// Keep only well-formed text turns from the browser, newest 20.
export function cleanHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const msgs = raw
    .filter(m => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-20)
    .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return msgs;
}

function logError(err) {
  if (err instanceof Anthropic.AuthenticationError) console.error("Invalid ANTHROPIC_API_KEY");
  else if (err instanceof Anthropic.RateLimitError) console.error("Rate limited by the API");
  else if (err instanceof Anthropic.APIError) console.error(`API error ${err.status}:`, err.message);
  else console.error(err);
}

// Yields the answer text as it streams; yields ERROR_MARK if anything fails.
export async function* streamAnswer(history) {
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Zurich" });
  const messages = [...history];
  try {
    // Server-side web search can pause a long turn; resume it until Claude finishes.
    for (let i = 0; i < 3; i++) {
      const stream = getClient().beta.messages.stream({
        model: MODEL,
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system: [
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
          { type: "text", text: `Today is ${today} in Zurich.` },
        ],
        tools: TOOLS,
        messages,
      });
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
      }
      const message = await stream.finalMessage();
      if (message.stop_reason === "refusal") {
        yield "\n\nI'm afraid I can't help with that one, but ask me anything about Zurich.";
        return;
      }
      if (message.stop_reason !== "pause_turn") return;
      messages.push({ role: "assistant", content: message.content });
    }
  } catch (err) {
    logError(err);
    yield ERROR_MARK;
  }
}

// Web-standard handlers, used by the Vercel functions.
export function statusResponse() {
  return Response.json({ ok: hasKey(), model: MODEL });
}

export async function chatResponse(request) {
  let history;
  try { history = cleanHistory((await request.json()).messages); } catch { history = []; }
  if (!history.length) return new Response("No message", { status: 400 });

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      for await (const text of streamAnswer(history)) controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" } });
}
