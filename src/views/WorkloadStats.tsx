import { useState, useMemo, Fragment } from 'react';
import { useDataStore } from '../store/DataStore';
import { ResidencyYear, residencyYearBadgeColor, residencyYearShortName, getDoctorInitial } from '../models';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';

export default function WorkloadStats() {
  const { doctors, schedules, holidays } = useDataStore();
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [filterYears, setFilterYears] = useState<Set<ResidencyYear>>(new Set([ResidencyYear.year1, ResidencyYear.year2, ResidencyYear.year3]));

  const engMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const stats = useMemo(() => {
    const currentMonthSchedules = schedules.filter(s => s.month === selectedMonth && s.year === selectedYear);
    
    const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
    const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
    const prevMonthSchedules = schedules.filter(s => s.month === prevMonth && s.year === prevYear);

    const data = doctors
      .filter(d => filterYears.has(d.residencyYear))
      .map(doc => {
        // 1. Shifts this month
        let shiftsThisMonth = 0;
        currentMonthSchedules.forEach(s => {
          shiftsThisMonth += s.assignments.filter(a => a.doctorId === doc.id).length;
        });

        // Helper to check if a day is a special day (Weekend or Public Holiday)
        const isHolidayOnly = (d: number, m: number, y: number) => {
          return holidays.some(h => {
            const hd = new Date(h.date);
            return hd.getDate() === d && hd.getMonth() === m - 1 && hd.getFullYear() === y;
          });
        };

        const getDayType = (d: number, m: number, y: number) => {
          const dt = new Date(y, m - 1, d);
          const dow = dt.getDay();
          const isWeekend = dow === 0 || dow === 6;
          const isHoliday = isHolidayOnly(d, m, y);
          return { isWeekend, isHoliday, isSpecial: isWeekend || isHoliday };
        };

        // 2. Weekday shifts (prev month)
        let weekdayShiftsPrev = 0;
        let specialShiftsPrev = 0;
        prevMonthSchedules.forEach(s => {
          s.assignments.filter(a => a.doctorId === doc.id).forEach(a => {
            if (getDayType(a.day, prevMonth, prevYear).isSpecial) {
              specialShiftsPrev++;
            } else {
              weekdayShiftsPrev++;
            }
          });
        });

        // 3. Holiday/Weekend Shift Analysis (Current Month)
        const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
        const assignedDays = new Set<number>();
        currentMonthSchedules.forEach(s => {
          s.assignments.filter(a => a.doctorId === doc.id).forEach(a => assignedDays.add(a.day));
        });

        let shiftsWeekend = 0;
        let shiftsWeekdayHoliday = 0;
        
        // Identify holiday blocks
        const dayTypes = Array.from({ length: daysInMonth }, (_, i) => getDayType(i + 1, selectedMonth, selectedYear));
        const blocks: { start: number, end: number, length: number }[] = [];
        let currentBlockStart = -1;

        dayTypes.forEach((type, idx) => {
          if (type.isSpecial) {
            if (currentBlockStart === -1) currentBlockStart = idx + 1;
          } else {
            if (currentBlockStart !== -1) {
              blocks.push({ start: currentBlockStart, end: idx, length: idx - currentBlockStart + 1 });
              currentBlockStart = -1;
            }
          }
        });
        if (currentBlockStart !== -1) {
          blocks.push({ start: currentBlockStart, end: daysInMonth, length: daysInMonth - currentBlockStart + 1 });
        }

        let shiftsInLongHoliday3 = 0;
        let shiftsInExtraLongHoliday = 0;

        assignedDays.forEach(day => {
          const type = dayTypes[day - 1];
          // หยุด (ส-อา): จำนวนเวรที่อยู่ในวันเสาร์-อาทิตย์
          if (type.isWeekend) shiftsWeekend++;
          
          // หยุดธรรมดา: จำนวนเวรวันจันทร์-ศุกร์ ที่เป็นวันหยุด
          if (type.isHoliday && !type.isWeekend) shiftsWeekdayHoliday++;

          // Check blocks
          const block = blocks.find(b => day >= b.start && day <= b.end);
          if (block) {
            if (block.length === 3) shiftsInLongHoliday3++;
            else if (block.length > 3) shiftsInExtraLongHoliday++;
          }
        });

        return {
          doctor: doc,
          shiftsThisMonth,
          weekdayShiftsPrev: `${weekdayShiftsPrev}+${specialShiftsPrev}`,
          shiftsWeekend,
          shiftsWeekdayHoliday,
          shiftsInLongHoliday3,
          shiftsInExtraLongHoliday
        };
      });

    // Group by Residency Year
    const grouped: Record<number, typeof data> = {};
    data.forEach(item => {
      const ry = item.doctor.residencyYear;
      if (!grouped[ry]) grouped[ry] = [];
      grouped[ry].push(item);
    });

    return grouped;
  }, [doctors, schedules, selectedMonth, selectedYear, filterYears, holidays]);

  const toggleYear = (ry: ResidencyYear) => {
    setFilterYears(prev => {
      const next = new Set(prev);
      if (next.has(ry)) next.delete(ry);
      else next.add(ry);
      return next;
    });
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 16px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0 }}>Workload Analytics</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '4px 0 0' }}>Distribution for each resident year</p>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-card)', padding: '6px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <button 
            onClick={() => {
              if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(v => v - 1); }
              else setSelectedMonth(v => v - 1);
            }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex', color: 'var(--text-main)' }}
            className="hover-bg"
          >
            <ChevronLeft size={20} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: '14px', fontWeight: 'bold', color: '#2E5BFF', minWidth: '130px', justifyContent: 'center' }}>
            {engMonths[selectedMonth - 1]} {selectedYear}
          </div>
          <button 
            onClick={() => {
              if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(v => v + 1); }
              else setSelectedMonth(v => v + 1);
            }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex', color: 'var(--text-main)' }}
            className="hover-bg"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[ResidencyYear.year1, ResidencyYear.year2, ResidencyYear.year3].map(ry => {
          const isSel = filterYears.has(ry);
          const color = residencyYearBadgeColor(ry);
          return (
            <button 
              key={ry} 
              onClick={() => toggleYear(ry)}
              style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', border: `1.5px solid ${isSel ? color : 'var(--border)'}`, background: isSel ? color : 'transparent', color: isSel ? 'white' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              {residencyYearShortName(ry)}
            </button>
          )
        })}
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: '24px', overflowX: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.05)', border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '16px 20px', fontSize: '13px', color: 'var(--text-muted)', width: '220px' }}>Doctor</th>
              <th style={{ textAlign: 'center', padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>เวรเดือนนี้</th>
              <th style={{ textAlign: 'center', padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>เวรธรรมดา (เดือนก่อน)</th>
              <th style={{ textAlign: 'center', padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>หยุด (ส-อา)</th>
              <th style={{ textAlign: 'center', padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>หยุดธรรมดา</th>
              <th style={{ textAlign: 'center', padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>หยุดยาว (=3)</th>
              <th style={{ textAlign: 'center', padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>หยุดยาววว (&gt;3)</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(stats).sort().reverse().map(ryKey => {
              const ry = Number(ryKey) as ResidencyYear;
              const group = stats[ry];
              return (
                <Fragment key={ry}>
                  <tr style={{ background: 'rgba(0,0,0,0.03)' }}>
                    <td colSpan={7} style={{ padding: '8px 20px', fontSize: '11px', fontWeight: 'bold', color: residencyYearBadgeColor(ry), letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>
                      {residencyYearShortName(ry)} GROUP
                    </td>
                  </tr>
                  {group.map(({ doctor, shiftsThisMonth, weekdayShiftsPrev, shiftsWeekend, shiftsWeekdayHoliday, shiftsInLongHoliday3, shiftsInExtraLongHoliday }) => (
                    <tr key={doctor.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="hover-bg">
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: residencyYearBadgeColor(doctor.residencyYear), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold' }}>
                            {getDoctorInitial(doctor.name)}
                          </div>
                          <span style={{ fontSize: '14px', fontWeight: '700' }}>{doctor.name}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '16px', fontWeight: '800', color: '#2E5BFF' }}>{shiftsThisMonth}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>{weekdayShiftsPrev}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#E74C3C' }}>{shiftsWeekend}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#27AE60' }}>{shiftsWeekdayHoliday}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: '8px', background: 'rgba(230, 126, 34, 0.1)', color: '#E67E22', fontSize: '14px', fontWeight: 'bold' }}>
                          {shiftsInLongHoliday3}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: '8px', background: 'rgba(142, 68, 173, 0.1)', color: '#8E44AD', fontSize: '14px', fontWeight: 'bold' }}>
                          {shiftsInExtraLongHoliday}
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '24px', padding: '20px', background: 'rgba(46, 91, 255, 0.05)', borderRadius: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <Info size={20} color="#2E5BFF" style={{ marginTop: '2px' }} />
        <div>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#2E5BFF' }}>Analytics Definitions</h4>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            <li><strong>เวรธรรมดา (เดือนก่อน):</strong> เฉพาะเวรวันจันทร์-ศุกร์ที่ไม่ใช่วันหยุด (แสดงในรูปแบบ Weekday+Special)</li>
            <li><strong>หยุด (ส-อา):</strong> จำนวนเวรที่อยู่ในวันเสาร์-อาทิตย์</li>
            <li><strong>หยุดธรรมดา:</strong> จำนวนเวรวันจันทร์-ศุกร์ที่เป็นวันหยุด (Weekday Holiday)</li>
            <li><strong>หยุดยาว:</strong> จำนวนเวรที่มีในช่วงวันหยุดติดต่อกัน "เท่ากับ 3 วัน"</li>
            <li><strong>หยุดยาววว:</strong> จำนวนเวรที่มีในช่วงวันหยุดติดต่อกัน "มากกว่า 3 วัน"</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
