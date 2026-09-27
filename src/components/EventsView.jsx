import { User, MapPin, Bell, BellRing, Check, CalendarPlus, Sparkles } from "lucide-react";
import { dateParts, countdownLabel, formatFullDate, downloadIcs } from "../utils/calendar.js";

export default function EventsView({ t, lang, rsvps, notify, onToggleRsvp, onToggleNotify, flash }) {
  const events = t.eventsList;
  const rsvpCount = Object.values(rsvps).filter(Boolean).length;

  const handleIcs = (e) => {
    const ok = downloadIcs({
      title: e.title,
      dateISO: e.date,
      venue: e.venue,
      description: `${t.appName} — ${e.guest}`,
    });
    flash(ok ? t.icsDownloaded : t.tbaDate);
  };

  return (
    <div className="section" style={{ maxWidth: 720 }}>
      <div className="section-head">
        <h2 className="section-title display">{t.upcomingPrograms}</h2>
        <span className="note">{t.sampleDates}</span>
      </div>

      <div className="event-list">
        {events.map((e) => {
          const parts = e.date ? dateParts(e.date, lang) : { day: e.day, mon: e.mon };
          const countdown = countdownLabel(e.date, t);
          return (
            <div key={e.id} className="event-row">
              <div className="event-date">
                <span className="event-day display">{parts.day}</span>
                <span className="event-mon">{parts.mon}</span>
              </div>
              <div className="event-info">
                <p className="event-title">{e.title}</p>
                <div className="event-sub">
                  <span>
                    <User size={12} aria-hidden="true" /> {e.guest}
                  </span>
                  <span>
                    <MapPin size={12} aria-hidden="true" /> {e.venue}
                  </span>
                  {countdown ? (
                    <span className="countdown-chip" title={e.date ? formatFullDate(e.date, lang) : undefined}>
                      ⏳ {countdown}
                    </span>
                  ) : (
                    !e.date && <span className="countdown-chip muted-chip">{t.tbaDate}</span>
                  )}
                </div>
              </div>
              <div className="event-actions">
                <button
                  type="button"
                  className="bell-btn"
                  onClick={() => onToggleNotify(e.id, e.title)}
                  title={notify[e.id] ? t.remindersOn : t.remindersOff}
                  aria-label={notify[e.id] ? t.remindersOn : t.remindersOff}
                  aria-pressed={!!notify[e.id]}
                >
                  {notify[e.id] ? (
                    <BellRing size={18} color="#E8B84B" aria-hidden="true" />
                  ) : (
                    <Bell size={18} color="#B7A28A" aria-hidden="true" />
                  )}
                </button>
                {e.date && (
                  <button
                    type="button"
                    className="ics-btn"
                    onClick={() => handleIcs(e)}
                    title={t.addToCalendar}
                    aria-label={`${t.addToCalendar}: ${e.title}`}
                  >
                    <CalendarPlus size={16} aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  className={`rsvp-btn ${rsvps[e.id] ? "going" : ""}`}
                  onClick={() => onToggleRsvp(e.id, e.title)}
                  aria-pressed={!!rsvps[e.id]}
                >
                  {rsvps[e.id] ? (
                    <>
                      <Check size={12} aria-hidden="true" /> {t.going}
                    </>
                  ) : (
                    t.rsvp
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="summary">
        <p>
          {t.rsvpCount} <b>{rsvpCount}</b> {rsvpCount === 1 ? t.program : t.programs}
        </p>
      </div>

      {/* Festival calendar with live countdowns */}
      <div className="section-head" style={{ marginTop: 40 }}>
        <h2 className="section-title display">{t.festivalCalendar}</h2>
        <span className="note">{t.festivalNote}</span>
      </div>
      <div className="festcal-list">
        {t.festivalList.map((f) => {
          const countdown = countdownLabel(f.date, t);
          const past = countdown === "" && f.date;
          return (
            <div key={f.id} className={`festcal-row ${past ? "past" : ""}`}>
              <div className="event-date">
                <Sparkles size={16} color="#E8B84B" aria-hidden="true" />
              </div>
              <div className="event-info">
                <p className="event-title">{f.title}</p>
                <div className="event-sub">
                  <span>📅 {formatFullDate(f.date, lang)}</span>
                </div>
                <p className="festcal-snippet">{f.snippet}</p>
              </div>
              <div className="event-actions">
                {countdown && <span className="countdown-chip">{countdown}</span>}
                <button
                  type="button"
                  className="ics-btn"
                  onClick={() => {
                    const ok = downloadIcs({ title: f.title, dateISO: f.date, description: f.snippet });
                    flash(ok ? t.icsDownloaded : t.tbaDate);
                  }}
                  title={t.addToCalendar}
                  aria-label={`${t.addToCalendar}: ${f.title}`}
                >
                  <CalendarPlus size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
