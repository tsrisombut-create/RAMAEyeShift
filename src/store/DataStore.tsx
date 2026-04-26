import React, { createContext, useContext, useState, useEffect } from 'react';
import { ResidencyYear, type Doctor, type ShiftSchedule, type PublicHoliday } from '../models';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, Timestamp, query, where } from 'firebase/firestore';

interface DataStoreContextType {
  doctors: Doctor[];
  schedules: ShiftSchedule[];
  holidays: PublicHoliday[];
  addDoctor: (doctor: Doctor) => void;
  updateDoctor: (doctor: Doctor) => void;
  deleteDoctor: (id: string) => void;
  addHoliday: (holiday: PublicHoliday) => void;
  deleteHoliday: (id: string) => void;
  setHolidays: React.Dispatch<React.SetStateAction<PublicHoliday[]>>;
  generateSchedule: (month: number, year: number, selectedYears?: Set<ResidencyYear>) => ShiftSchedule;
  generateSchedulesBatch: (month: number, year: number, yearSet: Set<ResidencyYear>) => Promise<void>;
  deleteSchedule: (month: number, year: number) => void;
  deleteScheduleByYear: (month: number, year: number, residencyYear: ResidencyYear) => void;
  updateAssignment: (scheduleId: string, day: number, doctorId: string | null) => void;
  generateLineMessage: (monthSchedules: ShiftSchedule[], filterYears?: Set<ResidencyYear>) => string;
  generateCombinedCSV: (month: number, year: number) => string;
}

const DataStoreContext = createContext<DataStoreContextType | undefined>(undefined);

export const DataStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [schedules, setSchedules] = useState<ShiftSchedule[]>([]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);

  // ─── LOAD ────────────────────────────────────────────────────────────────────
  // On mount: fetch data from Firestore collections
  useEffect(() => {
    const loadData = async () => {
      try {
        const [doctorSnap, scheduleSnap, holidaySnap] = await Promise.all([
          getDocs(collection(db, "doctors")),
          getDocs(collection(db, "schedules")),
          getDocs(collection(db, "holidays")),
        ]);

        setDoctors(doctorSnap.docs.map(d => d.data() as Doctor));
        setSchedules(scheduleSnap.docs.map(d => {
          const s = d.data();
          return { ...s, createdAt: (s.createdAt as Timestamp).toDate() } as ShiftSchedule;
        }));
        setHolidays(holidaySnap.docs.map(d => {
          const h = d.data();
          return { ...h, date: (h.date as Timestamp).toDate() } as PublicHoliday;
        }));
      } catch (err) {
        console.error("❌ Firestore Load Error:", err);
      }
    };

    loadData();
  }, []);

  // ─── MUTATIONS (each writes to Firestore) ───────────────────────────────────

  const addDoctor = (doctor: Doctor) => {
    const next = [...doctors, doctor];
    setDoctors(next);
    setDoc(doc(db, "doctors", doctor.id), doctor).catch(err =>
      console.error("Error adding doctor:", err)
    );
  };

  const updateDoctor = (doctor: Doctor) => {
    const next = doctors.map(d => d.id === doctor.id ? doctor : d);
    setDoctors(next);
    setDoc(doc(db, "doctors", doctor.id), doctor).catch(err =>
      console.error("Error updating doctor:", err)
    );
  };

  const deleteDoctor = (id: string) => {
    const next = doctors.filter(d => d.id !== id);
    setDoctors(next);
    deleteDoc(doc(db, "doctors", id)).catch(err =>
      console.error("Error deleting doctor:", err)
    );
  };

  const addHoliday = (holiday: PublicHoliday) => {
    const next = [...holidays, holiday];
    setHolidays(next);
    setDoc(doc(db, "holidays", holiday.id), {
      ...holiday,
      date: Timestamp.fromDate(holiday.date),
    }).catch(err => console.error("Error adding holiday:", err));
  };

  const deleteHoliday = (id: string) => {
    const next = holidays.filter(h => h.id !== id);
    setHolidays(next);
    deleteDoc(doc(db, "holidays", id)).catch(err =>
      console.error("Error deleting holiday:", err)
    );
  };

  const setHolidaysWithSync = (updater: React.SetStateAction<PublicHoliday[]>) => {
    const next = typeof updater === 'function'
      ? (updater as (prev: PublicHoliday[]) => PublicHoliday[])(holidays)
      : updater;
    setHolidays(next);
    next.forEach(holiday => {
      setDoc(doc(db, "holidays", holiday.id), {
        ...holiday,
        date: Timestamp.fromDate(holiday.date),
      }).catch(err => console.error("Error syncing holidays:", err));
    });
  };

  const updateAssignment = (scheduleId: string, day: number, doctorId: string | null) => {
    const copy = [...schedules];
    const sIndex = copy.findIndex(s => s.id === scheduleId);
    if (sIndex < 0) return;

    const newSchedule = { ...copy[sIndex], assignments: [...copy[sIndex].assignments] };
    const aIndex = newSchedule.assignments.findIndex(a => a.day === day);
    if (aIndex < 0) return;

    newSchedule.assignments[aIndex] = {
      ...newSchedule.assignments[aIndex],
      doctorId,
      isManualOverride: true
    };

    copy[sIndex] = newSchedule;
    setSchedules(copy);
    setDoc(doc(db, "schedules", scheduleId), {
      ...newSchedule,
      createdAt: Timestamp.fromDate(newSchedule.createdAt),
    }).catch(err => console.error("Error updating assignment:", err));
  };

  // Pure builder — no state reads, takes explicit workingSchedules for correct batching
  const buildScheduleForYear = (
    month: number, year: number, ry: ResidencyYear,
    workingSchedules: ShiftSchedule[]
  ): ShiftSchedule => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const eligibleDoctors = doctors.filter(d => d.residencyYear === ry);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const ryKey = String(ry);

    const prevSched = workingSchedules.find(s =>
      s.month === prevMonth && s.year === prevYear &&
      [...s.selectedYears].sort().join(',') === ryKey
    );
    const lastDayPrev = new Date(prevYear, prevMonth, 0).getDate();
    let lastAssignedId = prevSched?.assignments.find(a => a.day === lastDayPrev)?.doctorId ?? null;

    // Track cumulative shift count so the least-loaded doctor is always preferred
    const shiftCount = new Map<string, number>();
    eligibleDoctors.forEach(d => shiftCount.set(d.id, 0));

    const assignments = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dow = new Date(year, month - 1, day).getDay();
      const isWeekdayHoliday = dow !== 0 && dow !== 6 &&
        holidays.some(h => {
          const hd = new Date(h.date);
          return hd.getFullYear() === year && hd.getMonth() === month - 1 && hd.getDate() === day;
        });
      // On weekday public holidays, offDays don't apply (everyone can work the special day)
      const isAvailable = (d: (typeof eligibleDoctors)[0]) =>
        (isWeekdayHoliday || !d.offDays.includes(dow)) &&
        !d.blackoutPeriods.some(b => day >= b.startDay && day <= b.endDay);

      // Pick from available non-consecutive candidates; fallback allows consecutive
      const pickBest = (pool: (typeof eligibleDoctors)): (typeof eligibleDoctors)[0] | null => {
        if (pool.length === 0) return null;
        const minShifts = Math.min(...pool.map(d => shiftCount.get(d.id) ?? 0));
        const tied = pool.filter(d => (shiftCount.get(d.id) ?? 0) === minShifts);
        return tied[Math.floor(Math.random() * tied.length)];
      };

      let candidates = eligibleDoctors.filter(d => isAvailable(d) && d.id !== lastAssignedId);
      let selectedDoc = pickBest(candidates);

      // Fallback: allow consecutive if no non-consecutive candidate is available
      if (!selectedDoc) {
        selectedDoc = pickBest(eligibleDoctors.filter(d => isAvailable(d)));
      }

      assignments.push({ id: uuidv4(), day, doctorId: selectedDoc?.id ?? null, isManualOverride: false });
      if (selectedDoc) {
        shiftCount.set(selectedDoc.id, (shiftCount.get(selectedDoc.id) ?? 0) + 1);
        lastAssignedId = selectedDoc.id;
      } else {
        lastAssignedId = null;
      }
    }

    return { id: uuidv4(), month, year, assignments, selectedYears: [ry], createdAt: new Date() };
  };

  // Batch generate — one setSchedules call for all years (fixes stale-closure bug)
  const generateSchedulesBatch = async (month: number, year: number, yearSet: Set<ResidencyYear>) => {
    // Query Firestore directly to catch any stale docs not in the in-memory state
    try {
      const q = query(
        collection(db, "schedules"),
        where("month", "==", month),
        where("year", "==", year)
      );
      const snap = await getDocs(q);
      snap.docs.forEach(d => {
        const ryears: ResidencyYear[] = (d.data().selectedYears as ResidencyYear[]) || [];
        if (ryears.some(ry => yearSet.has(ry))) {
          deleteDoc(doc(db, "schedules", d.id)).catch(console.error);
        }
      });
    } catch (err) {
      console.error("Error purging stale schedules from Firestore:", err);
    }

    // Remove matching entries from in-memory state as well
    const toDelete = schedules.filter(s =>
      s.month === month && s.year === year &&
      s.selectedYears.some(ry => yearSet.has(ry))
    );

    let working = schedules.filter(s => !toDelete.includes(s));
    const newSchedules: ShiftSchedule[] = [];

    Array.from(yearSet).sort().forEach(ry => {
      const schedule = buildScheduleForYear(month, year, ry, working);
      working.push(schedule);
      newSchedules.push(schedule);
    });

    setSchedules(working);
    newSchedules.forEach(schedule => {
      setDoc(doc(db, "schedules", schedule.id), {
        ...schedule,
        createdAt: Timestamp.fromDate(schedule.createdAt),
      }).catch(err => console.error("Error saving schedule:", err));
    });
  };

  // generateSchedule implementation (kept for single-year backward compat)
  const generateSchedule = (month: number, year: number, selectedYears?: Set<ResidencyYear>): ShiftSchedule => {
    const rySet = selectedYears || new Set(Object.values(ResidencyYear) as ResidencyYear[]);
    const currentYearSet = Array.from(rySet).sort().join(',');

    const filtered = schedules.filter(s => {
      const isSameTime = s.month === month && s.year === year;
      const sYearSet = [...s.selectedYears].sort().join(',');
      return !(isSameTime && sYearSet === currentYearSet);
    });

    const ry = Array.from(rySet)[0];
    const schedule = buildScheduleForYear(month, year, ry, filtered);
    schedule.selectedYears = Array.from(rySet);

    const nextSchedules = [...filtered, schedule];
    setSchedules(nextSchedules);
    setDoc(doc(db, "schedules", schedule.id), {
      ...schedule,
      createdAt: Timestamp.fromDate(schedule.createdAt),
    }).catch(err => console.error("Error generating schedule:", err));

    return schedule;
  };

  const deleteSchedule = (month: number, year: number) => {
    const toDelete = schedules.find(s => s.month === month && s.year === year);
    const next = schedules.filter(s => s.month !== month || s.year !== year);
    setSchedules(next);
    if (toDelete) {
      deleteDoc(doc(db, "schedules", toDelete.id)).catch(err =>
        console.error("Error deleting schedule:", err)
      );
    }
  };

  const deleteScheduleByYear = (month: number, year: number, residencyYear: ResidencyYear) => {
    const toDelete = schedules.find(s => {
      const isSameTime = s.month === month && s.year === year;
      const containsYear = s.selectedYears.includes(residencyYear);
      return isSameTime && containsYear;
    });
    const next = schedules.filter(s => {
      const isSameTime = s.month === month && s.year === year;
      const containsYear = s.selectedYears.includes(residencyYear);
      return !(isSameTime && containsYear);
    });
    setSchedules(next);
    if (toDelete) {
      deleteDoc(doc(db, "schedules", toDelete.id)).catch(err =>
        console.error("Error deleting schedule by year:", err)
      );
    }
  };

  const engMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const thaiDays = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

  const generateLineMessage = (monthSchedules: ShiftSchedule[], filterYears?: Set<ResidencyYear>): string => {
    if (monthSchedules.length === 0) return "";
    const first = monthSchedules[0];
    const lines = ["Shift Schedule", `${engMonths[first.month - 1]} ${first.year}`, "─────────────────────────"];
    
    // Sort schedules by year for consistent ordering in the line string
    const sortedScheds = [...monthSchedules]
      .filter(s => !filterYears || s.selectedYears.some(ry => filterYears.has(ry)))
      .sort((a,b) => {
        const minA = Math.min(...a.selectedYears);
        const minB = Math.min(...b.selectedYears);
        return minA - minB;
      });

    const daysInMonth = new Date(first.year, first.month, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(first.year, first.month - 1, day);
      const dayName = thaiDays[date.getDay()];
      
      const dayAssignments = sortedScheds.map(s => {
        const a = s.assignments.find(as => as.day === day);
        const doc = doctors.find(d => d.id === a?.doctorId);
        if (!doc) return null;
        if (filterYears && !filterYears.has(doc.residencyYear)) return null;
        return `R${doc.residencyYear}-${doc.name.replace(/^(นพ\.|พญ\.)/, '')}`;
      }).filter(Boolean);

      if (dayAssignments.length > 0) {
        lines.push(`${day} ${engMonths[first.month - 1]} (${dayName}) - ${dayAssignments.join(', ')}`);
      }
    }
    return lines.join("\n");
  };

  const generateCombinedCSV = (month: number, year: number): string => {
    const monthSchedules = schedules.filter(s => s.month === month && s.year === year);
    if (monthSchedules.length === 0) return "";
    const rows = ["Date,Day,Doctor,Residency,Type,Schedule Group"];
    monthSchedules.forEach(schedule => {
      const label = schedule.selectedYears.map(ry => `R${ry}`).join("+");
      schedule.assignments.forEach(a => {
        const date = new Date(schedule.year, schedule.month - 1, a.day);
        const dow = date.getDay();
        const type = (dow === 0 || dow === 6) ? "Holiday" : (dow === 5 ? "Friday" : "Weekday");
        const doc = doctors.find(d => d.id === a.doctorId);
        const name = doc ? doc.name : "Vacant";
        const ryear = doc ? `R${doc.residencyYear}` : "-";
        rows.push(`${a.day} ${engMonths[schedule.month - 1]} ${schedule.year},${thaiDays[dow]},${name},${ryear},${type},${label}`);
      });
    });
    return rows.join("\n");
  };

  return (
    <DataStoreContext.Provider value={{
      doctors, schedules, holidays,
      addDoctor, updateDoctor, deleteDoctor,
      addHoliday, deleteHoliday, setHolidays: setHolidaysWithSync,
      generateSchedule, generateSchedulesBatch, deleteSchedule, deleteScheduleByYear, updateAssignment,
      generateLineMessage, generateCombinedCSV
    }}>
      {children}
    </DataStoreContext.Provider>
  );
};

export const useDataStore = () => {
  const ctx = useContext(DataStoreContext);
  if (!ctx) throw new Error("useDataStore must be used within DataStoreProvider");
  return ctx;
};
