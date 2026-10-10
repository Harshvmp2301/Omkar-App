import { MapPin, User, CalendarPlus, ArrowRight } from "lucide-react";
import { dateParts, countdownLabel, formatFullDate, downloadIcs } from "../utils/calendar.js";
import { nextEvent } from "../utils/events.js";
import { directionsUrl } from "../utils/venue.js";

/**
 * The next program, and what comes after it.
 *
 * A visitor who came to find out "what is happening next?" should get the
 * answer from the top of the page, with everything needed to act on it: the
 * date, where it is, a way to get there, a way to put it in their calendar and
 * a way to read the full list. The programs that follow are listed quietly
 * underneath — the featured one is the point.
 *
 * The date is `nextEvent`'s: the first stored date still ahead (round 30),
 * so this block never leads with a date that has passed — and with nothing
 * ahead it renders nothing at all, rather than a year nobody entered.
 */
export default function NextProgram({ t, lang, events, onViewAll, flash }) {
  const featured = nextEvent(events);
  if (!featured) return null;

  const countdown = countdownLabel(featured.date, t);
  const directions = directionsUrl(featured.venue);
  const others = events.filter((e) => e.id !== featured.id).slice(0, 3);

  const addToCalendar = () => {
    const ok = downloadIcs({
      title: featured.title,
      dateISO: featured.date,
      venue: featured.venue,
      description: `${t.appName}${featured.guest ? ` — ${featured.guest}` : ""}`,
    });
    flash(ok ? t.icsDownloaded : t.tbaDate);
  };

  return (
    <section className="next-program" aria-labelledby="next-program-title">
      <article className="feature-card reveal">
        <div className="feature-eyebrow">
          <span className="feature-kicker">{t.nextProgram}</span>
          {countdown ? (
            <span className="countdown-chip">{countdown}</span>
          ) : (
            !featured.date && <span className="countdown-chip muted-chip">{t.tbaDate}</span>
          )}
        </div>

        <h2 className="feature-title display" id="next-program-title">
          {featured.title}
        </h2>

        {featured.guest && (
          <p className="feature-guest">
            <User size={13} aria-hidden="true" /> {featured.guest}
          </p>
        )}

        <dl className="feature-facts">
          <div className="feature-fact">
            <dt>{t.whenLabel}</dt>
            <dd>
              <span className="feature-date-text">
                {featured.date ? formatFullDate(featured.date, lang) : t.tbaDate}
              </span>
            </dd>
          </div>
          {featured.venue && (
            <div className="feature-fact">
              <dt>{t.whereLabel}</dt>
              <dd>
                <span className="feature-venue">
                  <MapPin size={13} aria-hidden="true" /> {featured.venue}
                </span>
              </dd>
            </div>
          )}
        </dl>

        <div className="feature-actions">
          <button type="button" className="btn-primary btn-inline" onClick={onViewAll}>
            {t.viewProgram}
          </button>
          {directions && (
            <a
              className="btn-quiet"
              href={directions}
              target="_blank"
              rel="noreferrer"
              aria-label={`${t.getDirections} — ${featured.venue}`}
            >
              <MapPin size={14} aria-hidden="true" /> {t.getDirections}
            </a>
          )}
          <button
            type="button"
            className={`btn-quiet ${featured.date ? "" : "dimmed"}`}
            onClick={addToCalendar}
            aria-label={`${t.addToCalendar}: ${featured.title}`}
          >
            <CalendarPlus size={14} aria-hidden="true" /> {t.addToCalendar}
          </button>
        </div>
      </article>

      {others.length > 0 && (
        <div className="also-coming reveal">
          <h3 className="also-heading display">{t.upcomingPrograms}</h3>
          <ul className="also-list">
            {others.map((e) => {
              const p = e.date ? dateParts(e.date, lang) : { day: e.day, mon: e.mon };
              return (
                <li key={e.id}>
                  <button type="button" className="also-row" onClick={onViewAll}>
                    <span className="also-date" aria-hidden="true">
                      <b className="display">{p.day}</b>
                      <span>{p.mon}</span>
                    </span>
                    <span className="also-title">{e.title}</span>
                    <span className="also-meta">
                      {e.date ? formatFullDate(e.date, lang) : t.tbaDate}
                    </span>
                    <ArrowRight size={14} className="also-arrow" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
