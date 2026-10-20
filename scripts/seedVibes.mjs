// Note: once the Firestore security rules (firestore.rules) are published, only admins can change books,
// so these scripts stop working; add and edit books from the Admin page instead.
// Writes the `vibes` tags used by "Book by Vibe" onto each book in Firestore (matched by title).
// Labels must come from src/vibes.js. Run from the project folder:  node scripts/seedVibes.mjs
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/firebase.js", import.meta.url), "utf8");
const config = Function(`return (${source.match(/firebaseConfig\s*=\s*(\{[\s\S]*?\});/)[1]})`)();
const db = getFirestore(initializeApp(config));

const VIBES = {
  "1984": ["city at night", "rain", "dark", "tense", "solitude", "rebellion", "unsettling", "thought-provoking"],
  "to kill a mockingbird": ["small town", "summer heat", "coming of age", "hopeful", "melancholic", "family", "tense"],
  "the great gatsby": ["summer heat", "city at night", "melancholic", "romantic", "obsession", "ambition", "dreamy"],
  "harry potter and the philosopher's stone": ["school & academia", "cozy", "faraway worlds", "friendship", "found family", "mystery", "coming of age", "snow & winter"],
  "the alchemist": ["desert", "journey", "dreamy", "hopeful", "self-discovery", "solitude"],
  "the little prince": ["faraway worlds", "desert", "dreamy", "melancholic", "friendship", "journey", "solitude"],
  "the catcher in the rye": ["city at night", "snow & winter", "solitude", "melancholic", "coming of age", "grief"],
  "brave new world": ["city at night", "unsettling", "dark", "rebellion", "thought-provoking"],
  "jane eyre": ["old houses", "countryside", "rain", "romantic", "mystery", "solitude", "self-discovery"],
  "dune": ["desert", "faraway worlds", "epic", "tense", "survival", "ambition", "coming of age"],
  "the fellowship of the ring": ["faraway worlds", "wild nature", "epic", "journey", "friendship", "found family", "snow & winter"],
  "sapiens": ["thought-provoking", "epic", "survival", "ambition"],
  "the book thief": ["snow & winter", "small town", "melancholic", "grief", "found family", "hopeful", "dark"],
  "the kite runner": ["summer heat", "melancholic", "grief", "friendship", "coming of age", "tense"],
  "where the crawdads sing": ["wild nature", "seaside", "solitude", "mystery", "romantic", "survival", "coming of age"],
  "the midnight library": ["dreamy", "hopeful", "melancholic", "self-discovery", "solitude", "thought-provoking", "cozy"],
  "it ends with us": ["city at night", "romantic", "tense", "self-discovery", "grief", "melancholic"],
  "the silent patient": ["city at night", "rain", "mystery", "tense", "unsettling", "obsession", "dark"],
  "educated": ["wild nature", "countryside", "school & academia", "survival", "self-discovery", "coming of age", "hopeful", "family"],
  "the seven husbands of evelyn hugo": ["city at night", "romantic", "ambition", "melancholic", "obsession", "dreamy"],
  "little women": ["cozy", "snow & winter", "countryside", "family", "hopeful", "coming of age", "romantic"],
  "crime and punishment": ["city at night", "summer heat", "dark", "tense", "solitude", "obsession", "thought-provoking"],
  "the hitchhiker's guide to the galaxy": ["faraway worlds", "funny", "journey", "friendship", "thought-provoking"],
  "gone girl": ["small town", "summer heat", "tense", "unsettling", "mystery", "obsession", "dark"],
  "the name of the wind": ["school & academia", "faraway worlds", "epic", "coming of age", "mystery", "journey", "cozy", "rain"],
  "the hunger games": ["wild nature", "survival", "rebellion", "tense", "dark", "coming of age", "epic"],
  "atomic habits": ["hopeful", "self-discovery", "ambition", "thought-provoking"],
  "a little life": ["city at night", "melancholic", "dark", "grief", "friendship", "found family"],
  "twilight": ["rain", "small town", "romantic", "mystery", "wild nature", "dreamy", "coming of age"],
  "pride and prejudice": ["countryside", "old houses", "romantic", "funny", "cozy", "family", "self-discovery"],
  "the hobbit": ["faraway worlds", "wild nature", "journey", "cozy", "epic", "friendship", "funny"],
  "mona's eyes": ["city at night", "cozy", "hopeful", "family", "thought-provoking", "dreamy", "journey"],

  "the cruel prince": ["faraway worlds", "dark", "romantic", "tense", "ambition", "rebellion", "found family"],
  "the wicked king": ["faraway worlds", "dark", "romantic", "tense", "ambition", "obsession"],
  "the queen of nothing": ["faraway worlds", "romantic", "epic", "tense", "ambition", "family"],
  "how the king of elfhame learned to hate stories": ["faraway worlds", "dreamy", "romantic", "melancholic", "coming of age"],
  "the hound of the baskervilles": ["mystery", "countryside", "old houses", "unsettling", "tense", "friendship"],
  "murder on the orient express": ["mystery", "snow & winter", "tense", "journey", "thought-provoking"],
  "and then there were none": ["mystery", "seaside", "old houses", "unsettling", "tense", "dark"],
  "the murder of roger ackroyd": ["mystery", "small town", "countryside", "old houses", "tense", "thought-provoking"],
  "the girl with the dragon tattoo": ["mystery", "snow & winter", "dark", "tense", "obsession", "family"],
  "the thursday murder club": ["mystery", "cozy", "funny", "friendship", "countryside", "hopeful"],
  "a good girl's guide to murder": ["mystery", "small town", "school & academia", "tense", "coming of age", "obsession"],
  "the big sleep": ["mystery", "city at night", "rain", "dark", "tense", "solitude"],
  "the cuckoo's calling": ["mystery", "city at night", "rain", "tense", "friendship", "ambition"],
  "in the woods": ["mystery", "wild nature", "dark", "melancholic", "unsettling", "grief"],
  "the da vinci code": ["mystery", "city at night", "tense", "journey", "thought-provoking"],
  "the name of the rose": ["mystery", "old houses", "snow & winter", "dark", "thought-provoking", "school & academia"],
  "the no. 1 ladies' detective agency": ["mystery", "cozy", "summer heat", "funny", "hopeful", "self-discovery"],
};

const snapshot = await getDocs(collection(db, "item"));
let tagged = 0;
for (const d of snapshot.docs) {
  const vibes = VIBES[(d.data().title || "").trim().toLowerCase()];
  if (!vibes) {
    console.log(`no vibes for "${d.data().title}"`);
    continue;
  }
  await updateDoc(d.ref, { vibes });
  tagged++;
}
console.log(`Tagged ${tagged} of ${snapshot.size} books.`);
process.exit(0);
