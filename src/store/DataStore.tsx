import React, { createContext, useContext, useState, useEffect } from 'react';
import { ResidencyYear, type Doctor, type ShiftSchedule, type PublicHoliday } from '../models';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../firebase';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, Timestamp, query, where } from 'firebase/firestore';

// One snapshot row for a doctor at a specific month/year.
export interface WorkloadSnapshotEntry {
  month: number;
  year: number;
  shiftsThisMonth: number;
  weekdayShiftsPrev: number;
  specialShiftsPrev: number;
  shiftsWeekend: number;
  shiftsWeekendPrev: number;
  shiftsWeekdayHoliday: number;
  shiftsWeekdayHolidayPrev: number;
  shiftsInLongHoliday3: number;
  shiftsInLongHoliday3Prev: number;
  shiftsInExtraLongHoliday: number;
  shiftsInExtraLongHolidayPrev: number;
  savedAt: Date;
}

// Payload passed in when saving a snapshot — one item per doctor.
export interface WorkloadSnapshotPayload {
  doctorId: string;
  doctorName: string;
  residencyYear: ResidencyYear;
  entry: Omit<WorkloadSnapshotEntry, 'savedAt'>;
}

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
  saveWorkloadSnapshots: (payloads: WorkloadSnapshotPayload[]) => Promise<void>;
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

    // All prior schedules for THIS residency year (used for the history tie-breaker)
    const priorScheds = workingSchedules.filter(s =>
      [...s.selectedYears].sort().join(',') === ryKey &&
      (s.year < year || (s.year === year && s.month < month))
    );

    // Cumulative historical counts per doctor: baseline (paper) + every prior app schedule.
    // Used as a TIE-BREAKER only — not as the primary balancing criterion.
    // Primary balance happens in-month so every doctor gets a fair share each month.
    const histWeekday = new Map<string, number>();
    const histFriday = new Map<string, number>();
    const histWeekend = new Map<string, number>();
    eligibleDoctors.forEach(d => {
      const b = d.baselines || {};
      let wkday = b.weekdayPrev ?? 0;
      let fri = 0;
      let wkend = b.weekendPrev ?? 0;
      priorScheds.forEach(s => {
        s.assignments.filter(a => a.doctorId === d.id).forEach(a => {
          const dow = new Date(s.year, s.month - 1, a.day).getDay();
          if (dow === 0 || dow === 6) wkend++;
          else if (dow === 5) fri++;
          else wkday++;
        });
      });
      histWeekday.set(d.id, wkday);
      histFriday.set(d.id, fri);
      histWeekend.set(d.id, wkend);
    });

    // In-month per-type counters — reset to 0 each month so within-month balance is fair.
    const weekdayShifts = new Map<string, number>();
    const fridayShifts = new Map<string, number>();
    const weekendShifts = new Map<string, number>();
    eligibleDoctors.forEach(d => {
      weekdayShifts.set(d.id, 0);
      fridayShifts.set(d.id, 0);
      weekendShifts.set(d.id, 0);
    });

    // Total shifts this month per doctor — used as a tie-breaker so that
    // a doctor low on EVERY per-type counter doesn't accumulate shifts across
    // all categories (e.g. weekday + Friday + weekend in the same month).
    const totalShifts = new Map<string, number>();
    eligibleDoctors.forEach(d => totalShifts.set(d.id, 0));

    const assignments = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dow = new Date(year, month - 1, day).getDay();
      const isFriday = dow === 5;
      const isWeekend = dow === 0 || dow === 6;
      const isWeekdayHoliday = !isWeekend &&
        holidays.some(h => {
          const hd = new Date(h.date);
          return hd.getFullYear() === year && hd.getMonth() === month - 1 && hd.getDate() === day;
        });
      // On weekday public holidays, offDays don't apply (everyone can work the special day)
      const isAvailable = (d: (typeof eligibleDoctors)[0]) =>
        (isWeekdayHoliday || !d.offDays.includes(dow)) &&
        !d.blackoutPeriods.some(b => day >= b.startDay && day <= b.endDay);

      const pickBest = (pool: (typeof eligibleDoctors)): (typeof eligibleDoctors)[0] | null => {
        if (pool.length === 0) return null;
        let shiftMap: Map<string, number>;
        let histMap: Map<string, number>;
        if (isWeekend)      { shiftMap = weekendShifts; histMap = histWeekend; }
        else if (isFriday)  { shiftMap = fridayShifts;  histMap = histFriday;  }
        else                { shiftMap = weekdayShifts; histMap = histWeekday; }

        // 1) Fewest of THIS shift type IN THIS MONTH (primary in-month balance)
        const minShifts = Math.min(...pool.map(d => shiftMap.get(d.id) ?? 0));
        let tied = pool.filter(d => (shiftMap.get(d.id) ?? 0) === minShifts);
        if (tied.length === 1) return tied[0];

        // 2) Tie-break: fewest TOTAL shifts this month (cross-type fairness)
        const minTotal = Math.min(...tied.map(d => totalShifts.get(d.id) ?? 0));
        tied = tied.filter(d => (totalShifts.get(d.id) ?? 0) === minTotal);
        if (tied.length === 1) return tied[0];

        // 3) Tie-break: lowest cumulative history for THIS type (long-term fairness)
        const minHist = Math.min(...tied.map(d => histMap.get(d.id) ?? 0));
        tied = tied.filter(d => (histMap.get(d.id) ?? 0) === minHist);
        if (tied.length === 1) return tied[0];

        // 4) Final tie-break: random
        return tied[Math.floor(Math.random() * tied.length)];
      };

      // Two-pass for ALL day types: prefer non-consecutive, fall back to allowing
      // consecutive only if there is genuinely no other eligible doctor. This
      // prevents 3-day runs (e.g. Thu→Fri→Sat for one doctor) while still
      // letting the per-type counters (weekday/friday/weekend) balance the load.
      const nonConsec = eligibleDoctors.filter(d => isAvailable(d) && d.id !== lastAssignedId);
      let selectedDoc = pickBest(nonConsec);
      if (!selectedDoc) {
        selectedDoc = pickBest(eligibleDoctors.filter(d => isAvailable(d)));
      }

      assignments.push({ id: uuidv4(), day, doctorId: selectedDoc?.id ?? null, isManualOverride: false });
      if (selectedDoc) {
        if (isWeekend) {
          weekendShifts.set(selectedDoc.id, (weekendShifts.get(selectedDoc.id) ?? 0) + 1);
        } else if (isFriday) {
          fridayShifts.set(selectedDoc.id, (fridayShifts.get(selectedDoc.id) ?? 0) + 1);
        } else {
          weekdayShifts.set(selectedDoc.id, (weekdayShifts.get(selectedDoc.id) ?? 0) + 1);
        }
        totalShifts.set(selectedDoc.id, (totalShifts.get(selectedDoc.id) ?? 0) + 1);
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

  // Append one snapshot entry per doctor to their workload_snapshots doc.
  // Each doctor gets one doc (id = doctorId) containing a `snapshots` array
  // that grows over time — historical archive, never overwritten.
  const saveWorkloadSnapshots = async (payloads: WorkloadSnapshotPayload[]) => {
    const savedAt = new Date();
    await Promise.all(payloads.map(async (p) => {
      const ref = doc(db, "workload_snapshots", p.doctorId);
      const existing = await getDoc(ref);
      const prevSnapshots: WorkloadSnapshotEntry[] = existing.exists()
        ? (existing.data().snapshots || []).map((s: WorkloadSnapshotEntry & { savedAt: Timestamp | Date }) => ({
            ...s,
            savedAt: s.savedAt instanceof Timestamp ? s.savedAt.toDate() : s.savedAt,
          }))
        : [];
      const newEntry: WorkloadSnapshotEntry = { ...p.entry, savedAt };
      await setDoc(ref, {
        doctorId: p.doctorId,
        doctorName: p.doctorName,
        residencyYear: p.residencyYear,
        snapshots: [...prevSnapshots, newEntry].map(s => ({
          ...s,
          savedAt: Timestamp.fromDate(s.savedAt),
        })),
      });
    }));
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
      generateLineMessage, generateCombinedCSV, saveWorkloadSnapshots
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
