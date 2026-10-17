// beLocal Concierge: streams answers from Claude through our server, falls back to curated answers.
const chatBody = document.getElementById("chat-body");
const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");
const statusDot = document.querySelector("#status .dot");
const statusText = document.getElementById("status-text");

let history = [];
let liveModel = false;
let busy = false;

// ---------- status ----------
async function checkModel() {
  try {
    const data = await (await fetch("/api/status")).json();
    if (!data.ok) throw new Error("no key");
    liveModel = true;
    statusDot.className = "dot on";
    statusText.textContent = "Concierge online · powered by Claude";
  } catch {
    liveModel = false;
    statusDot.className = "dot demo";
    statusText.textContent = "Preview mode · curated answers";
  }
}

// ---------- rendering ----------
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function format(s) {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}
function addMsg(text, who) {
  const el = document.createElement("div");
  el.className = `msg ${who}`;
  el.innerHTML = format(text);
  chatBody.appendChild(el);
  chatBody.scrollTop = chatBody.scrollHeight;
  return el;
}

// ---------- Claude (streamed via /api/chat) ----------
async function askModel(el) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: history }),
  });
  if (!res.ok) throw new Error("server error");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
    if (full.includes("\u0000ERROR")) throw new Error("model error");
    el.innerHTML = format(full);
    chatBody.scrollTop = chatBody.scrollHeight;
  }
  return full;
}

// ---------- curated fallback ----------
const CURATED = [
  { keys: ["rain", "pioggia", "regen", "museum", "museo", "cold", "freddo"],
    text: `Rain is when Zurich gets cosy. Three ideas:\n\n• **Museum Rietberg** (Kreis 2): world art in a villa park. Locals pair it with a walk through Rieterpark when the drizzle stops.\n• **Thermalbad & Spa Zürich** (Kreis 2): rooftop thermal pool in a former brewery. Book a weekday evening.\n• **Jules Verne Panorama Bar** (Kreis 1): a cocktail under the old observatory dome, rain on the windows.\n\nInsider tip: the Kunsthaus is free on Wednesdays.` },
  { keys: ["swim", "nuot", "badi", "lake", "lago", "river", "fiume", "schwimm", "summer", "estate"],
    text: `Swimming is the Zurich ritual. Where locals actually go:\n\n• **Flussbad Oberer Letten** (Kreis 5): jump in, drift with the Limmat current, climb out, repeat. Bring a dry bag.\n• **Rimini Bar at Männerbad Schanzengraben** (Kreis 1): men only by day, a candle-lit bar for everyone on summer evenings.\n• **Seebad Enge** (Kreis 2): wooden lake bath with a sauna that stays open all winter.\n\nInsider tip: in August, join the Limmatschwimmen with two thousand Zürcher.` },
  { keys: ["fondue", "eat", "mangi", "food", "cibo", "dinner", "cena", "restaurant", "ristorante", "lunch", "pranzo"],
    text: `For a proper Swiss table without the tour buses:\n\n• **Le Dézaley** (Kreis 1): Vaudois fondue in a wood-panelled room. Order the moitié-moitié.\n• **Kronenhalle** (Kreis 1): Chagall on the wall and Zürcher Geschnetzeltes with Rösti, the city's signature dish.\n• **Rheinfelder Bierhalle** (Niederdorf): a cordon bleu the size of your plate. No frills, all locals.\n\nInsider tip: Zürcher eat dinner early, so book for 19:00.` },
  { keys: ["drink", "bar", "night", "sera", "evening", "cocktail", "aperitivo", "apéro", "romantic", "romantic"],
    text: `An evening the Zurich way:\n\n• **Apéro at Barfussbar** (Frauenbadi, Kreis 1): shoes off, wooden deck, the Limmat under your feet.\n• **Kronenhalle Bar** (Kreis 1): a classic Negroni among original Miró and Picasso.\n• **Jules Verne Panorama Bar** (Kreis 1): the old town at night from above.\n\nInsider tip: for something livelier, walk Langstrasse in Kreis 4 after 22:00.` },
  { keys: ["moved", "trasfer", "newcomer", "new here", "start", "inizi", "register", "apartment", "casa", "permit"],
    text: `Herzlich willkommen! The essentials, in order:\n\n• **Kreisbüro**: register within 14 days with passport and rental contract.\n• **Krankenkasse**: health insurance is mandatory within 3 months and backdated. Compare before you sign.\n• **Halbtax**: half price on every Swiss train, and locals consider it non-negotiable.\n\nThen the fun part: pick your Badi, join a Verein, and learn that shops close on Sundays (except at Hauptbahnhof).` },
  { keys: ["sunday", "domenica", "sonntag", "weekend", "hike", "escurs", "walk", "passegg", "nature", "free"],
    text: `A free Sunday, Zürcher style:\n\n• **Planetenweg** (Uetliberg → Felsenegg): a 90-minute ridge walk through a scaled-down solar system, then the cable car down to Adliswil.\n• **Lake boat**: a ZSG steamer to Rapperswil with your ZVV ticket, lunch by the castle.\n• **Wipkingen Limmat steps** (Kreis 10): a coffee, a book and the river.\n\nInsider tip: shops are closed on Sundays, so do your shopping on Saturday like a local.` },
  { keys: ["market", "mercat", "flea", "vintage", "shop", "saturday", "sabato"],
    text: `Saturday mornings are for markets:\n\n• **Flohmarkt Kanzlei** (Kreis 4): vintage, vinyl and Swiss curiosities. Bring cash.\n• **Bürkliplatz flea market** (Kreis 1, May–Oct): antiques by the lake.\n• **Markthalle Im Viadukt** (Kreis 5): local cheese, bread and coffee under the railway arches.\n\nInsider tip: arrive before 9:00 for the best finds.` },
  { keys: ["coffee", "caff", "brunch", "breakfast", "colazione", "sweet", "dolc", "chocolate", "cioccolat"],
    text: `For the sweet side of Zurich:\n\n• **Sprüngli** at Paradeplatz (Kreis 1): Luxemburgerli, the city's signature macarons. Take away, eat by the lake.\n• **Markthalle Im Viadukt** (Kreis 5): a relaxed brunch among local producers.\n• **Café Odeon** (Kreis 1): Art Nouveau coffeehouse once frequented by Einstein and Lenin.\n\nInsider tip: buy Luxemburgerli on the day, as they don't keep.` },
];
const DEFAULT_ANSWER = `Happy to help. Tell me a little more: are you visiting or living here, who are you with, and what's the weather like? Meanwhile, a classic local evening: an **apéro at Barfussbar**, dinner at **Kronenhalle**, and a walk along the Limmat to **Lindenhof** after dark.`;

function curatedAnswer(q) {
  const s = q.toLowerCase();
  return (CURATED.find(c => c.keys.some(k => s.includes(k))) || { text: DEFAULT_ANSWER }).text;
}

async function typeOut(el, text) {
  let shown = "";
  for (const word of text.split(/(\s+)/)) {
    shown += word;
    el.innerHTML = format(shown);
    chatBody.scrollTop = chatBody.scrollHeight;
    await new Promise(r => setTimeout(r, 18));
  }
}

// ---------- send ----------
async function send(text) {
  if (!text.trim() || busy) return;
  busy = true;
  addMsg(text, "user");
  history.push({ role: "user", content: text });
  const el = addMsg("", "bot typing");
  let answer = "";
  try {
    if (!liveModel) throw new Error("offline");
    answer = await askModel(el);
    if (!answer.trim()) throw new Error("empty");
  } catch {
    answer = curatedAnswer(text);
    await new Promise(r => setTimeout(r, 600));
    await typeOut(el, answer);
  }
  el.classList.remove("typing");
  history.push({ role: "assistant", content: answer });
  busy = false;
}

form.addEventListener("submit", e => {
  e.preventDefault();
  const text = input.value;
  input.value = "";
  send(text);
});
document.querySelectorAll("#chips button").forEach(b => b.addEventListener("click", () => send(b.textContent)));
document.querySelectorAll(".card[data-ask]").forEach(c => c.addEventListener("click", () => {
  document.getElementById("concierge").scrollIntoView({ behavior: "smooth" });
  setTimeout(() => send(c.dataset.ask), 500);
}));

checkModel();
