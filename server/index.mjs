// BookFlix AI server: book worlds ("Enter the Book") and character chat, powered by Google Gemini.
// The API key stays here on the server and never reaches the browser.
// Start it with:  npm run server   (reads GEMINI_API_KEY from server/.env)
import express from "express";
import { GoogleGenAI, ApiError } from "@google/genai";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const PORT = process.env.PORT || 5001;
// "gemini-flash-latest" always points to Google's current Flash model, which is on the free tier.
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
// Used when the main model is overloaded (503) or its free quota is used up (429).
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-flash-lite-latest";

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
if (!ai) {
  console.warn("No Gemini API key found. Add GEMINI_API_KEY to server/.env to enable the AI features.");
}

const app = express();
app.use(express.json({ limit: "200kb" }));

app.get("/api/health", (req, res) => res.json({ ai: Boolean(ai) }));

const requireAi = (req, res, next) => {
  if (!ai) return res.status(503).json({ error: "AI is not configured. Add GEMINI_API_KEY to server/.env and restart the server." });
  next();
};

// ---------- Who is calling: Firebase sign-in and a simple rate limit ----------

// The browser sends the signed-in reader's Firebase ID token; we check it against the
// project in src/firebase.js, so only BookFlix accounts can spend the Gemini quota.
const firebaseSource = readFileSync(new URL("../src/firebase.js", import.meta.url), "utf8");
const projectId = process.env.FIREBASE_PROJECT_ID || firebaseSource.match(/projectId:\s*"([^"]+)"/)?.[1];
const firebaseAuth = getAuth(initializeApp({ projectId }));

const identify = async (req, res, next) => {
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  req.uid = null;
  if (token) {
    try {
      req.uid = (await firebaseAuth.verifyIdToken(token)).uid;
    } catch {
      return res.status(401).json({ error: "Your session has expired. Sign in again." });
    }
  }
  next();
};

const requireUser = (req, res, next) => {
  if (!req.uid) return res.status(401).json({ error: "Sign in to use this feature." });
  next();
};

// At most LIMIT AI requests per reader (or per address for guests) in each WINDOW.
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 40;
const recent = new Map();
const rateLimit = (req, res, next) => {
  const key = req.uid || req.ip;
  const now = Date.now();
  const hits = (recent.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= LIMIT) {
    return res.status(429).json({ error: "You're going a bit fast. Take a short break and try again in a few minutes." });
  }
  hits.push(now);
  recent.set(key, hits);
  next();
};

// Signed-in readers only (chat, maps, case files). The site assistant also helps guests.
const forReaders = [requireAi, identify, requireUser, rateLimit];
const forEveryone = [requireAi, identify, rateLimit];

const describeError = (err) => {
  if (err instanceof ApiError) {
    if (err.status === 400 && /api key/i.test(err.message)) return [401, "The Gemini API key is invalid."];
    if (err.status === 401 || err.status === 403) return [401, "The Gemini API key is invalid or not allowed to use this model."];
    if (err.status === 429) return [429, "The free Gemini quota is used up for now. Wait a minute (or until tomorrow) and try again."];
    if (err.status === 503) return [503, "Gemini is very busy right now. Try again in a minute."];
    return [502, `AI service error (${err.status}).`];
  }
  return [500, "Something went wrong talking to the AI."];
};

// Calls Gemini, retrying briefly and then switching to the fallback model when
// the service is overloaded or rate-limited. `call` receives the model name.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function withFallback(call) {
  const attempts = [MODEL, MODEL, FALLBACK_MODEL, FALLBACK_MODEL];
  for (let i = 0; ; i++) {
    try {
      return await call(attempts[i]);
    } catch (err) {
      const retryable = err instanceof ApiError && (err.status === 503 || err.status === 429 || err.status >= 500);
      if (!retryable || i === attempts.length - 1) throw err;
      console.warn(`${attempts[i]} returned ${err.status}, retrying with ${attempts[i + 1]}`);
      await sleep(1500 * (i + 1));
    }
  }
}

// ---------- Enter the Book: a spoiler-graded map of the book's world ----------

// Readers unlock the map chapter by chapter: every place, person and event
// carries the chapter in which it first appears.
const World = z.object({
  premise: z.string(),
  chapters: z.array(z.object({ number: z.number(), title: z.string() })).min(1),
  locations: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      icon: z.string(),
      description: z.string(),
      x: z.number(),
      y: z.number(),
      revealChapter: z.number(),
    })
  ),
  characters: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
      description: z.string(),
      voice: z.string(),
      locationId: z.string(),
      revealChapter: z.number(),
    })
  ),
  events: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      locationId: z.string(),
      revealChapter: z.number(),
    })
  ),
});

// The same shape as plain JSON Schema, which Gemini uses to constrain its output.
const str = (description) => ({ type: "string", description });
const num = (description) => ({ type: "number", description });
const int = (description) => ({ type: "integer", description });
const obj = (properties) => ({ type: "object", properties, required: Object.keys(properties) });
const REVEAL = "Number of the chapter in which the reader first encounters this (1 = first chapter).";

const WORLD_SCHEMA = obj({
  premise: str("Spoiler-free premise of the story, 1-2 sentences."),
  chapters: {
    type: "array",
    description: "Every chapter of the book, in order, as numbered in common editions.",
    items: obj({
      number: int("Chapter number, starting at 1."),
      title: str("The chapter's real title, or an empty string if chapters are untitled or you are not sure."),
    }),
  },
  locations: {
    type: "array",
    items: obj({
      id: str("Short kebab-case id, unique within this world."),
      name: str("Name of the place."),
      icon: str("A single emoji that fits the place."),
      description: str("1-2 sentences, only what a reader knows when the place first appears."),
      x: num("Horizontal map position, 5-95."),
      y: num("Vertical map position, 8-92."),
      revealChapter: int(REVEAL),
    }),
  },
  characters: {
    type: "array",
    items: obj({
      name: str("Character name."),
      role: str("A few words, e.g. 'the narrator' or 'a mysterious neighbor'."),
      description: str("1-2 sentences, only what is known when the character first appears."),
      voice: str("How this character talks and behaves, for role-play."),
      locationId: str("Id of the location most associated with the character at first appearance."),
      revealChapter: int(REVEAL),
    }),
  },
  events: {
    type: "array",
    items: obj({
      title: str("Short event title."),
      description: str("1-2 sentences describing the event without revealing anything later."),
      locationId: str("Id of the location where it happens."),
      revealChapter: int(REVEAL),
    }),
  },
});

const WORLD_SYSTEM = `You build interactive, spoiler-safe maps of books for a reading app.
Readers unlock the map chapter by chapter, so list the book's chapters and tag every place, character and event with revealChapter: the chapter in which it first appears.
Use the real chapter structure of the book's common editions: the right number of chapters and their real titles. If chapters are untitled or you are not sure of a title, leave the title empty rather than inventing one. If the book is split into parts, number the chapters continuously across parts.
Each description must contain only what a reader knows by the end of that entry's revealChapter. Never mention twists, deaths, betrayals, identities or endings that come later.
Lay the locations out like a hand-drawn story map: spread them across the canvas, keep related places near each other, and avoid overlaps (keep at least 10 units apart).
Aim for 6-12 locations, 5-10 main characters and 10-20 key events, spread across the whole book, with several things available from chapter 1.
Every characters[].locationId and events[].locationId must be the id of one of the locations.
For non-fiction, map the ideas and journeys of the book the same way (sections as places, key figures as characters).
If you don't know the book well, build the world only from what you are confident about and keep it smaller rather than inventing details.
Write everything in English.`;

// Keeps chapter numbers whole and inside the book, whatever the model returned.
const tidyWorld = (world) => {
  const total = world.chapters.length;
  const ch = (n) => Math.min(total, Math.max(1, Math.round(Number(n) || 1)));
  return {
    ...world,
    chapters: world.chapters.map((c, i) => ({ number: i + 1, title: c.title.trim() })),
    locations: world.locations.map((l) => ({ ...l, revealChapter: ch(l.revealChapter) })),
    characters: world.characters.map((c) => ({ ...c, revealChapter: ch(c.revealChapter) })),
    events: world.events.map((e) => ({ ...e, revealChapter: ch(e.revealChapter) })),
  };
};

app.post("/api/world", forReaders, async (req, res) => {
  const { title, author, description } = req.body || {};
  if (!title) return res.status(400).json({ error: "Missing book title." });

  try {
    const world = await askJson(
      WORLD_SYSTEM,
      `Build the story map for "${title}" by ${author || "an unknown author"}.\nBlurb: ${description || "(none)"}`,
      WORLD_SCHEMA,
      World
    );
    if (!world) return res.status(502).json({ error: "The AI couldn't build a map for this book. Try again." });
    res.json(tidyWorld(world));
  } catch (err) {
    console.error("world:", err);
    const [status, error] = describeError(err);
    res.status(status).json({ error });
  }
});

// Asks Gemini for JSON matching `schema`; returns the validated data, or null if it didn't fit `zodSchema`.
async function askJson(systemInstruction, contents, schema, zodSchema) {
  const response = await withFallback((model) => ai.models.generateContent({
    model,
    contents,
    config: { systemInstruction, responseMimeType: "application/json", responseJsonSchema: schema },
  }));
  try {
    const parsed = zodSchema.safeParse(JSON.parse(response.text || ""));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ---------- Plot Detective: a spoiler-graded case file, and the final reveal ----------

const CaseFile = z.object({
  mystery: z.string(),
  suspects: z.array(
    z.object({ id: z.string(), name: z.string(), role: z.string(), description: z.string(), revealChapter: z.number() })
  ),
  clues: z.array(
    z.object({ id: z.string(), title: z.string(), text: z.string(), revealChapter: z.number() })
  ),
});

const CASE_SCHEMA = obj({
  mystery: str("The central question the reader is trying to solve, without giving away the answer. 1-2 sentences."),
  suspects: {
    type: "array",
    items: obj({
      id: str("Short kebab-case id, unique."),
      name: str("Suspect's name."),
      role: str("A few words, e.g. 'the victim's nephew'."),
      description: str("1-2 sentences: who they are and why they look suspicious, as known when they first appear. No hint of whether they are guilty."),
      revealChapter: int("Chapter in which the reader first meets this suspect."),
    }),
  },
  clues: {
    type: "array",
    items: obj({
      id: str("Short kebab-case id, unique."),
      title: str("A short name for the clue, 2-5 words."),
      text: str("1-2 sentences describing the clue exactly as the reader learns it, without interpreting it."),
      revealChapter: int("Chapter in which the reader learns this clue."),
    }),
  },
});

const CASE_SYSTEM = `You prepare case files for "Plot Detective", a game where readers of mystery and crime novels play detective on a virtual evidence board while they read.
Given a book and its chapter list, list the suspects and the clues a reader collects, each tagged with the chapter in which the reader first meets it.
Rules:
- The real culprit (or answer to the mystery) must be among the suspects, but nothing in the case file may reveal or hint who it is. Write every suspect neutrally.
- Include both real clues and red herrings, written exactly as the reader experiences them, without saying which are which.
- Descriptions must only contain what a reader knows by that entry's revealChapter. No twists, deaths or reveals from later chapters.
- Aim for 4-8 suspects and 8-14 clues spread across the book, with at least two suspects and two clues available from chapter 1 or 2.
- If the book isn't really a mystery, frame its central open question (who, what or why) the same way.
- If you don't know the book well, keep the file small and only include what you are confident about.
Write everything in English.`;

app.post("/api/case", forReaders, async (req, res) => {
  const { title, author, chapters } = req.body || {};
  if (!title || !Array.isArray(chapters) || chapters.length === 0) {
    return res.status(400).json({ error: "Missing book title or chapters." });
  }

  try {
    const chapterList = chapters.map((c) => `${c.number}. ${c.title || ""}`.trim()).join("\n");
    const caseFile = await askJson(
      CASE_SYSTEM,
      `Book: "${title}" by ${author || "an unknown author"}.\nChapters (${chapters.length}):\n${chapterList}`,
      CASE_SCHEMA,
      CaseFile
    );
    if (!caseFile) return res.status(502).json({ error: "The AI couldn't open a case file for this book. Try again." });

    const ch = (n) => Math.min(chapters.length, Math.max(1, Math.round(Number(n) || 1)));
    res.json({
      ...caseFile,
      suspects: caseFile.suspects.map((s) => ({ ...s, revealChapter: ch(s.revealChapter) })),
      clues: caseFile.clues.map((c) => ({ ...c, revealChapter: ch(c.revealChapter) })),
    });
  } catch (err) {
    console.error("case:", err);
    const [status, error] = describeError(err);
    res.status(status).json({ error });
  }
});

const Verdict = z.object({
  score: z.number(),
  headline: z.string(),
  answer: z.string(),
  solution: z.string(),
  gotRight: z.array(z.string()),
  missed: z.array(z.string()),
});

const VERDICT_SCHEMA = obj({
  score: int("How close the reader's theory is to the truth, 0-100."),
  headline: str("A short, warm verdict in the style of a detective story, e.g. 'Elementary! You cracked it.'"),
  answer: str("The real answer in one sentence: who did it (or what the truth is)."),
  solution: str("How it really happened and why, in 3-6 sentences. Full spoilers are fine here."),
  gotRight: { type: "array", items: str("Something the reader's theory got right.") },
  missed: { type: "array", items: str("Something important the reader missed or got wrong.") },
});

const RevealRequest = z.object({
  book: z.object({ title: z.string(), author: z.string().optional().default("") }),
  mystery: z.string().max(1000),
  suspects: z.array(z.string().max(200)).max(30),
  accused: z.string().max(200).optional().default(""),
  theory: z.string().max(4000).optional().default(""),
  links: z.array(z.string().max(400)).max(60).optional().default([]),
  notes: z.array(z.string().max(1000)).max(30).optional().default([]),
});

const REVEAL_SYSTEM = `You are the judge at the end of "Plot Detective", a game where readers solve the mystery of a book on an evidence board.
The reader has asked to see the truth, so full spoilers are allowed.
Compare the reader's theory with what really happens in the book and score it from 0 to 100: the culprit or answer matters most, then the method and motive, then how well their connections and notes point to the truth.
Be warm and encouraging, but honest: don't call a wrong answer right. If the reader gave no theory, score it 0 and still explain the solution.
If you are not sure how the book ends, say so plainly in the solution instead of guessing.
Write in English.`;

app.post("/api/case/reveal", forReaders, async (req, res) => {
  const parsed = RevealRequest.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid reveal request." });
  const { book, mystery, suspects, accused, theory, links, notes } = parsed.data;

  const report = [
    `Book: "${book.title}" by ${book.author}`,
    `Mystery: ${mystery}`,
    `Suspects on the board: ${suspects.join(", ")}`,
    `The reader accuses: ${accused || "(nobody)"}`,
    `The reader's theory: ${theory || "(none written)"}`,
    `Connections the reader drew: ${links.length ? links.join("; ") : "(none)"}`,
    `Reader's notes: ${notes.length ? notes.join(" | ") : "(none)"}`,
  ].join("\n");

  try {
    const verdict = await askJson(REVEAL_SYSTEM, report, VERDICT_SCHEMA, Verdict);
    if (!verdict) return res.status(502).json({ error: "The AI couldn't judge the case. Try again." });
    res.json({ ...verdict, score: Math.min(100, Math.max(0, Math.round(verdict.score))) });
  } catch (err) {
    console.error("reveal:", err);
    const [status, error] = describeError(err);
    res.status(status).json({ error });
  }
});

// ---------- Character Chat: talk to a character, spoiler-free ----------

const readingPoint = ({ chapter, totalChapters, chapterTitle }) =>
  chapter === 0
    ? "has not started the book yet"
    : `has finished chapter ${chapter} of ${totalChapters}${chapterTitle ? ` ("${chapterTitle}")` : ""}`;

const chatSystem = ({ book, character, reading, known }) => `You are ${character.name} from "${book.title}" by ${book.author}. You are talking with a reader of the book inside the BookFlix reading app.

Who you are: ${character.role}. ${character.description}
How you speak: ${character.voice}

Stay in character: speak in your own voice, with your own personality, knowledge, era and opinions. Talk as if the reader is someone you just met in your world.

SPOILER RULE (most important): the reader ${readingPoint(reading)}. You only know what has happened up to the end of that chapter. Never reveal, hint at or foreshadow anything that happens later, including your own fate, other characters' secrets and the ending. If the reader asks about later events, deflect naturally in character (you don't know yet, the future is uncertain, you'd rather not say).

What has happened so far, as far as the reader knows:
${known}

Keep replies conversational: usually 1-3 short paragraphs. Reply in the same language the reader writes in. If the reader sincerely asks whether they are talking to an AI, say honestly that you are an AI playing ${character.name}, then carry on.`;

const ChatRequest = z.object({
  book: z.object({ title: z.string(), author: z.string().optional().default("") }),
  character: z.object({
    name: z.string(),
    role: z.string().optional().default(""),
    description: z.string().optional().default(""),
    voice: z.string().optional().default(""),
  }),
  reading: z.object({
    chapter: z.number().int().min(0),
    totalChapters: z.number().int().min(1),
    chapterTitle: z.string().optional().default(""),
  }),
  known: z.string().max(8000).optional().default(""),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(40),
});

const Messages = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
  .min(1)
  .max(40);

// Streams Gemini's reply to the browser as plain text.
async function streamReply(res, label, systemInstruction, messages) {
  try {
    const stream = await withFallback((model) => ai.models.generateContentStream({
      model,
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      config: { systemInstruction },
    }));

    // no-transform keeps the dev proxy from buffering the stream
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");

    let wrote = false;
    for await (const chunk of stream) {
      if (chunk.text) {
        res.write(chunk.text);
        wrote = true;
      }
    }
    if (!wrote) res.write("(I'd rather not talk about that.)");
    res.end();
  } catch (err) {
    console.error(`${label}:`, err);
    const [status, error] = describeError(err);
    if (!res.headersSent) res.status(status).json({ error });
    else res.end(`\n\n(${error})`);
  }
}

app.post("/api/chat", forReaders, async (req, res) => {
  const parsed = ChatRequest.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid chat request." });
  const { book, character, reading, known, messages } = parsed.data;
  const system = chatSystem({ book, character, reading, known: known || "(The story has just begun.)" });
  await streamReply(res, "chat", system, messages);
});

// ---------- Site assistant: the helper in the corner of every page ----------

const AssistantRequest = z.object({
  page: z.object({ path: z.string().max(300), title: z.string().max(300).optional().default("") }),
  catalog: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        author: z.string().optional().default(""),
        year: z.union([z.string(), z.number()]).optional(),
        vibes: z.array(z.string()).optional().default([]),
        price: z.string().optional().default(""),
      })
    )
    .max(300),
  cart: z.array(z.string()).max(100).optional().default([]),
  favorites: z.array(z.string()).max(300).optional().default([]),
  signedIn: z.boolean().optional().default(false),
  messages: Messages,
});

const assistantSystem = ({ page, catalog, cart, favorites, signedIn }) => `You are the BookFlix assistant, a warm, concise helper that lives in the corner of every page of BookFlix, a cozy online bookstore and reading app.

What visitors can do on BookFlix:
- Home (/): browse and search the whole collection by title, author or director.
- By Vibe (/vibes): pick moods, settings and themes (e.g. rain, cozy, mystery) to get matching books.
- Book page (/item/<id>): buy the book (added to the cart), read it online for 30 days, add it to favorites or My List, track reading by chapter, write reviews.
- Enter the Book (/world/<id>): an interactive map of the book's world. Places, characters and events unlock as the reader marks the chapters they have finished, so there are no spoilers.
- Character Chat (/chat/<id>): talk with characters the reader has already met; they only know the story up to the reader's chapter.
- Favorites (/favorites), My List (/my-list), Cart (/cart), Checkout (/checkout), Reader (/read/<id>) for owned or rented books, Login (/login).
- Payment at checkout is simulated in this version; no card details are collected. Only mention this if someone asks about payments.

The visitor is on: ${page.path}${page.title ? ` ("${page.title}")` : ""}. They are ${signedIn ? "signed in" : "not signed in"}.
Their cart: ${cart.length ? cart.join("; ") : "empty"}.
Their favorites: ${favorites.length ? favorites.join("; ") : "none yet"}.

The collection (id | title | author | year | vibes | price):
${catalog.map((b) => `${b.id} | ${b.title} | ${b.author} | ${b.year ?? ""} | ${b.vibes.join(", ")} | ${b.price}`).join("\n")}

How to answer:
- Keep it short and friendly: 1-4 sentences or a short list. Reply in the visitor's language.
- Only recommend books from the collection above. Link every book you mention as a markdown link to its page, like [The Hobbit](/item/<id>), and link pages the same way, like [By Vibe](/vibes). Never invent links or books.
- Don't spoil plots. Describe books by premise and mood only, unless the visitor explicitly asks for spoilers.
- If you don't know something about the site, say so and point to the closest page. You can't change the cart, place orders or edit accounts yourself; tell the visitor where to click instead.`;

app.post("/api/assistant", forEveryone, async (req, res) => {
  const parsed = AssistantRequest.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid assistant request." });
  const { messages, ...context } = parsed.data;
  await streamReply(res, "assistant", assistantSystem(context), messages);
});

app.listen(PORT, (err) => {
  if (err) {
    console.error(
      err.code === "EADDRINUSE"
        ? `Port ${PORT} is already in use. The AI server is probably already running in another terminal.`
        : `Could not start the AI server: ${err.message}`
    );
    process.exit(1);
  }
  console.log(`BookFlix AI server on http://localhost:${PORT} (Gemini ${ai ? `ready, model ${MODEL}` : "not configured"})`);
  console.log("Keep this window open. Start the website in another terminal with: npm.cmd start");
});
