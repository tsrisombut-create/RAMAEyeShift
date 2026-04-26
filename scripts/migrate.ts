import "dotenv/config";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, setDoc, doc, writeBatch, Timestamp } from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.projectId) {
  console.error("❌ Firebase config not found. Make sure .env file is set up correctly.");
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

interface Doctor {
  id: string;
  name: string;
  residencyYear: number;
  offDays: number[];
  blackoutPeriods: Record<string, unknown>[];
}

interface Schedule {
  id: string;
  month: number;
  year: number;
  assignments: Record<string, unknown>[];
  selectedYears: number[];
  createdAt: string;
}

interface Holiday {
  id: string;
  date: string;
  name: string;
}

interface Data {
  doctors: Doctor[];
  schedules: Schedule[];
  holidays: Holiday[];
}

async function migrate() {
  try {
    const dataPath = path.join(__dirname, "data.json");
    const rawData = fs.readFileSync(dataPath, "utf-8");
    const data: Data = JSON.parse(rawData);

    console.log("📊 Starting migration...");
    console.log(`   Doctors: ${data.doctors.length}`);
    console.log(`   Schedules: ${data.schedules.length}`);
    console.log(`   Holidays: ${data.holidays.length}`);

    let batchCount = 0;
    const batchSize = 400;
    let batch = writeBatch(db);

    // Migrate doctors
    console.log("\n📝 Migrating doctors...");
    for (const doctor of data.doctors) {
      const docRef = doc(collection(db, "doctors"), doctor.id);
      batch.set(docRef, doctor);
      batchCount++;

      if (batchCount >= batchSize) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    }

    // Migrate schedules (convert createdAt to Timestamp)
    console.log("📅 Migrating schedules...");
    for (const schedule of data.schedules) {
      const scheduleData = {
        ...schedule,
        createdAt: Timestamp.fromDate(new Date(schedule.createdAt)),
      };
      const docRef = doc(collection(db, "schedules"), schedule.id);
      batch.set(docRef, scheduleData);
      batchCount++;

      if (batchCount >= batchSize) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    }

    // Migrate holidays (convert date to Timestamp)
    console.log("🎉 Migrating holidays...");
    for (const holiday of data.holidays) {
      const holidayData = {
        id: holiday.id,
        name: holiday.name,
        date: Timestamp.fromDate(new Date(holiday.date)),
      };
      const docRef = doc(collection(db, "holidays"), holiday.id);
      batch.set(docRef, holidayData);
      batchCount++;

      if (batchCount >= batchSize) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    }

    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
    }

    console.log("\n✅ Migration complete!");
    console.log(`   Total documents written: ${data.doctors.length + data.schedules.length + data.holidays.length}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrate();
