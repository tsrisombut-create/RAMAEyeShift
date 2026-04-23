export const DayOfWeek = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
} as const;
export type DayOfWeek = typeof DayOfWeek[keyof typeof DayOfWeek];

export const ResidencyYear = {
  year1: 1,
  year2: 2,
  year3: 3,
  year4: 4,
  year5: 5,
  year6: 6,
} as const;
export type ResidencyYear = typeof ResidencyYear[keyof typeof ResidencyYear];

export interface BlackoutPeriod {
  id: string; // UUID
  startDay: number;
  endDay: number;
}

export interface Doctor {
  id: string; // UUID
  name: string;
  residencyYear: ResidencyYear;
  offDays: number[]; // DayOfWeek raw values
  blackoutPeriods: BlackoutPeriod[];
}

export interface ShiftAssignment {
  id: string; // UUID
  day: number;
  doctorId: string | null;
  isManualOverride: boolean;
}

export interface ShiftSchedule {
  id: string; // UUID
  month: number;
  year: number;
  assignments: ShiftAssignment[];
  selectedYears: ResidencyYear[];
  createdAt: Date;
}

export interface PublicHoliday {
  id: string; // UUID
  date: Date;
  name: string;
}

// Logic Utilities
export const dayOfWeekShortname = (day: DayOfWeek | number): string => {
  return ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][day as number];
};

export const residencyYearShortName = (year: ResidencyYear): string => {
  return `R${year}`;
};

export const residencyYearBadgeColor = (year: ResidencyYear): string => {
  switch (year) {
    case ResidencyYear.year1: return '#126872';
    case ResidencyYear.year2: return '#0B877D';
    case ResidencyYear.year3: return '#18C29C';
    case ResidencyYear.year4: return '#88F9D4';
    case ResidencyYear.year5: return '#92C9F6';
    case ResidencyYear.year6: return '#2E99EE';
    default: return '#126872';
  }
};

export const getDoctorInitial = (name: string): string => {
  const prefixes = ["นพ.", "พญ.", "Dr.", "ดร.", "น.พ.", "พ.ญ.", "นายแพทย์", "แพทย์หญิง"];
  let cleanName = name.trim();
  for (const prefix of prefixes) {
    if (cleanName.startsWith(prefix)) {
      cleanName = cleanName.substring(prefix.length).trim();
    }
  }
  // Remove leading dots if any (e.g. if someone typed ".ฐานสิทธิ์")
  cleanName = cleanName.replace(/^[.\s]+/, "");
  return cleanName.charAt(0) || "?";
};
