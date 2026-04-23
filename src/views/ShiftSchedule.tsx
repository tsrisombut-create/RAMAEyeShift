import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useDataStore } from '../store/DataStore';
import { ResidencyYear, residencyYearBadgeColor, residencyYearShortName, getDoctorInitial } from '../models';
import type { Doctor, ShiftSchedule } from '../models';
import { BarChart3, Shuffle, Trash2, CalendarX, X, MessageSquare, Download, CheckCircle2, UserX, Check, AlertCircle, Copy } from 'lucide-react';

export default function ShiftScheduleView() {
  const { schedules, generateSchedule, deleteSchedule, deleteScheduleByYear, updateAssignment, doctors, generateLineMessage, generateCombinedCSV, holidays } = useDataStore();
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isGenerating, setIsGenerating] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [selectedYears, setSelectedYears] = useState<Set<ResidencyYear>>(new Set([ResidencyYear.year1]));
  
  const [editTarget, setEditTarget] = useState<{ schedule: ShiftSchedule, day: number } | null>(null);
  const [showLineModal, setShowLineModal] = useState(false);
  const [forceConfirmTarget, setForceConfirmTarget] = useState<{ doc: Doctor, reason: string } | null>(null);
  const [pendingForceId, setPendingForceId] = useState<string | null>(null);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lineFilterYears, setLineFilterYears] = useState<Set<ResidencyYear>>(new Set([ResidencyYear.year1, ResidencyYear.year2, ResidencyYear.year3]));
  const [deleteTarget, setDeleteTarget] = useState<ResidencyYear | 'all' | null>(null);


  const currentSchedules = schedules.filter(s => s.month === selectedMonth && s.year === selectedYear);
  const hasAnySchedule = currentSchedules.length > 0;

  const engMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const handleGenerateClick = () => {
    if (hasAnySchedule) {
      setShowGenerateConfirm(true);
    } else {
      executeGenerate();
    }
  };

  const executeGenerate = () => {
    setIsGenerating(true);
    setShowGenerateConfirm(false);
    setTimeout(() => {
      // Loop through each selected year to create separate schedules (rows)
      Array.from(selectedYears)
        .sort()
        .forEach(ry => generateSchedule(selectedMonth, selectedYear, new Set([ry])));
      setIsGenerating(false);
    }, 400);
  };

  const handleExportCSV = () => {
    const csv = generateCombinedCSV(selectedMonth, selectedYear);
    if (!csv) return;
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel UTF-8
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `EyeShift_${engMonths[selectedMonth - 1]}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyLine = () => {
    if (currentSchedules.length === 0) return;
    const msg = generateLineMessage(currentSchedules, lineFilterYears);
    navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleYear = (ry: ResidencyYear) => {
    setSelectedYears(prev => {
      const copy = new Set(prev);
      if (copy.has(ry)) copy.delete(ry);
      else copy.add(ry);
      return copy;
    });
  };

  const shiftCountFor = (docId: string, sched: ShiftSchedule) => sched.assignments.filter(a => a.doctorId === docId).length;

  const renderStats = (sched: ShiftSchedule) => {
    const activeDocIds = new Set(sched.assignments.map(a => a.doctorId).filter(Boolean));
    const activeDocs = doctors.filter(d => activeDocIds.has(d.id));

    return (
      <div key={sched.id} style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
           <span style={{ fontSize: '15px', fontWeight: '600' }}>Schedule Stats</span>
           {sched.selectedYears.map(ry => (
             <div key={ry} style={{ display: 'flex', alignItems: 'center', background: residencyYearBadgeColor(ry), borderRadius: '5px', overflow: 'hidden' }}>
               <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'white', padding: '2px 7px' }}>
                 {residencyYearShortName(ry)}
               </span>
               <button 
                 onClick={() => setDeleteTarget(ry)}
                 style={{ background: 'rgba(0,0,0,0.1)', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.2)', padding: '2px 5px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
               >
                 <Trash2 size={10} color="white" />
               </button>
             </div>
           ))}
        </div>
        <div style={{ display: 'flex', overflowX: 'auto', gap: '12px', paddingBottom: '8px' }}>
          {activeDocs.length === 0 ? <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No data</div> : activeDocs.map(doc => {
            const total = shiftCountFor(doc.id, sched);
            let weekend = 0, friday = 0, weekday = 0;
            sched.assignments.filter(a => a.doctorId === doc.id).forEach(a => {
               const dow = new Date(sched.year, sched.month - 1, a.day).getDay();
               if (dow === 0 || dow === 6) weekend++;
               else if (dow === 5) friday++;
               else weekday++;
            });
            return (
              <div key={doc.id} style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '14px', minWidth: '220px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                   <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: residencyYearBadgeColor(doc.residencyYear), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>
                         {getDoctorInitial(doc.name)}
                   </div>
                   <div style={{ fontSize: '13px', fontWeight: '600' }}>{doc.name}</div>
                </div>
                <div style={{ display: 'flex', gap: '12px', textAlign: 'center' }}>
                   <div>
                     <div style={{ fontSize: '22px', fontWeight: 'bold', color: residencyYearBadgeColor(doc.residencyYear) }}>{total}</div>
                     <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Total</div>
                   </div>
                   <div style={{ width: '1px', background: 'var(--border)' }}></div>
                   <div>
                     <div style={{ fontSize: '16px', fontWeight: '600' }}>{weekday}</div>
                     <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Wkday</div>
                   </div>
                   <div>
                     <div style={{ fontSize: '16px', fontWeight: '600', color: '#E67E22' }}>{friday}</div>
                     <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Friday</div>
                   </div>
                   <div>
                     <div style={{ fontSize: '16px', fontWeight: '600', color: '#E74C3C' }}>{weekend}</div>
                     <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Hol.</div>
                   </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    );
  };

  const renderUnifiedTable = (monthSchedules: ShiftSchedule[]) => {
    if (monthSchedules.length === 0) return null;
    
    // Get all residency years across all schedules
    const yearGroups = monthSchedules.reduce((acc, s) => {
      s.selectedYears.forEach(ry => {
        if (!acc.find(g => g.year === ry)) {
          acc.push({ year: ry, scheduleId: s.id });
        }
      });
      return acc;
    }, [] as { year: ResidencyYear, scheduleId: string }[]).sort((a,b) => a.year - b.year);

    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
      <div style={{ background: 'var(--bg-card)', borderRadius: '16px', marginBottom: '16px', overflowX: 'auto', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 20px', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '-0.02em' }}>{engMonths[selectedMonth - 1]} {selectedYear}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{monthSchedules.length} Year Groups</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
             {yearGroups.map(g => (
               <div key={g.year} style={{ display: 'flex', alignItems: 'center', background: residencyYearBadgeColor(g.year), borderRadius: '6px', overflow: 'hidden' }}>
                 <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'white', padding: '3px 8px' }}>
                   {residencyYearShortName(g.year)}
                 </span>
                 <button 
                   onClick={(e) => { e.stopPropagation(); setDeleteTarget(g.year); }}
                   style={{ background: 'rgba(0,0,0,0.1)', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.2)', padding: '3px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                 >
                   <Trash2 size={10} color="white" />
                 </button>
               </div>
             ))}
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.02)' }}>
              <th style={{ width: '50px', padding: '12px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Date</th>
              <th style={{ width: '80px', padding: '12px', textAlign: 'left', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Day</th>
              {yearGroups.map(g => (
                <th key={g.year} style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: residencyYearBadgeColor(g.year), fontWeight: '700' }}>
                  {residencyYearShortName(g.year)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map(dayNum => {
              const dt = new Date(selectedYear, selectedMonth - 1, dayNum);
              const dow = dt.getDay();
              const isWeekend = dow === 0 || dow === 6;
              const holiday = holidays.find(h => {
                const hd = new Date(h.date);
                return hd.getDate() === dayNum && hd.getMonth() === selectedMonth - 1 && hd.getFullYear() === selectedYear;
              });
              const isHoliday = !!holiday;
              const isSpecialDay = isWeekend || isHoliday;
              
              return (
                <tr key={dayNum} style={{ borderBottom: '1px solid var(--border)', background: isSpecialDay ? 'rgba(231, 76, 60, 0.04)' : 'transparent' }}>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                     <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: isSpecialDay ? '#FFD6D6' : 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontSize: '13px', fontWeight: '800', color: isSpecialDay ? '#E74C3C' : 'var(--text-main)' }}>
                       {dayNum}
                     </div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                     <div style={{ display: 'flex', flexDirection: 'column' }}>
                       <span style={{ fontSize: '13px', fontWeight: isSpecialDay ? '800' : '600', color: isSpecialDay ? '#E74C3C' : 'var(--text-main)' }}>
                         {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow]}
                       </span>
                       {isHoliday && <span style={{ fontSize: '9px', color: '#E74C3C', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{holiday.name}</span>}
                     </div>
                  </td>
                  {yearGroups.map(g => {
                    const sched = monthSchedules.find(s => s.id === g.scheduleId);
                    const assign = sched?.assignments.find(a => a.day === dayNum);
                    const doc = doctors.find(d => d.id === (assign?.doctorId || ''));
                    
                    return (
                      <td 
                        key={g.year} 
                        onClick={() => sched && setEditTarget({ schedule: sched, day: dayNum })}
                        style={{ padding: '10px 12px', cursor: 'pointer' }}
                      >
                         {doc ? (
                           <div className="hover-lift" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: `${residencyYearBadgeColor(doc.residencyYear)}12`, padding: '6px 10px', borderRadius: '8px', transition: 'all 0.2s' }}>
                             <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: residencyYearBadgeColor(doc.residencyYear), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                               {getDoctorInitial(doc.name)}
                             </div>
                             <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                               {doc.name.replace(/^(นพ\.|พญ\.)/, '')}
                             </span>
                             {assign?.isManualOverride && <AlertCircle size={10} color={residencyYearBadgeColor(doc.residencyYear)} style={{ opacity: 0.6 }} />}
                           </div>
                         ) : (
                           <div style={{ fontSize: '11px', color: 'rgba(231, 76, 60, 0.4)', fontWeight: 'bold', fontStyle: 'italic', paddingLeft: '8px' }}>— empty —</div>
                         )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderEditModal = () => {
    if (!editTarget) return null;
    const { schedule, day } = editTarget;
    const dt = new Date(schedule.year, schedule.month - 1, day);
    const dow = dt.getDay();
    const currentAssignment = schedule.assignments.find(a => a.day === day);
    const currentDoc = doctors.find(d => d.id === currentAssignment?.doctorId);

    function blockReason(doc: Doctor): string | null {
       if (doc.offDays.includes(dow)) return "Regular day off";
       if (doc.blackoutPeriods.some(b => day >= b.startDay && day <= b.endDay)) return "Blackout period";
       const prev = schedule.assignments.find(a => a.day === day - 1);
       const next = schedule.assignments.find(a => a.day === day + 1);
       if (prev?.doctorId === doc.id || next?.doctorId === doc.id) return "Consecutive shift";
       return null;
    }

    const eligibleDoctors = doctors.filter(d => schedule.selectedYears.includes(d.residencyYear));

    return createPortal(
      <div 
        onClick={() => { if(pendingForceId) setPendingForceId(null); else setEditTarget(null); }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', zIndex: 9999, animation: 'fadeIn 0.2s', padding: '40px 16px', overflowY: 'auto' }}
      >
         <div 
           onClick={e => e.stopPropagation()}
           style={{ background: 'var(--bg-card)', width: '100%', maxWidth: '520px', borderRadius: '24px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', margin: 'auto' }}
         >
            <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Swap Shift</h2>
              <button onClick={() => setEditTarget(null)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer', width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} color="var(--text-muted)" strokeWidth={2.5} /></button>
            </div>
            
            <div style={{ padding: '16px 20px', background: 'rgba(0,0,0,0.02)', display: 'flex', gap: '14px', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
               <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: 'rgba(46, 91, 255, 0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#2E5BFF', lineHeight: 1.1 }}>{day}</span>
                  <span style={{ fontSize: '11px', color: '#2E5BFF', fontWeight: '600' }}>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow]}</span>
               </div>
               <div>
                 <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '5px' }}>
                    {day} {engMonths[schedule.month - 1]} {schedule.year}
                    {holidays.find(h => {
                       const hd = new Date(h.date);
                       return hd.getDate() === day && hd.getMonth() === schedule.month -1 && hd.getFullYear() === schedule.year;
                    }) && (
                       <span style={{ marginLeft: '8px', color: '#E74C3C', fontWeight: 'bold' }}>
                         • {holidays.find(h => {
                            const hd = new Date(h.date);
                            return hd.getDate() === day && hd.getMonth() === schedule.month -1 && hd.getFullYear() === schedule.year;
                         })?.name}
                       </span>
                    )}
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {currentDoc ? (
                      <span style={{ fontSize: '14px', fontWeight: '600', color: residencyYearBadgeColor(currentDoc.residencyYear), background: `${residencyYearBadgeColor(currentDoc.residencyYear)}1A`, padding: '4px 10px', borderRadius: '8px' }}>{currentDoc.name}</span>
                    ) : <span style={{ fontSize: '14px', color: '#E74C3C', fontWeight: '600' }}>No Doctor</span>}
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>swap with...</span>
                 </div>
               </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, paddingBottom: '20px' }}>
              <div onClick={() => { updateAssignment(schedule.id, day, null); setEditTarget(null); }} style={{ display: 'flex', padding: '14px 20px', alignItems: 'center', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.2s' }}>
                 <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#FFD6D6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '14px' }}>
                   <UserX size={18} color="#E74C3C" />
                 </div>
                 <span style={{ color: '#E74C3C', fontSize: '15px', flex: 1, fontWeight: '500' }}>Leave Unassigned</span>
                 {currentDoc === undefined && <CheckCircle2 color="#2E5BFF" size={22} />}
              </div>

              {eligibleDoctors.map(doc => {
                 const reason = blockReason(doc);
                 const isBlocked = reason !== null;
                 const isCurrent = currentDoc?.id === doc.id;
                 const isPending = pendingForceId === doc.id;

                 const handleDocClick = () => {
                   if (!isBlocked) {
                     updateAssignment(schedule.id, day, doc.id); 
                     setEditTarget(null);
                     setPendingForceId(null);
                     return;
                   }
                   
                   if (isPending) {
                     // Second click on blocked: show custom modal
                     setForceConfirmTarget({ doc, reason: reason || "Unknown Reason" });
                   } else {
                     // First click on blocked: mark as pending
                     setPendingForceId(doc.id);
                   }
                 };

                 return (
                   <div key={doc.id} 
                     onClick={handleDocClick}
                     style={{ 
                       display: 'flex', padding: '12px 16px', alignItems: 'center', borderBottom: '1px solid var(--border)', 
                       cursor: 'pointer', 
                       background: isCurrent ? 'rgba(46, 91, 255, 0.05)' : (isPending ? 'rgba(231, 76, 60, 0.05)' : 'transparent'), 
                       opacity: isBlocked && !isPending ? 0.5 : 1, 
                       userSelect: 'none',
                       transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                       transform: isPending ? 'translateX(4px)' : 'none',
                       borderLeft: isPending ? '4px solid #E74C3C' : '0px solid transparent'
                     }}
                   >
                     <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: isBlocked ? (isPending ? '#E74C3C' : 'rgba(0,0,0,0.1)') : 'rgba(39, 174, 96, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px', transition: 'all 0.2s' }}>
                        {isBlocked ? (isPending ? <AlertCircle size={15} color="#fff" /> : <X size={15} color="var(--text-muted)" />) : <Check size={15} color="#27AE60" strokeWidth={3} />}
                     </div>
                     <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: residencyYearBadgeColor(doc.residencyYear), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold', marginRight: '12px', boxShadow: isPending ? `0 4px 12px ${residencyYearBadgeColor(doc.residencyYear)}4D` : 'none' }}>
                        {getDoctorInitial(doc.name)}
                     </div>
                     <div style={{ flex: 1 }}>
                       <div style={{ fontSize: '14px', fontWeight: 'bold', color: isPending ? '#E74C3C' : (isCurrent ? 'var(--primary)' : 'var(--text-main)') }}>{doc.name}</div>
                       {isBlocked && (
                         <div style={{ fontSize: '11px', color: '#E74C3C', fontWeight: isPending ? '700' : '400' }}>
                           {isPending ? "Tap again to Force Override" : reason}
                         </div>
                       )}
                     </div>
                     {isCurrent && <CheckCircle2 color="#2E5BFF" size={20} />}
                     {isPending && (
                       <div 
                         onClick={(e) => { e.stopPropagation(); setPendingForceId(null); }}
                         style={{ padding: '8px', cursor: 'pointer', display: 'flex', color: '#E74C3C' }}
                       >
                         <X size={18} strokeWidth={3} />
                       </div>
                     )}
                   </div>
                 )
              })}
            </div>
         </div>
      </div>,
      document.body
    );
  };

  const renderLineModal = () => {
    if (!showLineModal) return null;
    return createPortal(
      <div 
        onClick={() => setShowLineModal(false)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', zIndex: 9999, animation: 'fadeIn 0.2s', padding: '40px 16px', overflowY: 'auto' }}
      >
         <div 
           onClick={e => e.stopPropagation()}
           style={{ background: 'var(--bg-card)', width: '100%', maxWidth: '520px', borderRadius: '24px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', margin: 'auto' }}
         >
            <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>LINE Export</h2>
              <button onClick={() => setShowLineModal(false)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer', width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} color="var(--text-muted)" strokeWidth={2.5} /></button>
            </div>
            
            <div style={{ padding: '16px 20px', background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border)' }}>
               <p style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filter Residency Years</p>
               <div style={{ display: 'flex', gap: '8px' }}>
                 {[ResidencyYear.year1, ResidencyYear.year2, ResidencyYear.year3].map(ry => {
                   const isSel = lineFilterYears.has(ry);
                   const c = residencyYearBadgeColor(ry);
                   return (
                     <button 
                       key={ry} 
                       onClick={() => {
                         const next = new Set(lineFilterYears);
                         if (next.has(ry)) next.delete(ry);
                         else next.add(ry);
                         setLineFilterYears(next);
                       }} 
                       style={{ padding: '6px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', background: isSel ? c : 'transparent', color: isSel ? 'white' : 'var(--text-muted)', border: `1.5px solid ${isSel ? c : 'var(--border)'}`, cursor: 'pointer', transition: 'all 0.2s', fontSize: '12px', fontWeight: 'bold' }}
                     >
                       {isSel ? <Check size={12} strokeWidth={3} /> : <div style={{ width: 12 }} />}
                       {residencyYearShortName(ry)}
                     </button>
                   )
                 })}
               </div>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
               <pre style={{ background: 'rgba(0,0,0,0.03)', padding: '16px', borderRadius: '12px', fontSize: '13px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: 'var(--text-main)', border: '1px solid var(--border)', WebkitUserSelect: 'all', userSelect: 'all' }}>
                 {generateLineMessage(currentSchedules, lineFilterYears)}
               </pre>
            </div>

            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', borderRadius: '0 0 20px 20px' }}>
               <button onClick={handleCopyLine} style={{ width: '100%', background: copied ? '#27AE60' : '#2E5BFF', color: 'white', border: 'none', borderRadius: '12px', padding: '14px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 0.2s' }}>
                 {copied ? <Check size={18} /> : <Copy size={18} />}
                 {copied ? "Copied to clipboard!" : "Copy LINE String"}
               </button>
            </div>
         </div>
      </div>,
      document.body
    );
  };

  const renderForceConfirmModal = () => {
    if (!forceConfirmTarget || !editTarget) return null;
    const { doc, reason } = forceConfirmTarget;
    const { schedule, day } = editTarget;

    const handleConfirm = () => {
      updateAssignment(schedule.id, day, doc.id);
      setForceConfirmTarget(null);
      setEditTarget(null);
      setPendingForceId(null);
    };

    return createPortal(
      <div 
        onClick={() => setForceConfirmTarget(null)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', zIndex: 10000, animation: 'fadeIn 0.2s', padding: '40px 16px', overflowY: 'auto' }}
      >
        <div 
          onClick={e => e.stopPropagation()}
          style={{ background: 'var(--bg-card)', width: '100%', maxWidth: '400px', borderRadius: '28px', padding: '32px 24px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', textAlign: 'center', margin: 'auto' }}
        >
          <div style={{ width: '64px', height: '64px', background: 'rgba(231, 76, 60, 0.1)', color: '#E74C3C', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
             <AlertCircle size={32} strokeWidth={2.5} />
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '12px', letterSpacing: '-0.02em' }}>Force Assign?</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '24px' }}>
            <strong>{doc.name}</strong> is unavailable because: <span style={{ color: '#E74C3C', fontWeight: '600' }}>{reason}</span>. Are you sure you want to override this?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
             <button onClick={handleConfirm} style={{ background: '#E74C3C', color: 'white', border: 'none', borderRadius: '14px', padding: '14px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>
               Yes, Override & Assign
             </button>
             <button onClick={() => setForceConfirmTarget(null)} style={{ background: 'var(--bg-main)', color: 'var(--text-main)', border: 'none', borderRadius: '14px', padding: '14px', fontWeight: '600', fontSize: '15px', cursor: 'pointer' }}>
               Cancel
             </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const renderConfirmGenerateModal = () => {
    if (!showGenerateConfirm) return null;
    return createPortal(
      <div 
        onClick={() => setShowGenerateConfirm(false)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', zIndex: 10000, animation: 'fadeIn 0.2s', padding: '40px 16px', overflowY: 'auto' }}
      >
        <div 
          onClick={e => e.stopPropagation()}
          style={{ background: 'var(--bg-card)', width: '100%', maxWidth: '400px', borderRadius: '28px', padding: '32px 24px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', textAlign: 'center', margin: 'auto' }}
        >
          <div style={{ width: '64px', height: '64px', background: 'rgba(46, 91, 255, 0.1)', color: '#2E5BFF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
             <Shuffle size={32} strokeWidth={2.5} />
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '12px', letterSpacing: '-0.02em' }}>Replace Schedule?</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '24px' }}>
            A schedule for <strong>{engMonths[selectedMonth-1]} {selectedYear}</strong> already exists. Generating a new set will delete the existing one.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
             <button onClick={executeGenerate} style={{ background: '#2E5BFF', color: 'white', border: 'none', borderRadius: '14px', padding: '14px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>
               Yes, Regenerate
             </button>
             <button onClick={() => setShowGenerateConfirm(false)} style={{ background: 'var(--bg-main)', color: 'var(--text-main)', border: 'none', borderRadius: '14px', padding: '14px', fontWeight: '600', fontSize: '15px', cursor: 'pointer' }}>
               Keep Existing
             </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const renderDeleteConfirmModal = () => {
    if (!deleteTarget) return null;
    const isAll = deleteTarget === 'all';
    const yearLabel = !isAll ? residencyYearShortName(deleteTarget) : "";

    const handleConfirm = () => {
      if (isAll) {
        deleteSchedule(selectedMonth, selectedYear);
      } else {
        deleteScheduleByYear(selectedMonth, selectedYear, deleteTarget);
      }
      setDeleteTarget(null);
    };

    return createPortal(
      <div 
        onClick={() => setDeleteTarget(null)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', zIndex: 10000, animation: 'fadeIn 0.2s', padding: '40px 16px', overflowY: 'auto' }}
      >
        <div 
          onClick={e => e.stopPropagation()}
          style={{ background: 'var(--bg-card)', width: '100%', maxWidth: '400px', borderRadius: '28px', padding: '32px 24px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', textAlign: 'center', margin: 'auto' }}
        >
          <div style={{ width: '64px', height: '64px', background: 'rgba(231, 76, 60, 0.1)', color: '#E74C3C', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
             <Trash2 size={32} strokeWidth={2.5} />
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '12px', letterSpacing: '-0.02em' }}>Delete {isAll ? 'All Schedules' : `${yearLabel} Schedule`}?</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '24px' }}>
            {isAll 
              ? `Are you sure you want to delete all schedules for ${engMonths[selectedMonth-1]} ${selectedYear}? This action cannot be undone.`
              : `Are you sure you want to delete the ${yearLabel} schedule for ${engMonths[selectedMonth-1]} ${selectedYear}?`
            }
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
             <button onClick={handleConfirm} style={{ background: '#E74C3C', color: 'white', border: 'none', borderRadius: '14px', padding: '14px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>
               Yes, Delete
             </button>
             <button onClick={() => setDeleteTarget(null)} style={{ background: 'var(--bg-main)', color: 'var(--text-main)', border: 'none', borderRadius: '14px', padding: '14px', fontWeight: '600', fontSize: '15px', cursor: 'pointer' }}>
               Cancel
             </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px 60px' }}>
      {renderEditModal()}
      {renderLineModal()}
      {renderForceConfirmModal()}
      {renderConfirmGenerateModal()}
      {renderDeleteConfirmModal()}
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0 }}>Shift Table</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '4px 0 0' }}>Schedules and generation</p>
        </div>
        {hasAnySchedule && (
          <button onClick={() => setShowStats(!showStats)} style={{ background: 'transparent', border: 'none', color: '#2E5BFF', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <BarChart3 size={24} />
          </button>
        )}
      </div>

      {/* Month/Year Pickers */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={{ padding: '9px 14px', borderRadius: '10px', border: '1.5px solid #2E5BFF', background: 'transparent', color: '#2E5BFF', fontSize: '15px', fontWeight: '500', outline: 'none' }}>
          {engMonths.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select 
          value={selectedYear} 
          onChange={e => setSelectedYear(Number(e.target.value))} 
          style={{ padding: '9px 14px', borderRadius: '10px', border: '1.5px solid var(--border)', background: 'transparent', fontSize: '15px', fontWeight: '500', outline: 'none', color: 'var(--text-main)' }}
        >
          {Array.from({ length: 20 }, (_, i) => new Date().getFullYear() + i - 5).map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Residency Filter */}
      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>Select Residency Years</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[ResidencyYear.year1, ResidencyYear.year2, ResidencyYear.year3].map(ry => {
            const isSel = selectedYears.has(ry);
            const count = doctors.filter(d => d.residencyYear === ry).length;
            const c = residencyYearBadgeColor(ry);
            return (
              <button key={ry} onClick={() => toggleYear(ry)} style={{ padding: '8px 14px', borderRadius: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: isSel ? c : `${c}1A`, color: isSel ? 'white' : c, border: `1px solid ${isSel ? c : `${c}4D`}`, cursor: 'pointer', transition: 'all 0.2s', minWidth: '70px' }}>
                <span style={{ fontSize: '13px', fontWeight: isSel ? 'bold' : '500' }}>{residencyYearShortName(ry)}</span>
                <span style={{ fontSize: '10px', opacity: 0.8 }}>{count} People</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button onClick={handleGenerateClick} disabled={isGenerating || selectedYears.size === 0} style={{ background: '#2E5BFF', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 16px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', opacity: isGenerating ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shuffle size={16} />
          {isGenerating ? 'Generating...' : 'New Set'}
        </button>

        {hasAnySchedule && (
          <>
            <button onClick={() => setShowLineModal(true)} style={{ background: 'transparent', color: 'var(--text-main)', border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: '10px', padding: '10px 16px', fontWeight: '500', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={16} color="#25D366" /> Line String
            </button>
            <button onClick={handleExportCSV} style={{ background: 'transparent', color: 'var(--text-main)', border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: '10px', padding: '10px 16px', fontWeight: '500', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Download size={16} color="#3498DB" /> Export CSV
            </button>
            <button onClick={() => setDeleteTarget('all')} style={{ background: '#E74C3C14', color: '#E74C3C', border: '1.5px solid #E74C3C4D', borderRadius: '10px', padding: '10px 16px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trash2 size={16} /> Delete All
            </button>
          </>
        )}
      </div>

      {showStats && hasAnySchedule && currentSchedules.map(renderStats)}

      {/* Unified Table */}
      {!hasAnySchedule ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', opacity: 0.5 }}>
            <CalendarX size={48} />
          </div>
          <h3 style={{ marginBottom: '8px' }}>No Schedule</h3>
          <p>Tap 'New Set' to create a schedule for the selected month</p>
        </div>
      ) : (
        renderUnifiedTable(currentSchedules)
      )}
    </div>
  );
}
