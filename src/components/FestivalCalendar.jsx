import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { downloadIcs, toKnDigits } from "../utils/calendar.js";
import { festivalsForYear } from "../utils/festivals.js";

const pad = (n) => String(n).padStart(2, "0");
const isoOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

// Weekday labels derived from a known Sunday (7 Jan 2024) so they localise.
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 7 + i));

/**
 * Full month-grid festival calendar in a warm yellow wall-calendar style.
 * Every announced festival AND every dated program appears as a chip under
 * its date; clicking a chip downloads the .ics. Months without announcements
 * are simply empty — chips stay muted until a date is published.
 */
export default function FestivalCalendar({ t, lang, events, flash }) {
  const locale = lang === "kn" ? "kn-IN" : "en-GB";

  const [view, setView] = useState(() => {
    // Always open on the month containing TODAY so the highlight is visible.
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() };
  });

  // The festivals of the year on screen, dated from the sky over Muscat — see
  // src/utils/festivals.js. Paging to another year brings that year's dates,
  // so the calendar never goes stale and nobody maintains a list.
  const festivals = useMemo(
    () => festivalsForYear(t.festivalList, view.y),
    [t, view.y]
  );

  // ISO date -> [items] for festivals + dated programs.
  const itemsByDate = useMemo(() => {
    const map = {};
    const put = (date, item) => {
      if (!date) return;
      if (!map[date]) map[date] = [];
      map[date].push(item);
    };
    festivals.forEach((f) =>
      put(f.date, { id: f.id, title: f.title, desc: f.snippet, kind: "festival" })
    );
    // The SAME list the programs above show — a date set in the dashboard has
    // to appear in both, or the calendar quietly contradicts the list.
    events
      .filter((e) => e.date)
      .forEach((e) => put(e.date, { id: e.id, title: e.title, desc: e.venue, kind: "event" }));
    return map;
  }, [festivals, events]);

  const step = (dir) => {
    setView((v) => {
      const d = new Date(v.y, v.m + dir, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  const { y, m } = view;
  const today = new Date();
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7) cells.push(null);

  const monthTitle = new Date(y, m, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
  const dayNum = (d) => (lang === "kn" ? toKnDigits(d) : String(d));

  const onChip = (item, dateIso) => {
    const ok = downloadIcs({
      title: item.title,
      dateISO: dateIso,
      description: item.desc,
    });
    flash(ok ? t.icsDownloaded : t.tbaDate);
  };

  return (
    <div className="festival-cal" role="grid" aria-label={t.festivalCalendar}>
      <div className="cal-topbar">
        <button
          type="button"
          className="cal-nav"
          onClick={() => step(-1)}
          aria-label={t.calPrev}
          title={t.calPrev}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <span className="cal-month display">{monthTitle}</span>
        <button
          type="button"
          className="cal-nav"
          onClick={() => step(1)}
          aria-label={t.calNext}
          title={t.calNext}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="cal-weekhead" role="row">
        {WEEKDAYS.map((d) => (
          <span key={d.toISOString()} role="columnheader">
            {d.toLocaleDateString(locale, { weekday: "short" })}
          </span>
        ))}
      </div>

      <div className="cal-grid">
        {cells.map((d, i) => {
          if (d === null) return <div key={`b${i}`} className="cal-cell blank" aria-hidden="true" />;
          const dateIso = isoOf(y, m, d);
          const items = itemsByDate[dateIso];
          const isToday =
            y === today.getFullYear() &&
            m === today.getMonth() &&
            d === today.getDate();
          return (
            <div
              key={dateIso}
              role="gridcell"
              aria-current={isToday ? "date" : undefined}
              className={`cal-cell${isToday ? " today" : ""}`}
            >
              <span className={`cal-num${items && items.length ? " has" : ""}`}>{dayNum(d)}</span>
              {items &&
                items.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    className={`cal-chip ${it.kind}`}
                    title={`${it.title}${it.desc ? ` — ${it.desc}` : ""}`}
                    onClick={() => onChip(it, dateIso)}
                  >
                    {it.title}
                  </button>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
