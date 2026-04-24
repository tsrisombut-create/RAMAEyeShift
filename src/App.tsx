import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { BarChart3, LayoutGrid, CalendarDays, Users, CalendarOff, Sun, Moon } from 'lucide-react';
import './App.css';

import Dashboard from './views/Dashboard';
import ShiftSchedule from './views/ShiftSchedule';
import DoctorManagement from './views/DoctorManagement';
import PublicHoliday from './views/PublicHoliday';
import WorkloadStats from './views/WorkloadStats';

const AppLayout = () => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
    localStorage.setItem('theme', theme);
  }, [theme]);

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
    { path: '/schedule', label: 'Shift Table', icon: CalendarDays },
    { path: '/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/doctors', label: 'Doctors', icon: Users },
    { path: '/holidays', label: 'Public Holidays', icon: CalendarOff },
  ];

  return (
    <div className="layout-container">
      {/* Mobile-only top header */}
      <header className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="RamaLogo.png" alt="Rama Logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
          <span className="sidebar-title" style={{ fontSize: '0.9rem' }}>EyeRAMAShift</span>
        </div>
        <button
          className="theme-toggle-btn"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src="RamaLogo.png" alt="Rama Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
          <span className="sidebar-title">EyeRAMAShift</span>
        </div>

        <nav className="nav-links">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <item.icon className="nav-icon" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', padding: '16px', display: 'flex', justifyContent: 'center' }}>
           <button
             onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
             style={{
               display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
               background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '12px',
               color: 'var(--text-main)', cursor: 'pointer', fontWeight: '600', fontSize: '13px'
             }}
           >
             {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
             {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content glass">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/schedule" element={<ShiftSchedule />} />
          <Route path="/analytics" element={<WorkloadStats />} />
          <Route path="/doctors" element={<DoctorManagement />} />
          <Route path="/holidays" element={<PublicHoliday />} />
        </Routes>
      </main>

      {/* iOS / Mobile Nav */}
      <nav className="mobile-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
          >
            <item.icon className="nav-icon" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

import { DataStoreProvider } from './store/DataStore';

function App() {
  return (
    <DataStoreProvider>
      <HashRouter>
        <AppLayout />
      </HashRouter>
    </DataStoreProvider>
  );
}

export default App;
