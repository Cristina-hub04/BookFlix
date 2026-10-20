// Browser side of the AI features. Requests go to the local AI server (server/index.mjs)
// through the dev proxy, so the API key never reaches the browser.
import { auth } from "./firebase";

const readError = async (res) => {
  try {
    return (await res.json()).error || `Request failed (${res.status})`;
  } catch {
    return res.status === 504 || res.status === 500
      ? "The AI server isn't running. Start it with: npm.cmd run server"
      : `Request failed (${res.status})`;
  }
};

// Every request carries the signed-in reader's Firebase ID token so the server knows who is asking.
async function post(url, payload) {
  await auth.authStateReady(); // right after a page load, Firebase may still be restoring the session
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res;
}

// Returns "ready", "no-key" or "offline".
export async function aiStatus() {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) return "offline";
    return (await res.json()).ai ? "ready" : "no-key";
  } catch {
    return "offline";
  }
}

export const fetchWorld = async (book) =>
  (await post("/api/world", { title: book.title, author: book.author || book.director, description: book.description })).json();

// Plot Detective: the suspects and clues of a mystery, tagged by chapter.
export const fetchCase = async (book, chapters) =>
  (await post("/api/case", { title: book.title, author: book.author || book.director, chapters })).json();

// Plot Detective: compares the reader's theory with the real solution.
export const revealCase = async (payload) => (await post("/api/case/reveal", payload)).json();

// Streams the character's reply, calling onText with each new piece of text.
export const streamChat = (payload, onText) => streamText("/api/chat", payload, onText);

// Streams the site assistant's reply.
export const streamAssistant = (payload, onText) => streamText("/api/assistant", payload, onText);

async function streamText(url, payload, onText) {
  const res = await post(url, payload);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onText(decoder.decode(value, { stream: true }));
  }
}
// Everything the reader has unlocked so far, as plain text for the character's memory.
export function knownSoFar(world, chapter) {
  if (!world) return "";
  const events = world.events
    .filter((e) => e.revealChapter <= chapter)
    .sort((a, b) => a.revealChapter - b.revealChapter)
    .map((e) => `- (chapter ${e.revealChapter}) ${e.title}: ${e.description}`);
  return [`Premise: ${world.premise}`, ...events].join("\n");
}
