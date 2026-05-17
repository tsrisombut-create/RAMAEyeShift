import "dotenv/config";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.projectId) {
  console.error("❌ Firebase config missing. Check .env file.");
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// [weekdayPrev, weekendPrev, weekdayHolidayPrev, longHoliday3Prev, extraLongHolidayPrev]
const SEED: Record<string, [number, number, number, number, number]> = {
  "กติกา":      [54, 21, 2, 4, 4],
  "นันท์นภัส":  [57, 19, 2, 5, 3],
  "อนิวรรตน์":  [56, 20, 2, 4, 3],
  "พัชระ":      [50, 23, 1, 4, 5],
  "บุญสิตา":    [58, 18, 1, 4, 4],
  "ฐานสิทธิ์":   [59, 19, 2, 5, 4],
  "ภาคินี":     [54, 23, 2, 5, 4],
  "ปฏิพล":      [56, 20, 1, 7, 4],
};

const stripPrefix = (name: string): string => {
  const prefixes = ["นพ.", "พญ.", "Dr.", "ดร.", "น.พ.", "พ.ญ.", "นายแพทย์", "แพทย์หญิง"];
  let clean = name.trim();
  for (const p of prefixes) {
    if (clean.startsWith(p)) clean = clean.substring(p.length).trim();
  }
  return clean.replace(/^[.\s]+/, "");
};

interface Doctor {
  id: string;
  name: string;
  residencyYear: number;
  offDays: number[];
  blackoutPeriods: unknown[];
  baselines?: Record<string, number>;
}

async function seed() {
  console.log("📊 Loading doctors...");
  const snap = await getDocs(collection(db, "doctors"));
  const doctors: Doctor[] = snap.docs.map(d => d.data() as Doctor);
  console.log(`   Loaded ${doctors.length} doctors\n`);

  const seedKeys = Object.keys(SEED);
  const matched = new Set<string>();
  const updates: { doc: Doctor; baselines: Record<string, number> }[] = [];

  for (const doc of doctors) {
    const clean = stripPrefix(doc.name);
    // Find a seed key that matches (clean name contains seed key, or vice versa)
    const match = seedKeys.find(k => clean.includes(k) || k.includes(clean));
    if (match) {
      const [weekdayPrev, weekendPrev, weekdayHolidayPrev, longHoliday3Prev, extraLongHolidayPrev] = SEED[match];
      updates.push({
        doc,
        baselines: { weekdayPrev, weekendPrev, weekdayHolidayPrev, longHoliday3Prev, extraLongHolidayPrev },
      });
      matched.add(match);
      console.log(`  ✓ ${doc.name}  →  ${match}  →  [${SEED[match].join(", ")}]`);
    }
  }

  const unmatched = seedKeys.filter(k => !matched.has(k));
  if (unmatched.length) {
    console.log(`\n⚠️  Unmatched seed entries: ${unmatched.join(", ")}`);
  }

  console.log(`\n📝 Writing ${updates.length} doctor docs...`);
  for (const { doc: d, baselines } of updates) {
    await setDoc(doc(db, "doctors", d.id), { ...d, baselines }, { merge: false });
  }

  console.log("\n✅ Done.");
  process.exit(0);
}

seed().catch(err => { console.error("❌ Failed:", err); process.exit(1); });
