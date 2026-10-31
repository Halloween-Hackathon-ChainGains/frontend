/**
 * Mock fixtures. data/seed.json did not exist at build time, so the brief's
 * fallback applies: fixtures live here instead.
 */

export const ITEM_VALUES: Record<string, number> = {
  "mini fridge": 80,
  "january sublet": 900,
  "calc textbook": 120,
  "desk lamp": 20,
  "bike": 150,
  "bike lock": 25,
  "rice cooker": 35,
  "monitor": 110,
  "air fryer": 50,
  "yoga mat": 15,
  "graphing calculator": 70,
  "winter coat": 60,
  "coffee maker": 30,
  "office chair": 75,
  "bluetooth speaker": 40,
  "ochem notes": 25,
  "printer": 45,
  "skateboard": 55,
  "guitar": 140,
  "shower caddy": 8,
  "lab goggles": 12,
  "concert ticket": 65,
  "beanbag": 40,
  "standing fan": 25,
  "mechanical keyboard": 85,
  "tennis racket": 35,
  "plant": 10,
  "bookshelf": 45,
  "kettle": 18,
  "ps5 controller": 45,
};

export const ITEMS = Object.keys(ITEM_VALUES);

export const FIRST_NAMES = [
  "Maya", "Jon", "Priya", "Leo", "Aisha", "Sam", "Noah", "Zoe", "Diego", "Mei",
  "Omar", "Ivy", "Theo", "Nia", "Kai", "Ana", "Ravi", "Lena", "Felix", "Sofia",
  "Jae", "Amara", "Ben", "Chloe", "Hugo", "Isla", "Mateo", "Yuki", "Tariq", "Elena",
  "Finn", "Grace", "Arjun", "Luna", "Marcus", "Hana", "Oscar", "Rosa", "Eli", "Sana",
  "Max", "Leila", "Ezra", "Nora", "Dev", "Ruby", "Ty", "Ada", "Kofi", "June",
  "Rafael", "Ines", "Sol", "Wen", "Tomás", "Bea", "Idris", "Lucia", "Ari", "Mira",
  "Cole", "Esme", "Remy", "Talia", "Jude", "Vera", "Rhys", "Ama", "Nico", "Pia",
  "Alex", "Dana", "Quinn", "Rory", "Skye", "Sage", "Wren", "Jules", "Rowan", "Blake",
];

export const LOOP_MESSAGES = [
  "Everyone gets what they came for and nothing goes to the landfill.",
  "A four-way swap no one would have found by asking around.",
  "Three dorms, one circle, zero dollars changing hands.",
  "Two people, two things, one quick hallway swap.",
  "The calc textbook finally finds someone who wants it.",
  "Moving-out season, solved in a single loop.",
];

/** Deterministic PRNG so mock sessions are reproducible. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
