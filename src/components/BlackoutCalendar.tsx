import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./BlackoutCalendar.css";

interface BlackoutCalendarProps {
  selectedDays: number[];
  offDays: number[];
  onChange: (days: number[]) => void;
}

export function BlackoutCalendar({ selectedDays, offDays, onChange }: BlackoutCalendarProps) {
  const [displayMonth, setDisplayMonth] = useState(new Date().getMonth());
  const [displayYear, setDisplayYear] = useState(new Date().getFullYear());

  const daysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const firstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handleDayClick = (day: number) => {
    const newDays = selectedDays.includes(day)
      ? selectedDays.filter(d => d !== day)
      : [...selectedDays, day];
    onChange(newDays);
  };

  const handlePrevMonth = () => {
    if (displayMonth === 0) {
      setDisplayMonth(11);
      setDisplayYear(displayYear - 1);
    } else {
      setDisplayMonth(displayMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (displayMonth === 11) {
      setDisplayMonth(0);
      setDisplayYear(displayYear + 1);
    } else {
      setDisplayMonth(displayMonth + 1);
    }
  };

  const monthName = new Date(displayYear, displayMonth, 1).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const numDays = daysInMonth(displayMonth, displayYear);
  const firstDay = firstDayOfMonth(displayMonth, displayYear);
  const days: (number | null)[] = Array(firstDay).fill(null).concat(Array.from({ length: numDays }, (_, i) => i + 1));

  return (
    <div className="blackout-calendar">
      <div className="calendar-header">
        <button onClick={handlePrevMonth} className="nav-btn">
          <ChevronLeft size={20} />
        </button>
        <h3>{monthName}</h3>
        <button onClick={handleNextMonth} className="nav-btn">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="calendar-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div key={day} className="day-header">
            {day}
          </div>
        ))}

        {days.map((day, idx) => {
          const isOffDay = day !== null && offDays.includes(new Date(displayYear, displayMonth, day).getDay());
          const isSelected = day !== null && selectedDays.includes(day);

          return (
            <div
              key={idx}
              className={`day-cell ${!day ? "empty" : ""} ${isOffDay ? "off-day" : ""} ${isSelected ? "selected" : ""}`}
              onClick={() => day && handleDayClick(day)}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}
