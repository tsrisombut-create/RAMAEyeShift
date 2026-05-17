# RAMAEyeShift

A web-based Ophthalmology Resident Scheduling. Originally conceived as a SwiftUI application, this platform has been transformed into a high-performance web experience designed for clinical staff at Ramathibodi Hospital.

## Features

- **Resident Scheduling**: Automated and manual shift management for R1, R2, and R3 residents.
- **OR Management**: High-density board for tracking surgical operations and staff assignments.
- **Holiday Integration**: Intelligent handling of public holidays and custom staff leave.
- **Data Sync**: Real-time integration with Google Sheets for robust backend persistence.
- **Smart Exports**: Generate schedule strings for LINE or export comprehensive data via CSV.
- **UI**: Modern glassmorphic design system using *Plus Jakarta Sans* typography.

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Vanilla CSS (Custom Design System)
- **Deployment**: GitHub Pages (Automated via Actions)

## Shift Assignment Algorithm

The core scheduling system uses a **greedy, load-balanced algorithm** that auto-generates monthly schedules while respecting constraints.

### Overview

**Location:** `src/store/DataStore.tsx` → `buildScheduleForYear()` (lines 141-233)

The algorithm assigns doctors to shifts by:
1. Tracking load separately for **weekdays (Mon-Thu)**, **Friday**, and **weekends (Sat-Sun)**
2. Carrying shift counts from previous months to ensure cross-month balance
3. Using two-pass selection: prefer non-consecutive shifts, fall back if necessary
4. Respecting hard constraints: off-days, blackout periods, and public holidays

### Data Structures

```typescript
interface Doctor {
  id: string;
  residencyYear: ResidencyYear;    // 1-6
  offDays: number[];               // Days of week they don't work (0=Sun, 6=Sat)
  blackoutPeriods: BlackoutPeriod[]; // Date ranges unavailable
}

interface ShiftAssignment {
  id: string;
  day: number;           // 1-31
  doctorId: string | null; // null = vacant
  isManualOverride: boolean;
}
```

### Key Features

**Three-Category Load Balancing:**
- **Weekday shifts (Mon-Thu):** Tracked separately
- **Friday shifts:** Separate tracking (often has different staffing needs)
- **Weekend shifts (Sat-Sun):** Tracked separately to prevent overload

**Cross-Month Carry-Over:**
- Counters initialize from previous month's shifts
- Doctor who worked 6 weekends in May starts June with 6 weekend shifts already "counted"
- Ensures balance across consecutive months, not just within a month

**Consecutive Shift Avoidance:**
- **All day types use the same two-pass strategy:**
  1. First pass: try to pick from eligible doctors who did NOT work yesterday (non-consecutive preference)
  2. Fallback: if no non-consecutive doctor is available, allow consecutive
- This prevents long runs (e.g. Thu→Fri→Sat for the same doctor) while still allowing consecutive assignments when the pool is genuinely empty
- Vacant shifts (no available doctor) reset the consecutive tracker

**Tie-breaker — Total Shifts:**
- Within the candidates tied at the same per-type minimum, prefer the doctor with the **fewest total shifts this month**
- Prevents one doctor accumulating low-count shifts across weekday + Friday + weekend simultaneously
- Final tie-breaker is random (only between doctors equal on both per-type AND total counts)

**Cumulative History (per-type counter seeding):**
- When generating a new month, each doctor's per-type counters are initialized from:
  - `baseline` (frozen paper records, set per-doctor)
  - PLUS the sum of all that doctor's shifts from every prior schedule in the app
- Then normalized by subtracting the group minimum so balancing works smoothly
- Result: month-to-month balance auto-corrects without manual intervention

**Constraint Hierarchy:**

| Type | Constraint | Behavior |
|------|-----------|----------|
| Hard | Off-days | Doctor excluded (except on weekday holidays) |
| Hard | Blackout periods | Doctor excluded from specific date ranges |
| Soft | Load balance | Prefer doctors with lower shift counts |
| Soft | Non-consecutive | Prefer avoiding back-to-back shifts |

**Special Cases:**
- **Weekday public holidays:** Lift off-day restrictions (everyone eligible for special days)
- **Vacant shifts:** If no doctor available, leave shift empty (doctorId = null)
- **Month boundaries:** Last day of previous month determines whether next day is consecutive

### Algorithm Steps (Simplified)

For each day of the month:

1. **Determine day type:** weekend, Friday, or weekday?
2. **Filter available doctors:** Apply off-days and blackout rules
3. **Pick least-loaded:** Among available, select doctor with lowest count in the appropriate category
4. **Handle ties:** Randomly pick among equally-loaded doctors (prevents patterns)
5. **Two-pass fallback:**
   - Pass 1: Exclude yesterday's doctor (non-consecutive preference)
   - Pass 2: Allow any available doctor (fallback)
6. **Update counters:** Increment the appropriate shift counter

### Examples

**Example 1: Weekday Distribution**
- Doctor A: weekday=3, Doctor B: weekday=2
- Assigning Thursday: Doctor B selected (lower count)
- After: Doctor A: 3, Doctor B: 3 (balanced)

**Example 2: Friday Separation**
- Doctor A: friday=1, Doctor B: friday=0
- Assigning Friday: Doctor B selected
- Result: Friday tracked independently from weekdays

**Example 3: Cross-Month Balance**
- May: Doctor A works 6 weekends
- June: Doctor A's weekend counter starts at 6
- First weekend in June: Algorithm prefers other doctors (if available)
- Result: More even distribution across both months

### Testing

**Test 1: Generate 3 consecutive months**
- Open Workload Analytics
- Check "หยุด (ส-อา)" (weekend shifts) column
- Expected: Weekend distribution smooths across months

**Test 2: Friday vs Weekday**
- Generate schedule, open stats
- Check breakdown: Wkday, Fri, Hol
- Expected: Friday counts differ from weekdays

**Test 3: Consecutive Avoidance**
- Check assignment table for same doctor on consecutive days
- Open swap modal to verify why (usually low availability)
- Expected: Minimal consecutive shifts with explanations

### Constraints & Edge Cases

| Scenario | Handling |
|----------|----------|
| No available doctors | Shift remains vacant (doctorId: null) |
| Single doctor eligible | Assigned regardless of consecutive rule |
| First schedule (no history) | Counters start at 0, pure per-month balance |
| Blackout overlaps holiday | Blackout wins (harder constraint) |
| Doctor has all days off | Cannot be assigned to any shift |

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with your Google Sheets API credentials (see `.env.example`).

### Development
```bash
npm run dev
```

## PWA Support
RAMAEyeShift is built as a Progressive Web App. You can add it to your Home Screen on iOS or Android for a native-like app experience.

## Support

For any issues or questions, please contact:
- **Thansit Srisombut**
- Email: [tsrisombut@gmail.com](mailto:tsrisombut@gmail.com)

---
*Built for the Department of Ophthalmology, Ramathibodi Hospital.*
