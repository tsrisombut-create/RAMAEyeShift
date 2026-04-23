import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { ResidencyYear, type Doctor, type ShiftSchedule, type PublicHoliday } from '../models';
import { v4 as uuidv4 } from 'uuid';

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

  // This ref is false during the initial cloud load to prevent syncToCloud
  // from firing on intermediate state updates (setDoctors, setSchedules, setHolidays
  // each trigger a re-render, which would POST partial data back to GAS causing duplication).
  const isLoaded = useRef(false);
  
  // Use Vite env variable for the deployed Apps Script URL
  const GAS_URL = import.meta.env.VITE_GOOGLE_SHEETS_URL || "";

  // Upload state to Google Sheets automatically when changes happen
  const syncToCloud = async (d: Doctor[], s: ShiftSchedule[], h: PublicHoliday[]) => {
    if (!GAS_URL) return;
    try {
      await fetch(GAS_URL, {
        method: "POST",
        // 'text/plain' disables CORS pre-flight checks which Apps Script blocks
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ doctors: d, schedules: s, holidays: h }),
        redirect: "follow",
      });
    } catch (err) {
      console.error("Google Sheets Sync Error:", err);
    }
  };

  // Fetch initial state from Google Sheets on load
  const loadFromCloud = async () => {
    if (!GAS_URL) return false;
    try {
      const res = await fetch(GAS_URL, { redirect: "follow" });
      const data = await res.json();
      // Batch all state updates before marking as loaded so the sync
      // effect does not fire on each individual setter call.
      if (data.doctors) setDoctors(data.doctors);
      if (data.schedules) setSchedules(data.schedules);
      if (data.holidays) setHolidays(data.holidays);
      return true;
    } catch (err) {
      console.error("Google Sheets Load Error:", err);
      return false;
    }
  };

  // Load Setup from Cloud or Fallback to Memory.
  // isLoaded stays false until this completes, preventing syncToCloud
  // from firing on the intermediate state changes caused by setDoctors /
  // setSchedules / setHolidays above.
  useEffect(() => {
    loadFromCloud().then((loaded) => {
      if (!loaded && doctors.length === 0) {
        setDoctors([
          { id: uuidv4(), name: "Dr. Patchara", residencyYear: ResidencyYear.year3, offDays: [2, 3, 4], blackoutPeriods: [] },
          { id: uuidv4(), name: "Dr. Thanasit", residencyYear: ResidencyYear.year3, offDays: [4, 5, 6], blackoutPeriods: [{ id: uuidv4(), startDay: 1, endDay: 3 }] },
        ]);
      }
      // Mark load complete — sync effect will now be allowed to fire
      isLoaded.current = true;
    });
  }, []);

  // Sync to cloud whenever state mutates, but ONLY after the initial
  // load is complete. Without this guard, the three setX() calls inside
  // loadFromCloud each trigger this effect with partial/incomplete data,
  // which can cause the GAS backend to receive and store duplicate entries.
  useEffect(() => {
    if (!isLoaded.current) return;
    if (doctors.length > 0) syncToCloud(doctors, schedules, holidays);
  }, [doctors, schedules, holidays]);

  const addDoctor = (doctor: Doctor) => {
    setDoctors(prev => [...prev, doctor]);
  };

  const updateDoctor = (doctor: Doctor) => {
    setDoctors(prev => prev.map(d => d.id === doctor.id ? doctor : d));
  };

  const deleteDoctor = (id: string) => {
    setDoctors(prev => prev.filter(d => d.id !== id));
  };

  const addHoliday = (holiday: PublicHoliday) => {
    setHolidays(prev => [...prev, holiday]);
  };

  const deleteHoliday = (id: string) => {
    setHolidays(prev => prev.filter(h => h.id !== id));
  };

  const updateAssignment = (scheduleId: string, day: number, doctorId: string | null) => {
    setSchedules(prev => {
      const copy = [...prev];
      const sIndex = copy.findIndex(s => s.id === scheduleId);
      if (sIndex < 0) return prev;
      
      const newSchedule = { ...copy[sIndex], assignments: [...copy[sIndex].assignments] };
      const aIndex = newSchedule.assignments.findIndex(a => a.day === day);
      if (aIndex < 0) return prev;
      
      newSchedule.assignments[aIndex] = {
        ...newSchedule.assignments[aIndex],
        doctorId,
        isManualOverride: true
      };
      
      copy[sIndex] = newSchedule;
      return copy;
    });
  };

  // generateSchedule implementation
  const generateSchedule = (month: number, year: number, selectedYears?: Set<ResidencyYear>): ShiftSchedule => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const eligibleDoctors = selectedYears 
      ? doctors.filter(d => selectedYears.has(d.residencyYear))
      : doctors;
      
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const currentYearSet = Array.from(selectedYears || []).sort().join(',');

    // Find who worked the last day of previous month for this specific year group
    const prevSched = schedules.find(s => 
      s.month === prevMonth && 
      s.year === prevYear && 
      s.selectedYears.sort().join(',') === currentYearSet
    );

    const lastDayPrev = new Date(prevYear, prevMonth, 0).getDate();
    const lastDocIdPrevMonth = prevSched?.assignments.find(a => a.day === lastDayPrev)?.doctorId;

    const assignments = [];
    let lastAssignedId = lastDocIdPrevMonth;

    for (let day = 1; day <= daysInMonth; day++) {
      // Find a doctor who didn't work yesterday and is eligible
      // In a real app, we'd also check offDays and blackouts, but keeping it simple as requested
      let docIndex = (day + (eligibleDoctors.findIndex(d => d.id === lastAssignedId) + 1)) % (eligibleDoctors.length || 1);
      let selectedDoc = eligibleDoctors.length > 0 ? eligibleDoctors[docIndex] : null;

      // Ensure no consecutive shift
      if (selectedDoc && selectedDoc.id === lastAssignedId && eligibleDoctors.length > 1) {
        docIndex = (docIndex + 1) % eligibleDoctors.length;
        selectedDoc = eligibleDoctors[docIndex];
      }

      assignments.push({
        id: uuidv4(),
        day,
        doctorId: selectedDoc ? selectedDoc.id : null,
        isManualOverride: false
      });
      
      lastAssignedId = selectedDoc?.id;
    }

    const schedule: ShiftSchedule = {
      id: uuidv4(),
      month,
      year,
      assignments,
      selectedYears: Array.from(selectedYears || Object.values(ResidencyYear) as ResidencyYear[]),
      createdAt: new Date()
    };

    setSchedules(prev => {
      const filtered = prev.filter(s => {
        const isSameTime = s.month === month && s.year === year;
        const sYearSet = [...s.selectedYears].sort().join(',');
        return !(isSameTime && sYearSet === currentYearSet);
      });
      return [...filtered, schedule];
    });

    return schedule;
  };

  const deleteSchedule = (month: number, year: number) => {
    setSchedules(prev => prev.filter(s => s.month !== month || s.year !== year));
  };

  const deleteScheduleByYear = (month: number, year: number, residencyYear: ResidencyYear) => {
    setSchedules(prev => prev.filter(s => {
      const isSameTime = s.month === month && s.year === year;
      const containsYear = s.selectedYears.includes(residencyYear);
      return !(isSameTime && containsYear);
    }));
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
      addHoliday, deleteHoliday, setHolidays,
      generateSchedule, deleteSchedule, deleteScheduleByYear, updateAssignment,
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
