import { useState } from 'react';
import { useDataStore } from '../store/DataStore';
import { v4 as uuidv4 } from 'uuid';
import type { PublicHoliday } from '../models';
import { Calendar, Trash2, CalendarOff } from 'lucide-react';

export default function PublicHolidayView() {
  const { holidays, addHoliday, deleteHoliday, setHolidays } = useDataStore();
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [holidayName, setHolidayName] = useState('');

  const loadDefaults = () => {
    // Exact mapping from SwiftUI loadDefaults
    const defaults: [number, number, string][] = [
      [1, 1, "วันขึ้นปีใหม่"], [2, 5, "วันตรุษจีน"], [2, 12, "วันมาฆบูชา"],
      [4, 6, "วันจักรี"], [4, 13, "วันสงกรานต์"], [4, 14, "วันสงกรานต์"], [4, 15, "วันสงกรานต์"],
      [5, 1, "วันแรงงาน"], [5, 4, "วันฉัตรมงคล"], [6, 3, "วันเฉลิมพระชนมพรรษา"],
      [7, 28, "วันเฉลิมพระชนมพรรษา ร.10"], [8, 12, "วันแม่แห่งชาติ"],
      [10, 13, "วันสวรรคต ร.9"], [10, 23, "วันปิยมหาราช"],
      [12, 5, "วันพ่อแห่งชาติ"], [12, 10, "วันรัฐธรรมนูญ"], [12, 31, "วันสิ้นปี"]
    ];

    setHolidays(prev => {
      // 1. Remove existing 2026 holidays first to avoid duplicates
      const filtered = prev.filter(h => new Date(h.date).getFullYear() !== 2026);
      
      // 2. Generate new default objects
      const newItems: PublicHoliday[] = defaults.map(([m, d, name]) => ({
        id: uuidv4(),
        date: new Date(2026, m - 1, d),
        name
      }));

      // 3. Return combined list in a single state update
      return [...filtered, ...newItems];
    });
  };

  const handleAddHoliday = () => {
    if (!holidayName) return;
    const [y, m, d] = selectedDate.split('-');
    addHoliday({
      id: uuidv4(),
      date: new Date(Number(y), Number(m) - 1, Number(d)),
      name: holidayName
    });
    setHolidayName('');
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Group holidays by month
  const groupedHolidays = holidays.reduce((acc, h) => {
    const d = new Date(h.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!acc[key]) acc[key] = { month: d.getMonth(), year: d.getFullYear(), items: [] };
    acc[key].items.push(h);
    return acc;
  }, {} as Record<string, { month: number, year: number, items: PublicHoliday[] }>);

  const sortedGroups = Object.values(groupedHolidays).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px 60px' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 4px' }}>Public Holidays</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>Add special holidays or sync default</p>
      </div>

      {/* Summary Card */}
      <div style={{ 
        display: 'flex', alignItems: 'center', background: 'rgba(231, 76, 60, 0.1)', 
        padding: '16px', borderRadius: '14px', marginBottom: '24px' 
      }}>
        <div style={{ flexShrink: 0, marginRight: '16px', display: 'flex' }}>
           <Calendar color="#E74C3C" size={28} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-main)' }}>{holidays.length} holidays</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>this year</div>
        </div>
        <button onClick={() => {
          if (window.confirm("This will replace all 2026 holidays. Are you sure?")) loadDefaults();
        }} style={{
          background: '#2E5BFF', color: 'white', padding: '7px 12px', borderRadius: '8px',
          fontWeight: '500', fontSize: '13px', border: 'none', cursor: 'pointer'
        }}>
          Load Defaults
        </button>
      </div>

      {/* Add Special Holiday */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Add special holiday</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Date</label>
          <input 
            type="date" 
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{ padding: '12px', borderRadius: '12px', background: 'var(--bg-card)', border: 'none', fontSize: '15px', color: 'var(--text-main)', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Holiday Name</label>
          <input 
            placeholder="E.g. Substitute Holiday" 
            value={holidayName} 
            onChange={e => setHolidayName(e.target.value)}
            style={{ padding: '12px', borderRadius: '10px', background: 'var(--bg-card)', border: 'none', fontSize: '15px', color: 'var(--text-main)', outline: 'none' }}
          />
        </div>

        <button 
          onClick={handleAddHoliday} 
          disabled={!holidayName}
          style={{
            background: holidayName ? '#2E5BFF' : 'gray', color: 'white', 
            width: '100%', padding: '12px', borderRadius: '10px',
            fontSize: '15px', fontWeight: '600', border: 'none', cursor: holidayName ? 'pointer' : 'default'
          }}
        >
          Add Holiday
        </button>
      </div>

      {/* Holiday List */}
      <div>
        {sortedGroups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', opacity: 0.5, marginBottom: '12px' }}>
               <CalendarOff size={40} color="var(--text-muted)" strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: '15px', color: 'var(--text-muted)' }}>No Holidays loaded</div>
          </div>
        ) : (
          sortedGroups.map(group => {
            // Sort items within month by date
            group.items.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            return (
              <div key={`${group.year}-${group.month}`} style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#2E5BFF' }}>
                    {monthNames[group.month]} {group.year}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {group.items.length} Days
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {group.items.map(holiday => {
                    const d = new Date(holiday.date);
                    return (
                      <div key={holiday.id} style={{
                        display: 'flex', alignItems: 'center', background: 'var(--bg-card)', 
                        padding: '10px 16px', borderRadius: '12px', gap: '12px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                      }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(231, 76, 60, 0.12)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#E74C3C', fontWeight: 'bold', fontSize: '14px', flexShrink: 0
                        }}>
                          {d.getDate()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-main)' }}>{holiday.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {d.getDate()} {monthNames[d.getMonth()]} {d.getFullYear()}
                          </div>
                        </div>
                        <button onClick={() => deleteHoliday(holiday.id)} style={{
                          background: 'rgba(231, 76, 60, 0.08)', color: '#E74C3C', border: 'none', 
                          width: '30px', height: '30px', borderRadius: '6px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <Trash2 size={13} strokeWidth={2.5} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  );
}
