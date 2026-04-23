import { useDataStore } from '../store/DataStore';
import { useNavigate } from 'react-router-dom';
import { ResidencyYear, residencyYearBadgeColor, residencyYearShortName, getDoctorInitial } from '../models';
import { Users, CalendarCheck, AlertTriangle, CalendarX, Shuffle, UserPlus, MessageSquare, CalendarMinus, ChevronRight } from 'lucide-react';

export default function Dashboard() {
  const { doctors, schedules } = useDataStore();
  const navigate = useNavigate();

  const latestSchedule = [...schedules].sort((a,b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  })[0] || null;

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const isCurrentMonth = latestSchedule?.month === currentMonth && latestSchedule?.year === currentYear;
  const todayAssignment = isCurrentMonth ? latestSchedule?.assignments.find(a => a.day === currentDay) : null;
  const todayDoctor = todayAssignment ? doctors.find(d => d.id === todayAssignment.doctorId) : null;


  const vacantDays = latestSchedule ? latestSchedule.assignments.filter(a => a.doctorId === null).length : 0;

  const renderDoctorGroup = (year: ResidencyYear) => {
    const docs = doctors.filter(d => d.residencyYear === year);
    if (docs.length === 0) return null;
    
    return (
      <div key={year} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ 
            background: residencyYearBadgeColor(year), color: 'white', padding: '3px 8px', 
            borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' 
          }}>
            {residencyYearShortName(year)}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{docs.length} People</span>
        </div>
        {docs.map(doc => {
          const totalShifts = schedules.reduce((sum, s) => sum + s.assignments.filter(a => a.doctorId === doc.id).length, 0);
          return (
            <div key={doc.id} style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', 
              borderRadius: '10px', width: '100%', background: 'var(--bg-card)',
              boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
            }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', background: residencyYearBadgeColor(year),
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 'bold', flexShrink: 0
              }}>
                {getDoctorInitial(doc.name)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: '0' }}>
                 <span style={{ fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</span>
                 <span style={{ fontSize: '11px', color: totalShifts > 0 ? residencyYearBadgeColor(year) : 'var(--text-muted)' }}>
                   {totalShifts} Shifts
                 </span>
              </div>
            </div>
          )
        })}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px 16px 60px' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '20px', padding: '0 8px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 4px' }}>Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>Overview of the daily ophthalmology surgeries</p>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', padding: '0 8px' }}>
        <StatTile 
          icon={<Users size={24} color="#2E5BFF" strokeWidth={2.5} />} 
          color="#2E5BFF" value={doctors.length} label="Doctors" 
        />
        <StatTile 
           icon={<CalendarCheck size={24} color="#00B27A" strokeWidth={2.5} />} 
           color="#00B27A" value={schedules.length} label="Schedules" 
           onClick={() => navigate('/schedule')}
        />
        <StatTile 
          icon={<AlertTriangle size={24} color="#E74C3C" strokeWidth={2.5} />} 
          color="#E74C3C" value={vacantDays} label="Vacant" 
        />
      </div>

      {/* Latest Schedule Card */}
      {latestSchedule ? (
        <div className="card-premium" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '20px', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
          {/* Subtle Decorative Background */}
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '120px', height: '120px', background: 'var(--primary-glow)', borderRadius: '50%', filter: 'blur(40px)', zIndex: 0, opacity: 0.6 }}></div>
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
               <div>
                  <div style={{ color: 'var(--primary)', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Latest Schedule</div>
                  <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0, letterSpacing: '-0.02em' }}>
                     {monthNames[latestSchedule.month - 1]} {latestSchedule.year}
                  </h2>
               </div>
               <button onClick={() => navigate('/schedule')} style={{ 
                 background: 'var(--primary-glow)', color: 'var(--primary)', border: 'none', 
                 padding: '10px 20px', borderRadius: '12px', fontWeight: '700', fontSize: '13px', 
                 cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px'
               }}>
                 View Details <ChevronRight size={14} />
               </button>
            </div>

            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              {/* Progress Section */}
              <div style={{ flex: '1', minWidth: '200px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', fontWeight: '600' }}>
                  <span style={{ color: 'var(--text-muted)' }}>ASSIGNMENT PROGRESS</span>
                  <span>{Math.round((1 - vacantDays / latestSchedule.assignments.length) * 100)}%</span>
                </div>
                <div style={{ width: '100%', height: '10px', background: 'var(--bg-main)', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${(1 - vacantDays / latestSchedule.assignments.length) * 100}%`, 
                    height: '100%', background: 'linear-gradient(90deg, var(--primary), #6366f1)', 
                    borderRadius: '5px', transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)' 
                  }}></div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                   <CalendarCheck size={14} />
                   <span>{latestSchedule.assignments.length - vacantDays} of {latestSchedule.assignments.length} shifts filled</span>
                </div>
              </div>

              {/* Status/Today Section */}
              <div style={{ flex: '1', minWidth: '200px' }}>
                {todayDoctor ? (
                  <div style={{ background: 'var(--bg-main)', padding: '12px 16px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--border)' }}>
                    <div style={{ 
                      width: '40px', height: '40px', borderRadius: '50%', background: residencyYearBadgeColor(todayDoctor.residencyYear), 
                      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      fontSize: '14px', fontWeight: '800', boxShadow: `0 4px 10px ${residencyYearBadgeColor(todayDoctor.residencyYear)}4D`
                    }}>
                      {getDoctorInitial(todayDoctor.name)}
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.02em' }}>ON CALL TODAY</div>
                      <div style={{ fontSize: '15px', fontWeight: '700' }}>{todayDoctor.name}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: vacantDays > 0 ? 'rgba(231, 76, 60, 0.08)' : 'rgba(0, 178, 122, 0.08)', padding: '12px 16px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ 
                      width: '40px', height: '40px', borderRadius: '50%', 
                      background: vacantDays > 0 ? 'rgba(231, 76, 60, 0.15)' : 'rgba(0, 178, 122, 0.15)', 
                      color: vacantDays > 0 ? '#E74C3C' : '#00B27A', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {vacantDays > 0 ? <AlertTriangle size={20} /> : <CalendarCheck size={20} />}
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>SCHEDULE STATUS</div>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: vacantDays > 0 ? '#E74C3C' : '#00B27A' }}>
                        {vacantDays > 0 ? `${vacantDays} Days Vacant` : 'Fully Assigned'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (

        <div style={{ background: 'var(--bg-card)', padding: '30px', borderRadius: '16px', textAlign: 'center', marginBottom: '24px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
           <div style={{ opacity: 0.35, marginBottom: '14px', display: 'flex', justifyContent: 'center' }}>
               <CalendarX size={44} strokeWidth={1} />
           </div>
           <h3 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: '600' }}>No Schedule</h3>
           <button onClick={() => navigate('/schedule')} style={{ background: '#2E5BFF', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
              Create Schedule
           </button>
        </div>
      )}

      {/* Doctor Summary */}
      <div style={{ marginBottom: '24px' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', padding: '0 8px' }}>
            <div>
               <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 2px' }}>Doctors in system</h3>
               <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>All time shifts</p>
            </div>
            <button onClick={() => navigate('/doctors')} style={{ background:'transparent', border:'none', color:'#2E5BFF', fontSize: '13px', cursor:'pointer' }}>
               Manage
            </button>
         </div>
         <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '0 8px' }}>
             {[ResidencyYear.year3, ResidencyYear.year2, ResidencyYear.year1].map(renderDoctorGroup)}
         </div>
      </div>

      {/* Quick Actions */}
      <div>
         <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', padding: '0 8px' }}>Quick Actions</h3>
         <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', padding: '0 8px' }}>
            <QuickActionCard 
              icon={<Shuffle size={18} strokeWidth={2.5} />} 
              color="#2E5BFF" title="Create Table" subtitle="Auto create" onClick={() => navigate('/schedule')} 
            />
            <QuickActionCard 
              icon={<UserPlus size={18} strokeWidth={2.5} />} 
              color="#00B27A" title="Add Doctor" subtitle="Manage info" onClick={() => navigate('/doctors')} 
            />
         </div>
         <div style={{ display: 'flex', gap: '12px', padding: '0 8px' }}>
            <QuickActionCard 
              icon={<MessageSquare size={18} strokeWidth={2.5} />} 
              color="#25D366" title="Send LINE" subtitle="Copy message" onClick={() => navigate('/schedule')} 
            />
            <QuickActionCard 
              icon={<CalendarMinus size={18} strokeWidth={2.5} />} 
              color="#E67E22" title="Holidays" subtitle="Manage holidays" onClick={() => navigate('/holidays')} 
            />
         </div>
      </div>
    </div>
  );
}

function StatTile({ icon, color, value, label, onClick }: any) {
  return (
    <div onClick={onClick} className="card-premium" style={{ 
      flex: 1, padding: '24px 16px', textAlign: 'center',
      cursor: onClick ? 'pointer' : 'default'
    }}>
      <div style={{ marginBottom: '12px', color, display:'flex', justifyContent:'center' }}>{icon}</div>
      <div style={{ fontSize: '28px', fontWeight: '800', letterSpacing: '-0.02em', marginBottom: '4px' }}>{value}</div>
      <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  )
}

function QuickActionCard({ icon, color, title, subtitle, onClick }: any) {
  return (
    <div onClick={onClick} className="card-premium" style={{
      display: 'flex', flex: 1, alignItems: 'center', gap: '16px', padding: '16px',
      cursor: 'pointer'
    }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${color}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
        {icon}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
         <span style={{ fontSize: '15px', fontWeight: '700', letterSpacing: '-0.01em' }}>{title}</span>
         <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)' }}>{subtitle}</span>
      </div>
    </div>
  )
}
