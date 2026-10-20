// Note: once the Firestore security rules (firestore.rules) are published, only admins can change books,
// so these scripts stop working; add and edit books from the Admin page instead.
// Writes the `genres` list used by the genre filter on Home onto each book in Firestore (matched by title).
// Run from the project folder:  node scripts/seedGenres.mjs
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/firebase.js", import.meta.url), "utf8");
const config = Function(`return (${source.match(/firebaseConfig\s*=\s*(\{[\s\S]*?\});/)[1]})`)();
const db = getFirestore(initializeApp(config));

const FANTASY = "Fantasy";
const MYSTERY = "Mystery & Thriller";
const CLASSICS = "Classics";
const ROMANCE = "Romance";
const SCIFI = "Sci-Fi & Dystopia";
const LITERARY = "Literary Fiction";
const YA = "Young Adult";
const HISTORICAL = "Historical Fiction";
const NONFICTION = "Non-fiction";

// The first genre is the main one, shown on the book's card.
const GENRES = {
  "1984": [SCIFI, CLASSICS],
  "to kill a mockingbird": [CLASSICS, LITERARY],
  "the great gatsby": [CLASSICS, LITERARY],
  "harry potter and the philosopher's stone": [FANTASY, YA],
  "the alchemist": [LITERARY],
  "the little prince": [CLASSICS, FANTASY],
  "the catcher in the rye": [CLASSICS, LITERARY],
  "brave new world": [SCIFI, CLASSICS],
  "jane eyre": [CLASSICS, ROMANCE],
  "dune": [SCIFI],
  "the fellowship of the ring": [FANTASY, CLASSICS],
  "sapiens": [NONFICTION],
  "the book thief": [HISTORICAL, YA],
  "the kite runner": [LITERARY, HISTORICAL],
  "where the crawdads sing": [LITERARY, MYSTERY],
  "the midnight library": [LITERARY, FANTASY],
  "it ends with us": [ROMANCE],
  "the silent patient": [MYSTERY],
  "educated": [NONFICTION],
  "the seven husbands of evelyn hugo": [HISTORICAL, ROMANCE],
  "little women": [CLASSICS],
  "crime and punishment": [CLASSICS, LITERARY],
  "the hitchhiker's guide to the galaxy": [SCIFI],
  "gone girl": [MYSTERY],
  "the name of the wind": [FANTASY],
  "the hunger games": [SCIFI, YA],
  "atomic habits": [NONFICTION],
  "a little life": [LITERARY],
  "twilight": [ROMANCE, YA, FANTASY],
  "pride and prejudice": [CLASSICS, ROMANCE],
  "the hobbit": [FANTASY, CLASSICS],
  "mona's eyes": [LITERARY],
  "the cruel prince": [FANTASY, YA, ROMANCE],
  "the wicked king": [FANTASY, YA, ROMANCE],
  "the queen of nothing": [FANTASY, YA, ROMANCE],
  "how the king of elfhame learned to hate stories": [FANTASY, YA],
  "the hound of the baskervilles": [MYSTERY, CLASSICS],
  "murder on the orient express": [MYSTERY, CLASSICS],
  "and then there were none": [MYSTERY, CLASSICS],
  "the murder of roger ackroyd": [MYSTERY, CLASSICS],
  "the girl with the dragon tattoo": [MYSTERY],
  "the thursday murder club": [MYSTERY],
  "a good girl's guide to murder": [MYSTERY, YA],
  "the big sleep": [MYSTERY, CLASSICS],
  "the cuckoo's calling": [MYSTERY],
  "in the woods": [MYSTERY],
  "the da vinci code": [MYSTERY],
  "the name of the rose": [MYSTERY, HISTORICAL],
  "the no. 1 ladies' detective agency": [MYSTERY],
};

const snapshot = await getDocs(collection(db, "item"));
let tagged = 0;
for (const d of snapshot.docs) {
  const genres = GENRES[(d.data().title || "").trim().toLowerCase()];
  if (!genres) {
    console.log(`no genres for "${d.data().title}"`);
    continue;
  }
  await updateDoc(d.ref, { genres });
  tagged++;
}
console.log(`Tagged ${tagged} of ${snapshot.size} books.`);
process.exit(0);
