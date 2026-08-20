import { useState } from "react";
import { useT, useLang, dateLocale } from "./i18n";

interface Props {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDateStr(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function DatePicker({ value, onChange }: Props) {
  const t = useT();
  const { lang } = useLang();
  const selected = parseDateStr(value);
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());

  const today = new Date();
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // 0 = Monday
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(viewYear, viewMonth, day));
  while (cells.length % 7 !== 0) cells.push(null);

  function goToPrevMonth() {
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    setViewMonth(m);
    setViewYear(y);
  }

  function goToNextMonth() {
    const m = viewMonth === 11 ? 0 : viewMonth + 1;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    setViewMonth(m);
    setViewYear(y);
  }

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(dateLocale(lang), {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="date-picker">
      <div className="date-picker-header">
        <button type="button" onClick={goToPrevMonth} aria-label={t.datePicker.prevMonth}>
          ‹
        </button>
        <span>{monthLabel}</span>
        <button type="button" onClick={goToNextMonth} aria-label={t.datePicker.nextMonth}>
          ›
        </button>
      </div>

      <div className="date-picker-grid">
        {t.datePicker.weekdays.map((w) => (
          <div key={w} className="date-picker-weekday">
            {w}
          </div>
        ))}
        {cells.map((day, i) =>
          day ? (
            <button
              key={i}
              type="button"
              className={[
                "date-picker-day",
                isSameDay(day, selected) ? "selected" : "",
                isSameDay(day, today) ? "today" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onChange(toDateStr(day))}
            >
              {day.getDate()}
            </button>
          ) : (
            <div key={i} />
          )
        )}
      </div>
    </div>
  );
}
