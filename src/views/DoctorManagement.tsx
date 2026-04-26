import { useState, useMemo, Fragment } from 'react';
import { createPortal } from 'react-dom';

import { useDataStore } from '../store/DataStore';
import { ResidencyYear, residencyYearBadgeColor, residencyYearShortName, dayOfWeekShortname, getDoctorInitial, type Doctor } from '../models';
import { BlackoutCalendar } from '../components/BlackoutCalendar';
import { v4 as uuidv4 } from 'uuid';
import { Moon, Edit2, Trash2, Plus, Search, UserX, X, Check, ChevronRight, ChevronLeft, Info, RotateCcw, CalendarOff, CalendarCheck } from 'lucide-react';

export default function DoctorManagement() {
  const { doctors, deleteDoctor, addDoctor, updateDoctor, schedules, holidays } = useDataStore();

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
    const currentMonthSchedules = schedules.filter(s => s.month === selectedMonth && s.year === selectedYear);
    const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
    const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
    const prevMonthSchedules = schedules.filter(s => s.month === prevMonth && s.year === prevYear);

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

        let weekdayShiftsPrev = 0, specialShiftsPrev = 0;
        prevMonthSchedules.forEach(s => {
          s.assignments.filter(a => a.doctorId === doc.id).forEach(a => {
            if (getDayType(a.day, prevMonth, prevYear).isSpecial) specialShiftsPrev++;
            else weekdayShiftsPrev++;
          });
        });

        const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
        const assignedDays = new Set<number>();
        currentMonthSchedules.forEach(s => { s.assignments.filter(a => a.doctorId === doc.id).forEach(a => assignedDays.add(a.day)); });

        let shiftsWeekend = 0, shiftsWeekdayHoliday = 0;
        const dayTypes = Array.from({ length: daysInMonth }, (_, i) => getDayType(i + 1, selectedMonth, selectedYear));

        const blocks: { start: number, end: number, length: number }[] = [];
        let currentBlockStart = -1;
        dayTypes.forEach((type, idx) => {
          if (type.isSpecial) { if (currentBlockStart === -1) currentBlockStart = idx + 1; }
          else { if (currentBlockStart !== -1) { blocks.push({ start: currentBlockStart, end: idx, length: idx - currentBlockStart + 1 }); currentBlockStart = -1; } }
        });
        if (currentBlockStart !== -1) blocks.push({ start: currentBlockStart, end: daysInMonth, length: daysInMonth - currentBlockStart + 1 });

        let shiftsInLongHoliday3 = 0, shiftsInExtraLongHoliday = 0;
        assignedDays.forEach(day => {
          const type = dayTypes[day - 1];
          if (type.isWeekend) shiftsWeekend++;
          if (type.isHoliday && !type.isWeekend) shiftsWeekdayHoliday++;
          const block = blocks.find(b => day >= b.start && day <= b.end);
          if (block) { if (block.length === 3) shiftsInLongHoliday3++; else if (block.length > 3) shiftsInExtraLongHoliday++; }
        });

        return { doctor: doc, shiftsThisMonth, weekdayShiftsPrev: `${weekdayShiftsPrev}+${specialShiftsPrev}`, shiftsWeekend, shiftsWeekdayHoliday, shiftsInLongHoliday3, shiftsInExtraLongHoliday };
      });

    const grouped: Record<number, typeof data> = {};
    data.forEach(item => { const ry = item.doctor.residencyYear; if (!grouped[ry]) grouped[ry] = []; grouped[ry].push(item); });
    return grouped;
  }, [doctors, schedules, selectedMonth, selectedYear, filterYears, holidays]);

  const toggleAnalyticsYear = (ry: ResidencyYear) => {
    setFilterYears(prev => { const next = new Set(prev); if (next.has(ry)) next.delete(ry); else next.add(ry); return next; });
  };

  const handleOpenModal = (doc: Doctor | null = null) => {
    if (doc) {
      setEditingDoc(doc);
      setName(doc.name);
      setResidencyYear(doc.residencyYear);
      setOffDays(new Set(doc.offDays));
      setBlackoutDays(doc.blackoutPeriods.map(bp => bp.startDay));
      setHasBlackout(doc.blackoutPeriods.length > 0);
    } else {
      setEditingDoc(null);
      setName('');
      setResidencyYear(ResidencyYear.year1);
      setOffDays(new Set([0, 6])); // Default Sun, Sat
      setBlackoutDays([]);
      setHasBlackout(false);
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) return;
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
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {[ResidencyYear.year1, ResidencyYear.year2, ResidencyYear.year3].map(ry => {
          const isSel = filterYears.has(ry);
          const color = residencyYearBadgeColor(ry);
          return (
            <button key={ry} onClick={() => toggleAnalyticsYear(ry)} style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', border: `1.5px solid ${isSel ? color : 'var(--border)'}`, background: isSel ? color : 'transparent', color: isSel ? 'white' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s' }}>
              {residencyYearShortName(ry)}
            </button>
          );
        })}
      </div>

      {/* Analytics Table */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '20px', overflowX: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.05)', border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '780px' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: '12px', color: 'var(--text-muted)', width: '180px' }}>Doctor</th>
              <th style={{ textAlign: 'center', padding: '14px 10px', fontSize: '12px', color: 'var(--text-muted)' }}>เวรเดือนนี้</th>
              <th style={{ textAlign: 'center', padding: '14px 10px', fontSize: '12px', color: 'var(--text-muted)' }}>เวรธรรมดา (เดือนก่อน)</th>
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
                  {group.map(({ doctor, shiftsThisMonth, weekdayShiftsPrev, shiftsWeekend, shiftsWeekdayHoliday, shiftsInLongHoliday3, shiftsInExtraLongHoliday }) => (
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
                      <td style={{ textAlign: 'center' }}><span style={{ fontSize: '13px', fontWeight: '600' }}>{weekdayShiftsPrev}</span></td>
                      <td style={{ textAlign: 'center' }}><span style={{ fontSize: '13px', fontWeight: '600', color: '#E74C3C' }}>{shiftsWeekend}</span></td>
                      <td style={{ textAlign: 'center' }}><span style={{ fontSize: '13px', fontWeight: '600', color: '#27AE60' }}>{shiftsWeekdayHoliday}</span></td>
                      <td style={{ textAlign: 'center' }}><div style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: '6px', background: 'rgba(230, 126, 34, 0.1)', color: '#E67E22', fontSize: '13px', fontWeight: 'bold' }}>{shiftsInLongHoliday3}</div></td>
                      <td style={{ textAlign: 'center' }}><div style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: '6px', background: 'rgba(142, 68, 173, 0.1)', color: '#8E44AD', fontSize: '13px', fontWeight: 'bold' }}>{shiftsInExtraLongHoliday}</div></td>
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
            <li><strong>เวรธรรมดา (เดือนก่อน):</strong> เฉพาะเวรวันจันทร์-ศุกร์ที่ไม่ใช่วันหยุด (Weekday+Special)</li>
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
