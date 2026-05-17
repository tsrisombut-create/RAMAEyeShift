import { useState, useMemo, Fragment } from 'react';
import { createPortal } from 'react-dom';

import { useDataStore } from '../store/DataStore';
import { ResidencyYear, residencyYearBadgeColor, residencyYearShortName, dayOfWeekShortname, getDoctorInitial, type Doctor } from '../models';
import { BlackoutCalendar } from '../components/BlackoutCalendar';
import { v4 as uuidv4 } from 'uuid';
import { Moon, Edit2, Trash2, Plus, Search, UserX, X, Check, ChevronRight, ChevronLeft, Info, RotateCcw, CalendarOff, CalendarCheck, Save } from 'lucide-react';

export default function DoctorManagement() {
  const { doctors, deleteDoctor, addDoctor, updateDoctor, schedules, holidays, saveWorkloadSnapshots } = useDataStore();
  const [snapshotState, setSnapshotState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const [activeTab, setActiveTab] = useState<'doctors' | 'analytics'>('doctors');
  const [searchText, setSearchText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Doctor | null>(null);
  const [touchStartY, setTouchStartY] = useState(0);
  const [modalTranslate, setModalTranslate] = useState(0);

  // Analytics state
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [filterYears, setFilterYears] = useState<Set<ResidencyYear>>(new Set([ResidencyYear.year1, ResidencyYear.year2, ResidencyYear.year3]));
  const engMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Form State
  const [name, setName] = useState('');
  const [residencyYear, setResidencyYear] = useState<ResidencyYear>(ResidencyYear.year1);
  const [offDays, setOffDays] = useState<Set<number>>(new Set());
  const [blackoutDays, setBlackoutDays] = useState<number[]>([]);
  const [hasBlackout, setHasBlackout] = useState(false);
  // Baseline historical counts (paper records) — used as "prev" in analytics
  const [baseWeekday, setBaseWeekday] = useState<string>('');
  const [baseWeekend, setBaseWeekend] = useState<string>('');
  const [baseWeekdayHol, setBaseWeekdayHol] = useState<string>('');
  const [baseLong3, setBaseLong3] = useState<string>('');
  const [baseExtraLong, setBaseExtraLong] = useState<string>('');
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(new Set());


  const filteredDoctors = useMemo(() => {
    if (!searchText.trim()) return doctors;
    return doctors.filter(d => d.name.toLowerCase().includes(searchText.toLowerCase()));
  }, [doctors, searchText]);

  const avgWorkload = useMemo(() => {
    const latest = [...schedules].sort((a,b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    })[0];
    if (!latest || doctors.length === 0) return "0";
    const totalAssigned = latest.assignments.filter(a => a.doctorId).length;
    return (totalAssigned / doctors.length).toFixed(1);
  }, [schedules, doctors]);

  const analyticsStats = useMemo(() => {
    // Deduplicate: if Firestore has multiple schedules for the same month/year/residency
    // (can happen from regeneration), keep only the latest per residency year.
    const dedupe = (scheds: typeof schedules) => {
      const byYear = new Map<ResidencyYear, typeof scheds[0]>();
      [...scheds].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).forEach(s => {
        s.selectedYears.forEach(ry => { if (!byYear.has(ry)) byYear.set(ry, s); });
      });
      return Array.from(new Set(byYear.values()));
    };
    const currentMonthSchedules = dedupe(schedules.filter(s => s.month === selectedMonth && s.year === selectedYear));
    // All schedules from months BEFORE the selected month — for auto-accumulation
    const allPriorSchedules = dedupe(schedules.filter(s =>
      s.year < selectedYear || (s.year === selectedYear && s.month < selectedMonth)
    ));
    // Group prior schedules by their own month/year so block detection works correctly per-month
    const priorByMonth = new Map<string, typeof schedules>();
    allPriorSchedules.forEach(s => {
      const key = `${s.year}-${s.month}`;
      if (!priorByMonth.has(key)) priorByMonth.set(key, []);
      priorByMonth.get(key)!.push(s);
    });

    const isHolidayOnly = (d: number, m: number, y: number) =>
      holidays.some(h => { const hd = new Date(h.date); return hd.getDate() === d && hd.getMonth() === m - 1 && hd.getFullYear() === y; });

    const getDayType = (d: number, m: number, y: number) => {
      const dt = new Date(y, m - 1, d);
      const dow = dt.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const isHoliday = isHolidayOnly(d, m, y);
      return { isWeekend, isHoliday, isSpecial: isWeekend || isHoliday };
    };

    const data = doctors
      .filter(d => filterYears.has(d.residencyYear))
      .map(doc => {
        let shiftsThisMonth = 0;
        currentMonthSchedules.forEach(s => { shiftsThisMonth += s.assignments.filter(a => a.doctorId === doc.id).length; });

        // Compute holiday-related counts for a given month/year and its schedules
        const computeHolidayCounts = (m: number, y: number, scheds: typeof schedules) => {
          const dIM = new Date(y, m, 0).getDate();
          const assigned = new Set<number>();
          scheds.forEach(s => { s.assignments.filter(a => a.doctorId === doc.id).forEach(a => assigned.add(a.day)); });

          const dTypes = Array.from({ length: dIM }, (_, i) => getDayType(i + 1, m, y));
          const bks: { start: number, end: number, length: number }[] = [];
          let blkStart = -1;
          dTypes.forEach((type, idx) => {
            if (type.isSpecial) { if (blkStart === -1) blkStart = idx + 1; }
            else { if (blkStart !== -1) { bks.push({ start: blkStart, end: idx, length: idx - blkStart + 1 }); blkStart = -1; } }
          });
          if (blkStart !== -1) bks.push({ start: blkStart, end: dIM, length: dIM - blkStart + 1 });

          let wkend = 0, wkdayHol = 0, long3 = 0, longExtra = 0, totalForMonth = 0;
          scheds.forEach(s => { totalForMonth += s.assignments.filter(a => a.doctorId === doc.id).length; });
          assigned.forEach(day => {
            const type = dTypes[day - 1];
            if (type.isWeekend) wkend++;
            if (type.isHoliday && !type.isWeekend) wkdayHol++;
            const block = bks.find(b => day >= b.start && day <= b.end);
            if (block) { if (block.length === 3) long3++; else if (block.length > 3) longExtra++; }
          });
          const wkday = Math.max(0, totalForMonth - wkend - wkdayHol);
          return { wkend, wkdayHol, long3, longExtra, wkday };
        };

        const cur = computeHolidayCounts(selectedMonth, selectedYear, currentMonthSchedules);
        const curWeekday = cur.wkday;

        // Accumulate across ALL prior months (each grouped by its own year-month)
        let accWkend = 0, accWkdayHol = 0, accLong3 = 0, accExtraLong = 0, accWkday = 0;
        priorByMonth.forEach((monthScheds, key) => {
          const [y, m] = key.split('-').map(Number);
          const c = computeHolidayCounts(m, y, monthScheds);
          accWkend += c.wkend; accWkdayHol += c.wkdayHol;
          accLong3 += c.long3; accExtraLong += c.longExtra;
          accWkday += c.wkday;
        });

        // Prev = baseline (frozen paper records) + accumulated app-data from all prior months
        const b = doc.baselines || {};
        const prevWeekend = (b.weekendPrev ?? 0) + accWkend;
        const prevWkdayHol = (b.weekdayHolidayPrev ?? 0) + accWkdayHol;
        const prevLong3 = (b.longHoliday3Prev ?? 0) + accLong3;
        const prevExtraLong = (b.extraLongHolidayPrev ?? 0) + accExtraLong;
        const prevWeekday = (b.weekdayPrev ?? 0) + accWkday;

        return {
          doctor: doc,
          shiftsThisMonth,
          weekdayShiftsPrev: prevWeekday, specialShiftsPrev: 0,
          shiftsWeekday: curWeekday,
          shiftsWeekend: cur.wkend, shiftsWeekendPrev: prevWeekend,
          shiftsWeekdayHoliday: cur.wkdayHol, shiftsWeekdayHolidayPrev: prevWkdayHol,
          shiftsInLongHoliday3: cur.long3, shiftsInLongHoliday3Prev: prevLong3,
          shiftsInExtraLongHoliday: cur.longExtra, shiftsInExtraLongHolidayPrev: prevExtraLong,
        };
      });

    const grouped: Record<number, typeof data> = {};
    data.forEach(item => { const ry = item.doctor.residencyYear; if (!grouped[ry]) grouped[ry] = []; grouped[ry].push(item); });
    return grouped;
  }, [doctors, schedules, selectedMonth, selectedYear, filterYears, holidays]);

  const toggleAnalyticsYear = (ry: ResidencyYear) => {
    setFilterYears(prev => { const next = new Set(prev); if (next.has(ry)) next.delete(ry); else next.add(ry); return next; });
  };

  const handleSaveSnapshot = async () => {
    if (snapshotState !== 'idle') return;
    const allRows = Object.values(analyticsStats).flat();
    if (allRows.length === 0) return;
    setSnapshotState('saving');
    try {
      await saveWorkloadSnapshots(allRows.map(r => ({
        doctorId: r.doctor.id,
        doctorName: r.doctor.name,
        residencyYear: r.doctor.residencyYear,
        entry: {
          month: selectedMonth,
          year: selectedYear,
          shiftsThisMonth: r.shiftsThisMonth,
          weekdayShiftsPrev: r.weekdayShiftsPrev,
          specialShiftsPrev: r.specialShiftsPrev,
          shiftsWeekend: r.shiftsWeekend,
          shiftsWeekendPrev: r.shiftsWeekendPrev,
          shiftsWeekdayHoliday: r.shiftsWeekdayHoliday,
          shiftsWeekdayHolidayPrev: r.shiftsWeekdayHolidayPrev,
          shiftsInLongHoliday3: r.shiftsInLongHoliday3,
          shiftsInLongHoliday3Prev: r.shiftsInLongHoliday3Prev,
          shiftsInExtraLongHoliday: r.shiftsInExtraLongHoliday,
          shiftsInExtraLongHolidayPrev: r.shiftsInExtraLongHolidayPrev,
        },
      })));
      setSnapshotState('saved');
      setTimeout(() => setSnapshotState('idle'), 2000);
    } catch (err) {
      console.error('Error saving snapshot:', err);
      setSnapshotState('idle');
    }
  };

  const handleOpenModal = (doc: Doctor | null = null) => {
    if (doc) {
      setEditingDoc(doc);
      setName(doc.name);
      setResidencyYear(doc.residencyYear);
      setOffDays(new Set(doc.offDays));
      setBlackoutDays(doc.blackoutPeriods.map(bp => bp.startDay));
      setHasBlackout(doc.blackoutPeriods.length > 0);
      const b = doc.baselines || {};
      setBaseWeekday(b.weekdayPrev?.toString() ?? '');
      setBaseWeekend(b.weekendPrev?.toString() ?? '');
      setBaseWeekdayHol(b.weekdayHolidayPrev?.toString() ?? '');
      setBaseLong3(b.longHoliday3Prev?.toString() ?? '');
      setBaseExtraLong(b.extraLongHolidayPrev?.toString() ?? '');
    } else {
      setEditingDoc(null);
      setName('');
      setResidencyYear(ResidencyYear.year1);
      setOffDays(new Set([0, 6])); // Default Sun, Sat
      setBlackoutDays([]);
      setHasBlackout(false);
      setBaseWeekday(''); setBaseWeekend(''); setBaseWeekdayHol(''); setBaseLong3(''); setBaseExtraLong('');
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const parseNum = (s: string): number | undefined => {
      const t = s.trim();
      if (t === '') return undefined;
      const n = Number(t);
      return Number.isFinite(n) ? n : undefined;
    };
    const baselines = {
      weekdayPrev: parseNum(baseWeekday),
      weekendPrev: parseNum(baseWeekend),
      weekdayHolidayPrev: parseNum(baseWeekdayHol),
      longHoliday3Prev: parseNum(baseLong3),
      extraLongHolidayPrev: parseNum(baseExtraLong),
    };
    const hasAnyBaseline = Object.values(baselines).some(v => v !== undefined);

    const doc: Doctor = {
      id: editingDoc ? editingDoc.id : uuidv4(),
      name,
      residencyYear,
      offDays: Array.from(offDays).sort(),
      blackoutPeriods: hasBlackout ? blackoutDays.map(day => ({
        id: uuidv4(),
        startDay: day,
        endDay: day,
      })) : [],
      ...(hasAnyBaseline ? { baselines } : {}),
    };

    if (editingDoc) updateDoctor(doc);
    else addDoctor(doc);

    setIsModalOpen(false);
  };

  const shiftCountForLatest = (docId: string) => {
    const latest = [...schedules].sort((a,b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    })[0];
    if (!latest) return 0;
    return latest.assignments.filter(a => a.doctorId === docId).length;
  };

  const renderCard = (doc: Doctor) => {
    const shiftCount = shiftCountForLatest(doc.id);
    return (
      <div key={doc.id} className="card-premium" style={{ 
        marginBottom: '12px', display: 'flex', flexDirection: 'column',
        cursor: 'pointer', overflow: 'hidden'
      }} onClick={() => { setEditingDoc(doc); handleOpenModal(doc); }}>
        
        {/* Top Row: Avatar, Info, Actions */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', gap: '16px' }}>
          <div style={{
            width: '50px', height: '50px', borderRadius: '50%', background: residencyYearBadgeColor(doc.residencyYear),
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', fontWeight: 'bold', flexShrink: 0
          }}>
            {getDoctorInitial(doc.name)}
          </div>
          
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {doc.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ 
                background: residencyYearBadgeColor(doc.residencyYear), color: 'white', padding: '2px 7px', 
                borderRadius: '6px', fontSize: '11px', fontWeight: '600' 
              }}>
                {residencyYearShortName(doc.residencyYear)}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Moon size={12} fill="currentColor" /> Off: {doc.offDays.map(dayOfWeekShortname).join(', ')}
              </span>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', marginLeft: '8px' }}>
            <button onClick={(e) => { e.stopPropagation(); handleOpenModal(doc); }} style={{ 
              width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0,0,0,0.05)', 
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' 
            }}>
              <Edit2 size={14} color="var(--text-muted)" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); if(window.confirm(`Delete ${doc.name}?`)) deleteDoctor(doc.id); }} style={{ 
              width: '32px', height: '32px', borderRadius: '8px', background: '#FFD6D6', 
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' 
            }}>
              <Trash2 size={14} color="#E74C3C" />
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.02)', borderTop: '1px solid var(--border)' }}>
          <div style={{ flex: 1, padding: '8px 0', textAlign: 'center' }}>
            <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'gray' }}>{doc.offDays.length}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Off Days</div>
          </div>
          <div style={{ width: '1px', background: 'var(--border)', margin: '8px 0' }} />
          <div style={{ flex: 1, padding: '8px 0', textAlign: 'center' }}>
            <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#E67E22' }}>{doc.blackoutPeriods.length}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Blackout</div>
          </div>
          <div style={{ width: '1px', background: 'var(--border)', margin: '8px 0' }} />
          <div style={{ flex: 1, padding: '8px 0', textAlign: 'center' }}>
            <div style={{ fontSize: '15px', fontWeight: 'bold', color: residencyYearBadgeColor(doc.residencyYear) }}>{shiftCount}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Last Shifts</div>
          </div>
        </div>

        {/* Blackout Tags */}
        {doc.blackoutPeriods.length > 0 && (
          <div style={{ padding: '10px 16px', display: 'flex', overflowX: 'auto', gap: '6px', borderTop: '1px solid var(--border)' }}>
             {doc.blackoutPeriods.map((bp) => (
               <div key={bp.id} style={{ 
                 padding: '4px 10px', background: 'rgba(0,0,0,0.05)', borderRadius: '8px', 
                 fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)', whiteSpace: 'nowrap' 
               }}>
                 {bp.startDay} - {bp.endDay}
               </div>
             ))}
          </div>
        )}
      </div>
    );
  };

  const toggleCollapse = (ry: number) => {
    setCollapsedYears(prev => {
      const copy = new Set(prev);
      if (copy.has(ry)) copy.delete(ry);
      else copy.add(ry);
      return copy;
    });
  };

  const renderGroupedList = () => {
    const years = [ResidencyYear.year6, ResidencyYear.year5, ResidencyYear.year4, ResidencyYear.year3, ResidencyYear.year2, ResidencyYear.year1];
    return years.map(ry => {
      const gDocs = doctors.filter(d => d.residencyYear === ry);
      if (gDocs.length === 0) return null;
      const isCollapsed = collapsedYears.has(ry);
      return (
        <div key={ry} style={{ marginBottom: '12px' }}>
          <div 
            onClick={() => toggleCollapse(ry)}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', padding: '10px 8px', 
              cursor: 'pointer', borderRadius: '10px', transition: 'background 0.2s',
              userSelect: 'none'
            }}
            className="hover-bg"
          >
            <div style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'flex', color: 'var(--text-muted)' }}>
               <ChevronRight size={16} />
            </div>
            <span style={{ fontSize: '14px', fontWeight: '700', color: residencyYearBadgeColor(ry), textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {residencyYearShortName(ry)}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>
              ({gDocs.length} People)
            </span>
          </div>
          {!isCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {gDocs.map((doc) => renderCard(doc))}
            </div>
          )}
        </div>
      );
    });
  };

  const toggleOffDay = (d: number) => {
    setOffDays(prev => {
      const copy = new Set(prev);
      if (copy.has(d)) copy.delete(d);
      else copy.add(d);
      return copy;
    });
  };

  const setTeamOffDays = (days: number[]) => setOffDays(new Set(days));

  const teams = [
    { name: 'Mon Team', days: [1, 2, 3], bg: '#BFDBFE', text: '#1A1A2E' },
    { name: 'Tue Team', days: [2, 3, 4], bg: '#BBF7D0', text: '#1A1A2E' },
    { name: 'Wed Team', days: [3, 4, 5], bg: '#E9D5FF', text: '#1A1A2E' },
    { name: 'Thu Team', days: [4, 5, 6], bg: '#FED7AA', text: '#1A1A2E' },
    { name: 'Fri Team', days: [5, 1], bg: '#FECDD3', text: '#1A1A2E' }
  ];

  const daysArr = [0, 1, 2, 3, 4, 5, 6];

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 16px 60px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0 }}>Doctors</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '4px 0 0' }}>Manage doctors and view workload analytics</p>
        </div>
        {activeTab === 'doctors' && (
          <button
            onClick={() => handleOpenModal()}
            style={{
              background: '#2E5BFF', color: 'white', border: 'none', padding: '9px 14px',
              borderRadius: '10px', fontWeight: '600', fontSize: '14px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Plus size={16} strokeWidth={3} />
            Add Doctor
          </button>
        )}
        {activeTab === 'analytics' && (
          <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-card)', padding: '4px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <button
              onClick={() => { if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(v => v - 1); } else setSelectedMonth(v => v - 1); }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex', color: 'var(--text-main)' }}
            >
              <ChevronLeft size={18} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: '13px', fontWeight: 'bold', color: '#2E5BFF', minWidth: '120px', justifyContent: 'center' }}>
              {engMonths[selectedMonth - 1]} {selectedYear}
            </div>
            <button
              onClick={() => { if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(v => v + 1); } else setSelectedMonth(v => v + 1); }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex', color: 'var(--text-main)' }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Tab Toggle */}
      <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: '12px', padding: '4px', marginBottom: '20px', gap: '4px', border: '1px solid var(--border)' }}>
        {(['doctors', 'analytics'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: '9px', borderRadius: '9px', border: 'none', cursor: 'pointer',
              fontWeight: '600', fontSize: '13px',
              background: activeTab === tab ? '#2E5BFF' : 'transparent',
              color: activeTab === tab ? 'white' : 'var(--text-muted)',
              transition: 'background 0.15s, color 0.15s'
            }}
          >
            {tab === 'doctors' ? 'Doctors' : 'Analytics'}
          </button>
        ))}
      </div>

      {activeTab === 'doctors' && (<>
      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(0,0,0,0.05)', padding: '12px', borderRadius: '12px', marginBottom: '16px' }}>
        <Search size={18} color="var(--text-muted)" strokeWidth={2.5} />
        <input
          placeholder="Search Doctors"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ border: 'none', background: 'transparent', fontSize: '15px', color: 'var(--text-main)', flex: 1, outline: 'none' }}
        />
      </div>

      {/* Summary Pill Bar */}
      <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '24px' }}>
        <div style={{ flex: 1, padding: '12px 0', textAlign: 'center' }}>
           <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2E5BFF' }}>{doctors.length}</div>
           <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>All Doctors</div>
        </div>
        <div style={{ width: '1px', background: 'var(--border)', margin: '14px 0' }} />
        <div style={{ flex: 1, padding: '12px 0', textAlign: 'center' }}>
           <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#00B27A' }}>{avgWorkload}</div>
           <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Avg. Shifts/Doc</div>
        </div>
        <div style={{ width: '1px', background: 'var(--border)', margin: '14px 0' }} />
        <div style={{ flex: 1, padding: '12px 0', textAlign: 'center' }}>
           <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#E67E22' }}>{doctors.filter(d => d.blackoutPeriods.length > 0).length}</div>
           <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Has Blackout</div>
        </div>
      </div>

      {/* List */}
      {!searchText.trim() ? renderGroupedList() : (
        filteredDoctors.length > 0 ? (
          <div>{filteredDoctors.map((doc) => renderCard(doc))}</div>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
             <div style={{ display: 'flex', justifyContent: 'center', opacity: 0.3, marginBottom: '12px' }}>
               <UserX size={48} strokeWidth={1.5} />
             </div>
             <div style={{ fontSize: '15px' }}>No doctors found</div>
          </div>
        )
      )}
      </>)}

      {activeTab === 'analytics' && (<>
      {/* Analytics Year Filter */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', alignItems: 'center' }}>
        {[ResidencyYear.year1, ResidencyYear.year2, ResidencyYear.year3].map(ry => {
          const isSel = filterYears.has(ry);
          const color = residencyYearBadgeColor(ry);
          return (
            <button key={ry} onClick={() => toggleAnalyticsYear(ry)} style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', border: `1.5px solid ${isSel ? color : 'var(--border)'}`, background: isSel ? color : 'transparent', color: isSel ? 'white' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s' }}>
              {residencyYearShortName(ry)}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <button
          onClick={handleSaveSnapshot}
          disabled={snapshotState !== 'idle' || Object.values(analyticsStats).flat().length === 0}
          style={{
            padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold',
            border: 'none',
            background: snapshotState === 'saved' ? '#27AE60' : '#2E5BFF',
            color: 'white',
            cursor: snapshotState === 'idle' ? 'pointer' : 'default',
            opacity: Object.values(analyticsStats).flat().length === 0 ? 0.5 : 1,
            display: 'flex', alignItems: 'center', gap: '6px',
            transition: 'background 0.2s'
          }}
        >
          {snapshotState === 'saved'
            ? <><Check size={14} /> Saved</>
            : snapshotState === 'saving'
              ? <><Save size={14} /> Saving...</>
              : <><Save size={14} /> Save Snapshot</>}
        </button>
      </div>

      {/* Analytics Table */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '20px', overflowX: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.05)', border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '780px' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: '12px', color: 'var(--text-muted)', width: '180px' }}>Doctor</th>
              <th style={{ textAlign: 'center', padding: '14px 10px', fontSize: '12px', color: 'var(--text-muted)' }}>เวรเดือนนี้</th>
              <th style={{ textAlign: 'center', padding: '14px 10px', fontSize: '12px', color: 'var(--text-muted)' }}>เวรธรรมดา</th>
              <th style={{ textAlign: 'center', padding: '14px 10px', fontSize: '12px', color: 'var(--text-muted)' }}>หยุด (ส-อา)</th>
              <th style={{ textAlign: 'center', padding: '14px 10px', fontSize: '12px', color: 'var(--text-muted)' }}>หยุดธรรมดา</th>
              <th style={{ textAlign: 'center', padding: '14px 10px', fontSize: '12px', color: 'var(--text-muted)' }}>หยุดยาว (=3)</th>
              <th style={{ textAlign: 'center', padding: '14px 10px', fontSize: '12px', color: 'var(--text-muted)' }}>หยุดยาววว (&gt;3)</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(analyticsStats).sort().reverse().map(ryKey => {
              const ry = Number(ryKey) as ResidencyYear;
              const group = analyticsStats[ry];
              return (
                <Fragment key={ry}>
                  <tr style={{ background: 'rgba(0,0,0,0.03)' }}>
                    <td colSpan={7} style={{ padding: '8px 16px', fontSize: '11px', fontWeight: 'bold', color: residencyYearBadgeColor(ry), letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>
                      {residencyYearShortName(ry)} GROUP
                    </td>
                  </tr>
                  {group.map(({ doctor, shiftsThisMonth, weekdayShiftsPrev, shiftsWeekday, shiftsWeekend, shiftsWeekendPrev, shiftsWeekdayHoliday, shiftsWeekdayHolidayPrev, shiftsInLongHoliday3, shiftsInLongHoliday3Prev, shiftsInExtraLongHoliday, shiftsInExtraLongHolidayPrev }) => (
                    <tr key={doctor.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }} className="hover-bg">
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: residencyYearBadgeColor(doctor.residencyYear), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', flexShrink: 0 }}>
                            {getDoctorInitial(doctor.name)}
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: '700' }}>{doctor.name}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}><span style={{ fontSize: '15px', fontWeight: '800', color: '#2E5BFF' }}>{shiftsThisMonth}</span></td>
                      <td style={{ textAlign: 'center' }}><span style={{ fontSize: '13px', fontWeight: '600' }}>{weekdayShiftsPrev}+{shiftsWeekday}</span></td>
                      <td style={{ textAlign: 'center' }}><span style={{ fontSize: '13px', fontWeight: '600', color: '#E74C3C' }}>{shiftsWeekendPrev}+{shiftsWeekend}</span></td>
                      <td style={{ textAlign: 'center' }}><span style={{ fontSize: '13px', fontWeight: '600', color: '#27AE60' }}>{shiftsWeekdayHolidayPrev}+{shiftsWeekdayHoliday}</span></td>
                      <td style={{ textAlign: 'center' }}><div style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: '6px', background: 'rgba(230, 126, 34, 0.1)', color: '#E67E22', fontSize: '13px', fontWeight: 'bold' }}>{shiftsInLongHoliday3Prev}+{shiftsInLongHoliday3}</div></td>
                      <td style={{ textAlign: 'center' }}><div style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: '6px', background: 'rgba(142, 68, 173, 0.1)', color: '#8E44AD', fontSize: '13px', fontWeight: 'bold' }}>{shiftsInExtraLongHolidayPrev}+{shiftsInExtraLongHoliday}</div></td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(46, 91, 255, 0.05)', borderRadius: '14px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <Info size={18} color="#2E5BFF" style={{ marginTop: '2px', flexShrink: 0 }} />
        <div>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#2E5BFF' }}>Analytics Definitions</h4>
          <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.7' }}>
            <li><strong>เวรธรรมดา:</strong> เวรวันจันทร์-ศุกร์ที่ไม่ใช่วันหยุด (baseline + เดือนปัจจุบัน)</li>
            <li><strong>หยุด (ส-อา):</strong> จำนวนเวรที่อยู่ในวันเสาร์-อาทิตย์</li>
            <li><strong>หยุดธรรมดา:</strong> จำนวนเวรวันจันทร์-ศุกร์ที่เป็นวันหยุด</li>
            <li><strong>หยุดยาว:</strong> ช่วงวันหยุดติดต่อกัน "เท่ากับ 3 วัน"</li>
            <li><strong>หยุดยาววว:</strong> ช่วงวันหยุดติดต่อกัน "มากกว่า 3 วัน"</li>
          </ul>
        </div>
      </div>
      </>)}

      {/* DoctorFormSheet Modal */}
      {isModalOpen && createPortal(
        <div 
          onClick={() => setIsModalOpen(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            animation: 'fadeIn 0.2s ease-out',
            padding: '40px 16px',
            overflowY: 'auto'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            onTouchStart={(e) => setTouchStartY(e.touches[0].clientY)}
            onTouchMove={(e) => {
              const diff = e.touches[0].clientY - touchStartY;
              if (diff > 0) setModalTranslate(diff);
            }}
            onTouchEnd={() => {
              if (modalTranslate > 120) {
                setIsModalOpen(false);
              }
              setModalTranslate(0);
            }}
            style={{
              background: 'var(--bg-card)', width: '100%', maxWidth: '520px',
              borderRadius: '24px', maxHeight: 'none', display: 'flex', flexDirection: 'column',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)', margin: 'auto',
              transform: `translateY(${modalTranslate}px)`,
              transition: modalTranslate === 0 ? 'transform 0.2s ease-out' : 'none'
            }}
          >

            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: '30px' }} /> {/* Spacer */}
              <h2 style={{ fontSize: '17px', fontWeight: 'bold', margin: 0 }}>{editingDoc ? 'Edit Doctor' : 'Add Doctor'}</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ 
                background: 'rgba(0,0,0,0.08)', border: 'none', width:'30px', height:'30px', borderRadius:'15px',
                display:'flex', alignItems:'center', justifyContent:'center', color: 'var(--text-muted)', cursor: 'pointer' 
              }}>
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Name Field */}
              <div>
                <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>Doctor Name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="E.g. Dr. Thanasit"
                  style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '16px', outline: 'none' }}
                />
              </div>

              {/* Residency Year Field */}
              <div>
                <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>Residency Year</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[ResidencyYear.year1, ResidencyYear.year2, ResidencyYear.year3].map(ry => {
                     const isSel = residencyYear === ry;
                     const c = residencyYearBadgeColor(ry);
                     return (
                       <button key={ry} onClick={() => setResidencyYear(ry)} style={{
                         padding: '7px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: isSel ? 'bold' : '500',
                         background: isSel ? c : `${c}1A`, color: isSel ? '#fff' : c,
                         border: 'none', cursor: 'pointer', transition: 'all 0.15s ease'
                       }}>
                         {residencyYearShortName(ry)}
                       </button>
                     );
                  })}
                </div>
              </div>

              {/* Off Days */}
              <div>
                <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>Regular Off Days</label>
                
                {/* Patterns */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                  {teams.map(t => {
                    const isSel = Array.from(offDays).sort().join(',') === t.days.sort().join(',');
                    return (
                      <button key={t.name} onClick={() => setTeamOffDays(t.days)} style={{
                        padding: '10px', borderRadius: '10px', background: isSel ? t.bg : `${t.bg}99`,
                        border: isSel ? `2.5px solid ${t.bg}` : '2.5px solid transparent',
                        textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                        boxShadow: isSel ? `0 0 0 1px ${t.text}` : 'none'
                      }}>
                        <span style={{ fontWeight: '600', color: t.text, fontSize: '13px' }}>{t.name}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Off: {t.days.map(dayOfWeekShortname).join(', ')}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Day Toggles */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {daysArr.map(d => {
                    const isSel = offDays.has(d);
                    return (
                      <button key={d} onClick={() => toggleOffDay(d)} style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                        background: 'transparent', border: 'none', cursor: 'pointer'
                      }}>
                        <div style={{
                           width: '36px', height: '36px', borderRadius: '50%',
                           background: isSel ? '#2E5BFF' : 'rgba(0,0,0,0.05)',
                           display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                           {isSel && <Check color="#fff" size={16} strokeWidth={3} />}
                        </div>
                        <span style={{ fontSize: '11px', color: isSel ? '#2E5BFF' : 'var(--text-muted)' }}>
                           {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Blackouts */}
              <div>
                <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)', display: 'block', marginBottom: '10px' }}>Blackout Period</label>

                {/* Toggle */}
                <div style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', borderRadius: '12px', padding: '4px', gap: '4px', marginBottom: '16px' }}>
                  <button
                    onClick={() => setHasBlackout(false)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                      padding: '10px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                      background: !hasBlackout ? 'var(--bg-card)' : 'transparent',
                      color: !hasBlackout ? 'var(--text-main)' : 'var(--text-muted)',
                      boxShadow: !hasBlackout ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.18s ease',
                    }}
                  >
                    <CalendarCheck size={15} />
                    No Blackout
                  </button>
                  <button
                    onClick={() => setHasBlackout(true)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                      padding: '10px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                      background: hasBlackout ? 'var(--bg-card)' : 'transparent',
                      color: hasBlackout ? '#E67E22' : 'var(--text-muted)',
                      boxShadow: hasBlackout ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.18s ease',
                    }}
                  >
                    <CalendarOff size={15} />
                    Has Blackout
                  </button>
                </div>

                {hasBlackout && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                      <button
                        onClick={() => setBlackoutDays([])}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          background: 'rgba(231,76,60,0.08)', color: '#E74C3C',
                          border: '1px solid rgba(231,76,60,0.2)', borderRadius: '8px',
                          padding: '6px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                        }}
                      >
                        <RotateCcw size={13} />
                        Reset Blackout
                      </button>
                    </div>
                    <BlackoutCalendar
                      selectedDays={blackoutDays}
                      offDays={Array.from(offDays)}
                      onChange={setBlackoutDays}
                    />
                  </div>
                )}

                {/* Historical Baselines (paper records) */}
                <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>
                    Historical Baselines (Optional)
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Carry-over counts from paper records. Used as the "prev" portion in analytics. Leave blank to use auto-computed previous month.
                  </div>
                  {[
                    { label: 'เวรวันธรรมดา (เดือนก่อน)', value: baseWeekday, set: setBaseWeekday },
                    { label: 'หยุด (ส-อา)', value: baseWeekend, set: setBaseWeekend },
                    { label: 'หยุดธรรมดา', value: baseWeekdayHol, set: setBaseWeekdayHol },
                    { label: 'หยุดยาว (=3)', value: baseLong3, set: setBaseLong3 },
                    { label: 'หยุดยาววว (>3)', value: baseExtraLong, set: setBaseExtraLong },
                  ].map(({ label, value, set }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <label style={{ flex: 1, fontSize: '12px', color: 'var(--text-muted)' }}>{label}</label>
                      <input
                        type="number"
                        min="0"
                        value={value}
                        onChange={e => set(e.target.value)}
                        placeholder="auto"
                        style={{ width: '90px', padding: '8px 10px', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '13px', textAlign: 'center', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', borderRadius: '0 0 24px 24px' }}>
                <button
                  onClick={handleSave}
                  disabled={!name.trim()}
                  style={{ width: '100%', padding: '14px', borderRadius: '14px', fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', background: name.trim() ? '#2E5BFF' : 'gray', color: 'white', border: 'none', cursor: name.trim() ? 'pointer' : 'default' }}
                >
                  Save
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  style={{ width: '100%', padding: '14px', borderRadius: '14px', fontSize: '15px', fontWeight: '600', color: 'var(--text-muted)', border: 'none', background: 'transparent', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>

            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
