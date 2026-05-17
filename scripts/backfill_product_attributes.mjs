import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, "..", "verdant.db"));

// --- Lookup tables ------------------------------------------------------

// pname keyword → days. First match wins, ordered most-specific first.
const LIFESPAN_RULES = [
  [/hair mask|masque|hair repair/i, 90],
  [/hair oil|oil$/i, 60],
  [/serum/i, 75],
  [/conditioner/i, 40],
  [/shampoo|cleanser/i, 35],
  [/spray|vitalizer/i, 45],
  [/henna|indigo|powder/i, 60],
];
const DEFAULT_LIFESPAN = 45;

// problem_tags token → canonical concern tag (see backend/validators.ts §6 vocab).
// Unknown tags are dropped (not propagated as concerns).
const LEGACY_TAG_TO_CONCERN = {
  "hair-fall": "hairfall",
  "weak-roots": "hairfall",
  "weak-hair": "hairfall",
  "thin-hair": "thin-hair",
  "hair-volume": "thin-hair",
  "dandruff": "dandruff",
  "anti-dandruff": "dandruff",
  "itchy-scalp": "itchy-scalp",
  "dry-hair": "dryness",
  "dry-scalp": "dryness",
  "rough-hair": "dryness",
  "moisturizing": "dryness",
  "dull-hair": "dullness",
  "shine": "dullness",
  "frizz-control": "frizz",
  "grey-hair": "grey-hair",
  "damaged-hair": "damaged-hair",
  "hair-repair": "damaged-hair",
  "deep-conditioning": "damaged-hair",
  "scalp-care": "itchy-scalp",
  "scalp-buildup": "flakiness",
};

// Keywords (in pname + description) → canonical ingredient tag.
const INGREDIENT_KEYWORDS = {
  "bhringraj": "bhringraj",
  "onion": "onion",
  "amla": "amla",
  "neem": "neem",
  "tea tree": "tea-tree",
  "aloe": "aloe",
  "argan": "argan",
  "coconut": "coconut",
  "rosemary": "rosemary",
  "shikakai": "shikakai",
  "henna": "henna",
  "indigo": "indigo",
  "brahmi": "brahmi",
  "hibiscus": "hibiscus",
  "castor": "castor",
  "biotin": "biotin",
};

// --- Derivation helpers -------------------------------------------------

function lifespanFor(pname) {
  for (const [re, days] of LIFESPAN_RULES) if (re.test(pname)) return days;
  return DEFAULT_LIFESPAN;
}

function concernsFor(problemTags) {
  if (!problemTags) return [];
  const out = new Set();
  for (const raw of problemTags.split(",")) {
    const tag = raw.trim().toLowerCase();
    const mapped = LEGACY_TAG_TO_CONCERN[tag];
    if (mapped) out.add(mapped);
  }
  return [...out];
}

function ingredientsFor(pname, description) {
  const hay = `${pname || ""} ${description || ""}`.toLowerCase();
  const out = new Set();
  for (const [needle, tag] of Object.entries(INGREDIENT_KEYWORDS)) {
    if (hay.includes(needle)) out.add(tag);
  }
  return [...out];
}

// --- Run ----------------------------------------------------------------

const rows = db.prepare(
  "SELECT id, pname, description, problem_tags, category, average_lifespan_days, target_concerns, ingredients, seasonal FROM products"
).all();

const upd = db.prepare(`
  UPDATE products
     SET average_lifespan_days = COALESCE(average_lifespan_days, ?),
         target_concerns       = COALESCE(target_concerns, ?),
         ingredients           = COALESCE(ingredients, ?),
         seasonal              = COALESCE(seasonal, ?),
         stock_level           = COALESCE(stock_level, 100)
   WHERE id = ?
`);

let updated = 0;
const tx = db.transaction((items) => {
  for (const p of items) {
    upd.run(
      lifespanFor(p.pname),
      JSON.stringify(concernsFor(p.problem_tags)),
      JSON.stringify(ingredientsFor(p.pname, p.description)),
      "all-year",
      p.id,
    );
    updated++;
  }
});
tx(rows);

console.log(`Backfilled ${updated} product rows (existing non-null values preserved).`);

const sample = db.prepare(
  "SELECT id, pname, average_lifespan_days, target_concerns, ingredients FROM products LIMIT 5"
).all();
console.log("Sample:", JSON.stringify(sample, null, 2));

db.close();
