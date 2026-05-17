import fs from "fs";
import path from "path";

class SeededRandom {
  constructor(seed = 123456789) {
    this.seed = seed >>> 0;
  }

  next() {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  int(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick(arr) {
    return arr[this.int(0, arr.length - 1)];
  }

  weightedPick(weightedItems) {
    const total = weightedItems.reduce((sum, item) => sum + item.weight, 0);
    let roll = this.next() * total;
    for (const item of weightedItems) {
      roll -= item.weight;
      if (roll <= 0) return item.value;
    }
    return weightedItems[weightedItems.length - 1].value;
  }
}

const rng = new SeededRandom(20260411);

const REQUIRED_COUNTS = {
  products: 100,
  customers: 220,
  transactions: 1500,
};

const marketingTags = ["Popular", "Best Seller", "Refill", "New", "Top Rated"];

const hairProducts = [
  ["Neem Anti-Dandruff Shampoo", "shampoo", 329, ["dandruff", "dry scalp", "herbal", "chemical-free"]],
  ["Tea Tree Scalp Balance Shampoo", "shampoo", 349, ["dandruff", "oily scalp", "organic", "chemical-free"]],
  ["Amla Hairfall Control Shampoo", "shampoo", 339, ["hairfall", "weak roots", "herbal", "organic"]],
  ["Hibiscus Repair Shampoo", "shampoo", 359, ["hairfall", "dry scalp", "organic", "chemical-free"]],
  ["Bhringraj Daily Gentle Shampoo", "shampoo", 319, ["hairfall", "dry scalp", "herbal", "organic"]],

  ["Onion Hair Oil", "oil", 399, ["hairfall", "weak roots", "herbal", "organic"]],
  ["Bhringraj Hair Growth Oil", "oil", 429, ["hairfall", "dry scalp", "chemical-free", "organic"]],
  ["Coconut Hibiscus Nourish Hair Oil", "oil", 389, ["dry scalp", "frizz", "herbal", "organic"]],
  ["Almond Vitamin Hair Strength Oil", "oil", 449, ["hairfall", "dry scalp", "organic", "chemical-free"]],
  ["Amla Brahmi Scalp Therapy Oil", "oil", 419, ["dandruff", "dry scalp", "herbal", "chemical-free"]],

  ["Methi Smooth Conditioner", "conditioner", 329, ["dry scalp", "frizz", "organic", "chemical-free"]],
  ["Keratin Herb Repair Conditioner", "conditioner", 369, ["hairfall", "dry scalp", "organic", "chemical-free"]],
  ["Coconut Milk Soft Conditioner", "conditioner", 349, ["dry scalp", "frizz", "herbal", "organic"]],
  ["Argan Shine Conditioner", "conditioner", 389, ["dry scalp", "dull hair", "organic", "chemical-free"]],
  ["Aloe Vera Moisture Conditioner", "conditioner", 339, ["dry scalp", "sensitive scalp", "herbal", "chemical-free"]],

  ["Biotin Root Strength Serum", "serum", 479, ["hairfall", "weak roots", "organic", "chemical-free"]],
  ["Redensyl Hair Growth Serum", "serum", 599, ["hairfall", "thinning", "chemical-free", "organic"]],
  ["Bamboo Peptide Hair Serum", "serum", 529, ["hairfall", "frizz", "herbal", "organic"]],
  ["Caffeine Scalp Booster Serum", "serum", 549, ["hairfall", "oily scalp", "chemical-free", "organic"]],
  ["Rosemary Root Activator Serum", "serum", 569, ["hairfall", "dandruff", "herbal", "organic"]],

  ["Fenugreek Repair Hair Mask", "mask", 449, ["dry scalp", "damage", "herbal", "organic"]],
  ["Banana Protein Hair Mask", "mask", 429, ["dry scalp", "frizz", "organic", "chemical-free"]],
  ["Onion Keratin Hair Mask", "mask", 469, ["hairfall", "damage", "herbal", "organic"]],
  ["Aloe Coconut Deep Moisture Mask", "mask", 439, ["dry scalp", "dull hair", "organic", "chemical-free"]],
  ["Brahmi Scalp Calm Mask", "mask", 459, ["dandruff", "sensitive scalp", "herbal", "chemical-free"]],
];

const faceProducts = [
  ["Aloe Vera Face Wash", "face_wash", 289, ["acne", "oily skin", "herbal", "chemical-free"]],
  ["Neem Acne Control Face Wash", "face_wash", 299, ["acne", "oily skin", "organic", "chemical-free"]],
  ["Saffron Glow Face Wash", "face_wash", 319, ["glow", "dry skin", "herbal", "organic"]],
  ["Green Tea Pore Clean Face Wash", "face_wash", 309, ["acne", "oily skin", "organic", "chemical-free"]],
  ["Rose Milk Hydrating Face Wash", "face_wash", 329, ["dry skin", "glow", "herbal", "organic"]],

  ["Ceramide Daily Moisturizer", "moisturizer", 379, ["dry skin", "barrier repair", "chemical-free", "organic"]],
  ["Vitamin C Glow Moisturizer", "moisturizer", 399, ["glow", "dull skin", "organic", "chemical-free"]],
  ["Oil Free Mattifying Moisturizer", "moisturizer", 389, ["oily skin", "acne", "organic", "chemical-free"]],
  ["Aloe Gel Moisturizer", "moisturizer", 349, ["dry skin", "sensitive skin", "herbal", "organic"]],
  ["Sandalwood Night Moisturizer", "moisturizer", 419, ["dry skin", "glow", "herbal", "organic"]],

  ["Niacinamide 10 Serum", "serum", 549, ["acne", "oily skin", "chemical-free", "organic"]],
  ["Vitamin C 15 Brightening Serum", "serum", 579, ["glow", "dull skin", "organic", "chemical-free"]],
  ["Hyaluronic Deep Hydration Serum", "serum", 529, ["dry skin", "glow", "chemical-free", "organic"]],
  ["Tea Tree Acne Relief Serum", "serum", 559, ["acne", "oily skin", "herbal", "organic"]],
  ["Kumkumadi Radiance Serum", "serum", 619, ["glow", "dry skin", "herbal", "organic"]],

  ["Rose Water Pore Tightening Toner", "toner", 269, ["oily skin", "acne", "herbal", "organic"]],
  ["Green Tea Clarifying Toner", "toner", 279, ["acne", "oily skin", "organic", "chemical-free"]],
  ["Cucumber Hydration Toner", "toner", 289, ["dry skin", "glow", "herbal", "organic"]],
  ["Rice Water Glow Toner", "toner", 299, ["glow", "dry skin", "organic", "chemical-free"]],
  ["Witch Hazel Balance Toner", "toner", 309, ["oily skin", "acne", "chemical-free", "organic"]],

  ["Mineral Sunscreen SPF 30", "sunscreen", 449, ["dry skin", "sensitive skin", "chemical-free", "organic"]],
  ["Matte Sunscreen Gel SPF 50", "sunscreen", 499, ["oily skin", "acne", "chemical-free", "organic"]],
  ["Dewy Sunscreen Fluid SPF 40", "sunscreen", 469, ["dry skin", "glow", "organic", "chemical-free"]],
  ["Tinted Sunscreen SPF 35", "sunscreen", 519, ["glow", "dry skin", "organic", "chemical-free"]],
  ["Aloe Zinc Sunscreen SPF 45", "sunscreen", 489, ["acne", "oily skin", "herbal", "organic"]],
];

const bodyProducts = [
  ["Neem Herbal Body Wash", "body_wash", 299, ["dry skin", "body acne", "herbal", "chemical-free"]],
  ["Lavender Calm Body Wash", "body_wash", 319, ["dry skin", "glow", "organic", "chemical-free"]],
  ["Charcoal Detox Body Wash", "body_wash", 329, ["body acne", "oily skin", "organic", "chemical-free"]],
  ["Milk Honey Soft Body Wash", "body_wash", 339, ["dry skin", "glow", "herbal", "organic"]],
  ["Citrus Refresh Body Wash", "body_wash", 309, ["dull skin", "oily skin", "organic", "chemical-free"]],

  ["Cocoa Deep Moisture Body Lotion", "body_lotion", 349, ["dry skin", "rough skin", "organic", "chemical-free"]],
  ["Shea Butter Repair Body Lotion", "body_lotion", 369, ["dry skin", "rough skin", "herbal", "organic"]],
  ["Aloe Daily Light Body Lotion", "body_lotion", 339, ["dry skin", "sensitive skin", "chemical-free", "organic"]],
  ["Saffron Glow Body Lotion", "body_lotion", 389, ["glow", "dull skin", "herbal", "organic"]],
  ["Ubtan Radiance Body Lotion", "body_lotion", 399, ["glow", "dry skin", "herbal", "chemical-free"]],

  ["Coffee Exfoliating Body Scrub", "body_scrub", 429, ["dull skin", "rough skin", "organic", "chemical-free"]],
  ["Walnut Brightening Body Scrub", "body_scrub", 439, ["glow", "dull skin", "herbal", "organic"]],
  ["Sea Salt Detox Body Scrub", "body_scrub", 419, ["oily skin", "rough skin", "organic", "chemical-free"]],
  ["Sugar Almond Body Scrub", "body_scrub", 409, ["dry skin", "rough skin", "herbal", "organic"]],
  ["Turmeric Glow Body Scrub", "body_scrub", 449, ["glow", "dull skin", "herbal", "organic"]],

  ["Lavender Bath Salt", "bath_salt", 359, ["dry skin", "stress relief", "herbal", "organic"]],
  ["Eucalyptus Muscle Ease Bath Salt", "bath_salt", 379, ["dry skin", "stress relief", "organic", "chemical-free"]],
  ["Rose Petal Soak Bath Salt", "bath_salt", 369, ["glow", "dry skin", "herbal", "organic"]],
  ["Mint Detox Bath Salt", "bath_salt", 349, ["oily skin", "dull skin", "organic", "chemical-free"]],
  ["Chamomile Calm Bath Salt", "bath_salt", 389, ["dry skin", "sensitive skin", "herbal", "organic"]],

  ["Herbal Roll-On Deodorant", "deodorant", 279, ["body odor", "sensitive skin", "herbal", "chemical-free"]],
  ["Lemongrass Natural Deodorant", "deodorant", 289, ["body odor", "oily skin", "organic", "chemical-free"]],
  ["Tea Tree Active Deodorant", "deodorant", 299, ["body odor", "body acne", "organic", "chemical-free"]],
  ["Sandal Fresh Deodorant", "deodorant", 309, ["body odor", "dry skin", "herbal", "organic"]],
  ["Aloe Zinc Deodorant", "deodorant", 319, ["body odor", "sensitive skin", "chemical-free", "organic"]],
];

const oralProducts = [
  ["Herbal Clove Toothpaste", "toothpaste", 149, ["gum care", "sensitive teeth", "herbal", "chemical-free"]],
  ["Neem Mint Toothpaste", "toothpaste", 159, ["gum care", "bad breath", "organic", "chemical-free"]],
  ["Charcoal Whitening Toothpaste", "toothpaste", 169, ["stains", "bad breath", "organic", "chemical-free"]],
  ["Sensitive Care Toothpaste", "toothpaste", 179, ["sensitive teeth", "gum care", "chemical-free", "organic"]],
  ["Salt Lemon Toothpaste", "toothpaste", 139, ["gum care", "bad breath", "herbal", "organic"]],

  ["Bamboo Soft Toothbrush", "toothbrush", 99, ["gum care", "herbal", "organic", "chemical-free"]],
  ["Bamboo Medium Toothbrush", "toothbrush", 99, ["gum care", "organic", "chemical-free", "bad breath"]],
  ["Activated Charcoal Toothbrush", "toothbrush", 119, ["stains", "gum care", "organic", "chemical-free"]],
  ["Sensitive Bristle Toothbrush", "toothbrush", 109, ["sensitive teeth", "gum care", "organic", "chemical-free"]],
  ["Kids Herbal Toothbrush", "toothbrush", 89, ["gum care", "herbal", "chemical-free", "organic"]],

  ["Fresh Mint Mouthwash", "mouthwash", 219, ["bad breath", "gum care", "organic", "chemical-free"]],
  ["Clove Gum Shield Mouthwash", "mouthwash", 229, ["gum care", "sensitive teeth", "herbal", "organic"]],
  ["Tea Tree Oral Rinse", "mouthwash", 239, ["bad breath", "gum care", "organic", "chemical-free"]],
  ["Alcohol-Free Daily Mouthwash", "mouthwash", 249, ["sensitive teeth", "bad breath", "chemical-free", "organic"]],
  ["Salt Herbal Mouthwash", "mouthwash", 209, ["gum care", "bad breath", "herbal", "chemical-free"]],

  ["Ayurvedic Gum Gel", "gum_gel", 189, ["gum care", "sensitive teeth", "herbal", "organic"]],
  ["Clove Pain Relief Gum Gel", "gum_gel", 199, ["sensitive teeth", "gum care", "chemical-free", "organic"]],
  ["Turmeric Gum Protection Gel", "gum_gel", 209, ["gum care", "bad breath", "herbal", "organic"]],
  ["Neem Gum Repair Gel", "gum_gel", 219, ["gum care", "sensitive teeth", "organic", "chemical-free"]],
  ["Mint Fresh Gum Gel", "gum_gel", 179, ["bad breath", "gum care", "herbal", "chemical-free"]],

  ["Cold Pressed Oil Pulling Oil", "oil_pulling", 279, ["gum care", "bad breath", "herbal", "organic"]],
  ["Coconut Clove Oil Pulling", "oil_pulling", 289, ["gum care", "sensitive teeth", "organic", "chemical-free"]],
  ["Sesame Herbal Oil Pulling", "oil_pulling", 269, ["gum care", "bad breath", "herbal", "organic"]],
  ["Mint Detox Oil Pulling", "oil_pulling", 299, ["bad breath", "stains", "organic", "chemical-free"]],
  ["Neem Defense Oil Pulling", "oil_pulling", 309, ["gum care", "sensitive teeth", "herbal", "chemical-free"]],
];

function buildProducts() {
  const allRaw = [
    ...hairProducts.map((p) => ({ ...rowToProduct(p, "Hair") })),
    ...faceProducts.map((p) => ({ ...rowToProduct(p, "Face") })),
    ...bodyProducts.map((p) => ({ ...rowToProduct(p, "Body") })),
    ...oralProducts.map((p) => ({ ...rowToProduct(p, "Oral") })),
  ];

  return allRaw.map((p, idx) => ({
    id: idx + 1,
    ...p,
    tag: marketingTags[(idx + rng.int(0, 3)) % marketingTags.length],
    image: `https://images.unsplash.com/photo-${1600000000000 + idx}?q=80&w=800&auto=format&fit=crop`,
  }));
}

function rowToProduct(row, category) {
  const [name, kind, price, tags] = row;
  return {
    name,
    category,
    kind,
    price,
    description: `${name} for daily ${category.toLowerCase()} care with plant-based actives.`,
    problem_tags: tags.join(","),
    tags,
  };
}

const maleFirstNames = [
  "Aarav", "Vivaan", "Aditya", "Arjun", "Karthik", "Rohan", "Rahul", "Ishaan", "Yash", "Dhruv",
  "Aniket", "Pranav", "Siddharth", "Varun", "Nikhil", "Harsh", "Kabir", "Atharv", "Manav", "Shivam",
  "Ayaan", "Dev", "Reyansh", "Krish", "Tanish", "Om", "Saurabh", "Sandeep", "Ritesh", "Amit",
  "Nitin", "Ravindra", "Uday", "Hemant", "Anirudh", "Tejas", "Himanshu", "Gaurav", "Mihir", "Vikram",
  "Rajat", "Abhinav", "Naveen", "Ashwin", "Deepak", "Tarun", "Madhav", "Raghav", "Chirag", "Mohan",
  "Puneet", "Vivek", "Anand", "Saket", "Harit", "Jatin", "Mayank", "Pratik", "Sumeet", "Rudra",
];

const femaleFirstNames = [
  "Aanya", "Ananya", "Ishita", "Diya", "Kavya", "Pooja", "Neha", "Riya", "Sneha", "Meera",
  "Nandini", "Tanvi", "Radhika", "Saanvi", "Kiara", "Avni", "Manya", "Anika", "Prisha", "Myra",
  "Shruti", "Swati", "Priya", "Komal", "Shreya", "Ritu", "Aditi", "Harini", "Bhavna", "Pallavi",
  "Suhani", "Navya", "Ira", "Mahima", "Payal", "Trisha", "Charvi", "Khushi", "Rupali", "Nikita",
  "Roshni", "Simran", "Anushka", "Jhanvi", "Vidhi", "Saloni", "Yamini", "Mitali", "Damini", "Tanya",
  "Muskan", "Sakshi", "Esha", "Vaishnavi", "Rekha", "Deepa", "Sonali", "Pari", "Anvi", "Gauri",
];

const lastNames = [
  "Sharma", "Verma", "Patel", "Gupta", "Singh", "Yadav", "Mishra", "Joshi", "Nair", "Reddy",
  "Iyer", "Kulkarni", "Choudhary", "Malhotra", "Bansal", "Ghosh", "Saxena", "Agarwal", "Khan", "Kapoor",
  "Sinha", "Dubey", "Mehta", "Das", "Thakur", "Tripathi", "Rana", "Pillai", "Menon", "Kaur",
  "Bhardwaj", "Rawat", "Chauhan", "Desai", "Pandey", "Tiwari", "Khanna", "Bose", "Jain", "Puri",
];

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
}

function buildCustomers(count) {
  const customers = [];
  const usedEmails = new Set();

  for (let id = 1; id <= count; id += 1) {
    const gender = rng.next() < 0.52 ? "Male" : "Female";
    const first = gender === "Male" ? rng.pick(maleFirstNames) : rng.pick(femaleFirstNames);
    const last = rng.pick(lastNames);
    const name = `${first} ${last}`;

    let email;
    let tries = 0;
    do {
      tries += 1;
      const suffix = String(id).padStart(3, "0");
      const extra = tries > 1 ? String(rng.int(10, 99)) : "";
      email = `${slugify(first)}.${slugify(last)}${suffix}${extra}@example.in`;
    } while (usedEmails.has(email));

    usedEmails.add(email);

    customers.push({
      id,
      name,
      email,
      password: "Password@123",
      gender,
    });
  }

  return customers;
}

function partitionProducts(products) {
  const byCategory = {
    Hair: [],
    Face: [],
    Body: [],
    Oral: [],
  };

  const byKind = {};

  for (const product of products) {
    byCategory[product.category].push(product);
    if (!byKind[product.kind]) byKind[product.kind] = [];
    byKind[product.kind].push(product);
  }

  return { byCategory, byKind };
}

function chooseProfile() {
  const primary = rng.weightedPick([
    { value: "Hair", weight: 36 },
    { value: "Face", weight: 34 },
    { value: "Body", weight: 18 },
    { value: "Oral", weight: 12 },
  ]);

  const others = ["Hair", "Face", "Body", "Oral"].filter((c) => c !== primary);
  const secondary = rng.pick(others);

  const concernByCategory = {
    Hair: ["hairfall", "dandruff", "dry scalp"],
    Face: ["acne", "oily skin", "dry skin", "glow"],
    Body: ["dry skin", "glow"],
    Oral: ["gum care", "sensitive teeth", "bad breath"],
  };

  const concerns = [
    rng.pick(concernByCategory[primary]),
    rng.pick(concernByCategory[secondary]),
  ];

  return { primary, secondary, concerns };
}

function pickByKind(productsByKind, kind, preferredTags, fallbackCategory) {
  const pool = productsByKind[kind] || [];
  if (pool.length === 0) return null;

  const prioritized = pool.filter((p) => {
    if (fallbackCategory && p.category !== fallbackCategory) return false;
    return preferredTags.some((tag) => p.tags.includes(tag));
  });

  const source = prioritized.length > 0 ? prioritized : pool.filter((p) => !fallbackCategory || p.category === fallbackCategory);
  return source.length > 0 ? rng.pick(source) : rng.pick(pool);
}

function buildCustomerPreferences(customers, products) {
  const { byCategory, byKind } = partitionProducts(products);

  const categoryKindMap = {
    Hair: ["oil", "shampoo", "conditioner", "serum", "mask"],
    Face: ["face_wash", "moisturizer", "serum", "toner", "sunscreen"],
    Body: ["body_wash", "body_lotion", "body_scrub", "bath_salt", "deodorant"],
    Oral: ["toothpaste", "toothbrush", "mouthwash", "gum_gel", "oil_pulling"],
  };

  return customers.map((customer) => {
    const profile = chooseProfile();
    const favorites = {};

    for (const category of [profile.primary, profile.secondary]) {
      const kinds = categoryKindMap[category];
      for (const kind of kinds) {
        const selected = pickByKind(byKind, kind, profile.concerns, category);
        if (selected) favorites[kind] = selected.id;
      }
    }

    return {
      ...customer,
      profile,
      favorites,
      availableByCategory: byCategory,
      availableByKind: byKind,
    };
  });
}

function buildTransactionCounts(customerCount, target) {
  const counts = Array.from({ length: customerCount }, () => rng.int(4, 9));
  let sum = counts.reduce((a, b) => a + b, 0);

  while (sum < target) {
    const idx = rng.int(0, counts.length - 1);
    if (counts[idx] < 12) {
      counts[idx] += 1;
      sum += 1;
    }
  }

  while (sum > target) {
    const idx = rng.int(0, counts.length - 1);
    if (counts[idx] > 3) {
      counts[idx] -= 1;
      sum -= 1;
    }
  }

  return counts;
}

function pickCategoryForOrder(profile) {
  return rng.weightedPick([
    { value: profile.primary, weight: 55 },
    { value: profile.secondary, weight: 28 },
    { value: "Hair", weight: 7 },
    { value: "Face", weight: 6 },
    { value: "Body", weight: 3 },
    { value: "Oral", weight: 1 },
  ]);
}

const comboTemplates = {
  Hair: [
    ["oil", "shampoo"],
    ["shampoo", "conditioner"],
    ["oil"],
    ["serum", "shampoo"],
    ["mask", "conditioner", "shampoo"],
    ["oil", "serum"],
    ["shampoo"],
  ],
  Face: [
    ["face_wash", "moisturizer"],
    ["face_wash", "serum"],
    ["face_wash"],
    ["serum", "moisturizer", "sunscreen"],
    ["toner", "moisturizer"],
    ["face_wash", "toner", "serum"],
    ["sunscreen"],
  ],
  Body: [
    ["body_wash", "body_lotion"],
    ["body_wash"],
    ["body_scrub", "body_lotion"],
    ["bath_salt", "body_lotion"],
    ["deodorant", "body_wash"],
    ["body_wash", "deodorant", "body_lotion"],
  ],
  Oral: [
    ["toothpaste", "toothbrush", "mouthwash"],
    ["toothpaste", "toothbrush"],
    ["toothpaste", "mouthwash"],
    ["toothpaste"],
    ["gum_gel", "toothpaste", "toothbrush"],
    ["oil_pulling", "toothpaste", "mouthwash"],
  ],
};

function pickProductForKind(customerPref, category, kind, productsById) {
  const preferredId = customerPref.favorites[kind];
  const byKind = customerPref.availableByKind[kind] || [];
  const categoryPool = byKind.filter((p) => p.category === category);

  if (preferredId && rng.next() < 0.72) {
    return productsById.get(preferredId);
  }

  const focusMatches = categoryPool.filter((p) =>
    customerPref.profile.concerns.some((tag) => p.tags.includes(tag)),
  );

  if (focusMatches.length > 0 && rng.next() < 0.75) {
    return rng.pick(focusMatches);
  }

  if (categoryPool.length > 0) return rng.pick(categoryPool);
  if (byKind.length > 0) return rng.pick(byKind);
  return null;
}

function quantityForKind(kind) {
  if (["toothpaste", "mouthwash", "shampoo", "face_wash", "body_wash"].includes(kind)) {
    return rng.next() < 0.22 ? 2 : 1;
  }
  return 1;
}

function dateToIso(date) {
  return date.toISOString().slice(0, 19) + "Z";
}

function buildOrders(customerPrefs, products) {
  const productsById = new Map(products.map((p) => [p.id, p]));
  const txCounts = buildTransactionCounts(customerPrefs.length, REQUIRED_COUNTS.transactions);

  const startDate = new Date("2025-01-01T09:00:00.000Z");
  const endDate = new Date("2026-04-10T20:00:00.000Z");

  const transactions = [];
  const transactionItems = [];

  let txId = 1;
  let itemId = 1;

  for (let ci = 0; ci < customerPrefs.length; ci += 1) {
    const customer = customerPrefs[ci];
    let currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + rng.int(0, 70));
    currentDate.setHours(rng.int(9, 21), rng.int(0, 59), rng.int(0, 59), 0);

    for (let n = 0; n < txCounts[ci]; n += 1) {
      const gapDays = rng.int(8, 36);
      currentDate = new Date(currentDate.getTime() + gapDays * 24 * 60 * 60 * 1000);

      if (currentDate > endDate) {
        currentDate = new Date(endDate.getTime() - rng.int(0, 20) * 24 * 60 * 60 * 1000);
      }

      const category = pickCategoryForOrder(customer.profile);
      const template = rng.pick(comboTemplates[category]);
      const pickedProducts = [];
      const seen = new Set();

      for (const kind of template) {
        const product = pickProductForKind(customer, category, kind, productsById);
        if (!product || seen.has(product.id)) continue;
        seen.add(product.id);
        pickedProducts.push({
          product,
          quantity: quantityForKind(kind),
          kind,
        });
      }

      if (pickedProducts.length === 0) {
        const fallback = rng.pick(customer.availableByCategory[category]);
        pickedProducts.push({ product: fallback, quantity: 1, kind: fallback.kind });
      }

      if (pickedProducts.length < 4 && rng.next() < 0.25) {
        const optionalPool = customer.availableByCategory[category].filter((p) => !seen.has(p.id));
        if (optionalPool.length > 0) {
          const extra = rng.pick(optionalPool);
          pickedProducts.push({ product: extra, quantity: 1, kind: extra.kind });
          seen.add(extra.id);
        }
      }

      const capped = pickedProducts.slice(0, rng.int(1, Math.min(4, pickedProducts.length)));
      const total = Number(
        capped.reduce((sum, line) => sum + line.product.price * line.quantity, 0).toFixed(2),
      );

      transactions.push({
        id: txId,
        customer_id: customer.id,
        date: dateToIso(currentDate),
        total,
      });

      for (const line of capped) {
        transactionItems.push({
          id: itemId,
          transaction_id: txId,
          product_id: line.product.id,
          quantity: line.quantity,
          price: line.product.price,
        });
        itemId += 1;
      }

      txId += 1;
    }
  }

  const txSortMap = new Map();
  transactions
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
    .forEach((tx, idx) => {
      txSortMap.set(tx.id, idx + 1);
      tx.id = idx + 1;
    });

  for (const item of transactionItems) {
    item.transaction_id = txSortMap.get(item.transaction_id);
  }

  const sortedTransactions = transactions.sort((a, b) => a.id - b.id);
  const sortedItems = transactionItems.sort((a, b) => a.transaction_id - b.transaction_id || a.id - b.id);
  sortedItems.forEach((item, idx) => {
    item.id = idx + 1;
  });

  return { transactions: sortedTransactions, transactionItems: sortedItems };
}

function escapeSql(value) {
  return String(value).replace(/'/g, "''");
}

function valuesSql(rows, mapper) {
  return rows.map((row) => `  (${mapper(row)})`).join(",\n");
}

function buildSql(products, customers, transactions, transactionItems) {
  const lines = [];
  lines.push("-- Recommendation engine seed dataset");
  lines.push("-- Counts: 100 products, 220 customers, 1500 transactions");
  lines.push("-- Categories used: Hair, Face, Body, Oral");
  lines.push("");
  lines.push("BEGIN;");
  lines.push("");
  lines.push("DELETE FROM transaction_items;");
  lines.push("DELETE FROM transactions;");
  lines.push("DELETE FROM customers;");
  lines.push("DELETE FROM products;");
  lines.push("");
  lines.push("-- If your customers table does not have gender column, add it once before running inserts.");
  lines.push("-- ALTER TABLE customers ADD COLUMN gender TEXT;");
  lines.push("");

  lines.push("INSERT INTO products (id, name, category, price, description, image, tag, problem_tags) VALUES");
  lines.push(
    valuesSql(
      products,
      (p) => `${p.id}, '${escapeSql(p.name)}', '${p.category}', ${p.price.toFixed(2)}, '${escapeSql(
        p.description,
      )}', '${escapeSql(p.image)}', '${escapeSql(p.tag)}', '${escapeSql(p.problem_tags)}'`,
    ) + ";",
  );
  lines.push("");

  lines.push("INSERT INTO customers (id, name, email, password, gender) VALUES");
  lines.push(
    valuesSql(
      customers,
      (c) => `${c.id}, '${escapeSql(c.name)}', '${escapeSql(c.email)}', '${escapeSql(c.password)}', '${c.gender}'`,
    ) + ";",
  );
  lines.push("");

  lines.push("INSERT INTO transactions (id, customer_id, date, total) VALUES");
  lines.push(
    valuesSql(
      transactions,
      (t) => `${t.id}, ${t.customer_id}, '${t.date}', ${t.total.toFixed(2)}`,
    ) + ";",
  );
  lines.push("");

  lines.push("INSERT INTO transaction_items (id, transaction_id, product_id, quantity, price) VALUES");
  lines.push(
    valuesSql(
      transactionItems,
      (ti) => `${ti.id}, ${ti.transaction_id}, ${ti.product_id}, ${ti.quantity}, ${ti.price.toFixed(2)}`,
    ) + ";",
  );
  lines.push("");
  lines.push("COMMIT;");
  lines.push("");

  return lines.join("\n");
}

const products = buildProducts();
if (products.length !== REQUIRED_COUNTS.products) {
  throw new Error(`Expected ${REQUIRED_COUNTS.products} products, got ${products.length}`);
}

const customers = buildCustomers(REQUIRED_COUNTS.customers);
const customerPrefs = buildCustomerPreferences(customers, products);
const { transactions, transactionItems } = buildOrders(customerPrefs, products);

if (transactions.length !== REQUIRED_COUNTS.transactions) {
  throw new Error(`Expected ${REQUIRED_COUNTS.transactions} transactions, got ${transactions.length}`);
}

const sql = buildSql(products, customers, transactions, transactionItems);
const outDir = path.join(process.cwd(), "backend", "sql");
const outPath = path.join(outDir, "recommendation_seed.sql");

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, sql, "utf8");

console.log(`Generated ${outPath}`);
console.log(`products=${products.length}`);
console.log(`customers=${customers.length}`);
console.log(`transactions=${transactions.length}`);
console.log(`transaction_items=${transactionItems.length}`);
