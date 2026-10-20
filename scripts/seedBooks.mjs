// Note: once the Firestore security rules (firestore.rules) are published, only admins can change books,
// so these scripts stop working; add and edit books from the Admin page instead.
// Adds a starter set of books to the "item" collection in Firestore.
// Books whose title already exists are skipped, so it is safe to run more than once.
// Run from the project folder:  node scripts/seedBooks.mjs
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";

// Reuse the config from src/firebase.js instead of duplicating it.
const source = readFileSync(new URL("../src/firebase.js", import.meta.url), "utf8");
const config = Function(`return (${source.match(/firebaseConfig\s*=\s*(\{[\s\S]*?\});/)[1]})`)();
const db = getFirestore(initializeApp(config));

const cover = (isbn) => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;

const books = [
  ["1984", "George Orwell", 1949, "9780451524935", "In a world of constant surveillance, Winston Smith dares to think for himself. A chilling classic about truth, power and freedom."],
  ["To Kill a Mockingbird", "Harper Lee", 1960, "9780061120084", "Through young Scout's eyes, a small Southern town faces prejudice and courage when her father defends an innocent man."],
  ["The Great Gatsby", "F. Scott Fitzgerald", 1925, "9780743273565", "Glittering parties, old longing and the American dream, seen through the summer Nick Carraway spends next door to Jay Gatsby."],
  ["Harry Potter and the Philosopher's Stone", "J.K. Rowling", 1997, "9780747532699", "On his eleventh birthday, Harry learns he is a wizard and steps into a world of magic, friendship and mystery at Hogwarts."],
  ["The Alchemist", "Paulo Coelho", 1988, "9780062315007", "A young shepherd crosses the desert in search of treasure and discovers what it means to follow your heart."],
  ["The Little Prince", "Antoine de Saint-Exupéry", 1943, "9780156012195", "A stranded pilot meets a small prince from another planet in a gentle, timeless tale about love and what truly matters."],
  ["The Catcher in the Rye", "J.D. Salinger", 1951, "9780316769488", "Holden Caulfield wanders New York for three days, searching for honesty in a world he finds painfully phony."],
  ["Brave New World", "Aldous Huxley", 1932, "9780060850524", "A perfectly engineered society where everyone is happy, until one outsider asks what that happiness has cost."],
  ["Jane Eyre", "Charlotte Brontë", 1847, "9780141441146", "An orphaned governess with a fierce spirit falls for the brooding Mr. Rochester, whose house hides a dark secret."],
  ["Dune", "Frank Herbert", 1965, "9780441172719", "On the desert planet Arrakis, young Paul Atreides is caught in a war over the most precious substance in the universe."],
  ["The Fellowship of the Ring", "J.R.R. Tolkien", 1954, "9780547928210", "Frodo inherits a ring of terrible power and sets out with eight companions on a quest to destroy it."],
  ["Sapiens", "Yuval Noah Harari", 2011, "9780062316097", "A sweeping, readable history of humankind, from foraging bands to empires, money and the modern world."],
  ["The Book Thief", "Markus Zusak", 2005, "9780375842207", "In Nazi Germany, a girl steals books and shares them with neighbors and the Jewish man hidden in her basement."],
  ["The Kite Runner", "Khaled Hosseini", 2003, "9781594631931", "A story of friendship, betrayal and redemption between two boys in Kabul, and the long road back to make things right."],
  ["Where the Crawdads Sing", "Delia Owens", 2018, "9780735219090", "Abandoned as a child, Kya grows up alone in the North Carolina marsh, until she becomes the suspect in a murder."],
  ["The Midnight Library", "Matt Haig", 2020, "9780525559474", "Between life and death lies a library of every life Nora could have lived. Which one is worth choosing?"],
  ["It Ends with Us", "Colleen Hoover", 2016, "9781501110368", "Lily's new love seems perfect, but old wounds and hard truths force her to make a brave choice."],
  ["The Silent Patient", "Alex Michaelides", 2019, "9781250301697", "A famous painter shoots her husband and never speaks again. A psychotherapist is determined to learn why."],
  ["Educated", "Tara Westover", 2018, "9780399590504", "Raised by survivalists in the mountains of Idaho, Tara never went to school, and then she taught herself her way to Cambridge."],
  ["The Seven Husbands of Evelyn Hugo", "Taylor Jenkins Reid", 2017, "9781501161933", "An aging Hollywood icon finally tells the truth about her glamorous life and the great love she kept hidden."],
  ["Little Women", "Louisa May Alcott", 1868, "9780147514011", "The four March sisters grow up through hardship, ambition and love in this warm, beloved family story."],
  ["Crime and Punishment", "Fyodor Dostoevsky", 1866, "9780143058144", "A poor student commits a murder he believes is justified, then is consumed by guilt and a relentless investigator."],
  ["The Hitchhiker's Guide to the Galaxy", "Douglas Adams", 1979, "9780345391803", "Seconds before Earth is demolished, Arthur Dent is whisked into space for a hilariously absurd galactic adventure."],
  ["Gone Girl", "Gillian Flynn", 2012, "9780307588371", "On their fifth anniversary, Amy disappears. As the media circles, her husband Nick looks more and more guilty."],
  ["The Name of the Wind", "Patrick Rothfuss", 2007, "9780756404741", "Kvothe, a legendary figure, tells the true story of his life, from traveling performer to the arcane university."],

  // The Folk of the Air series
  ["The Cruel Prince", "Holly Black", 2018, "9780316310277", "Mortal Jude was stolen away to the High Court of Faerie as a child. Now she wants a place there, even if it means crossing its cruelest prince, Cardan."],
  ["The Wicked King", "Holly Black", 2019, "9780316310352", "Jude holds power over the new High King of Elfhame, but keeping control of a scheming court and of Cardan is far harder than taking it."],
  ["The Queen of Nothing", "Holly Black", 2019, "9780316310420", "Exiled to the mortal world, Jude must find her way back to Elfhame as a threat rises against the crown, in the finale of the Folk of the Air trilogy."],
  ["How the King of Elfhame Learned to Hate Stories", "Holly Black", 2020, "9780316540889", "An illustrated companion novella that returns to Elfhame and tells Cardan's side of the story, from his childhood to the court he rules."],

  // Mysteries and detectives
  ["The Hound of the Baskervilles", "Arthur Conan Doyle", 1902, "9780141199177", "A legendary demon hound is said to haunt the Baskerville family on the misty moors. Sherlock Holmes and Dr. Watson take the case."],
  ["Murder on the Orient Express", "Agatha Christie", 1934, "9780062693662", "Snowbound on the famous train, Hercule Poirot finds a passenger stabbed in his locked compartment, and every traveler is a suspect."],
  ["And Then There Were None", "Agatha Christie", 1939, "9780062073488", "Ten strangers are lured to a lonely island, accused of past crimes, and begin to die one by one. Christie's most famous puzzle."],
  ["The Murder of Roger Ackroyd", "Agatha Christie", 1926, "9780062073563", "In a quiet English village, a wealthy man is found dead and retired detective Hercule Poirot is drawn into one of his most talked-about cases."],
  ["The Girl with the Dragon Tattoo", "Stieg Larsson", 2005, "9780307454546", "A disgraced journalist and a brilliant, guarded hacker investigate a forty-year-old disappearance within a powerful Swedish family."],
  ["The Thursday Murder Club", "Richard Osman", 2020, "9781984880963", "Four retirees who meet weekly to discuss cold cases find themselves with a real murder on their doorstep. Cozy, funny and clever."],
  ["A Good Girl's Guide to Murder", "Holly Jackson", 2019, "9781984896360", "For her school project, Pip reopens a closed local murder case, certain the boy everyone blamed was innocent."],
  ["The Big Sleep", "Raymond Chandler", 1939, "9780394758282", "Private detective Philip Marlowe is hired by a dying general and pulled into blackmail and murder in rain-soaked Los Angeles."],
  ["The Cuckoo's Calling", "Robert Galbraith", 2013, "9780316206853", "War veteran turned private eye Cormoran Strike and his new assistant Robin investigate a supermodel's fall from a London balcony."],
  ["In the Woods", "Tana French", 2007, "9780143113492", "A Dublin detective investigates a girl's murder in the same woods where, as a child, his two friends vanished and he was found alone."],
  ["The Da Vinci Code", "Dan Brown", 2003, "9780307474278", "A murder in the Louvre sends symbologist Robert Langdon on a race through Paris and London, decoding clues hidden in famous art."],
  ["The Name of the Rose", "Umberto Eco", 1980, "9780544176560", "In a remote medieval abbey, Brother William of Baskerville investigates a series of mysterious deaths among the monks."],
  ["The No. 1 Ladies' Detective Agency", "Alexander McCall Smith", 1998, "9781400034772", "Precious Ramotswe opens Botswana's first female-run detective agency and solves everyday mysteries with wisdom and warmth."],
];

const snapshot = await getDocs(collection(db, "item"));
const existing = new Set(snapshot.docs.map((d) => (d.data().title || "").trim().toLowerCase()));

let added = 0;
for (const [title, author, year, isbn, description] of books) {
  if (existing.has(title.toLowerCase())) {
    console.log(`skip   ${title} (already exists)`);
    continue;
  }
  await addDoc(collection(db, "item"), {
    title,
    author,
    year,
    type: "Book",
    description,
    coverUrl: cover(isbn),
    progress: 0,
    createdAt: new Date(),
  });
  console.log(`added  ${title}`);
  added++;
}

console.log(`\nDone: ${added} added, ${books.length - added} skipped.`);
process.exit(0);
