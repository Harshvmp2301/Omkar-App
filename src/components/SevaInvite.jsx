import { HeartHandshake, ArrowRight } from "lucide-react";
import { formatFullDate } from "../utils/calendar.js";
import { nextEvent } from "../utils/events.js";

/**
 * A short way into the Seva page.
 *
 * Seva is the one thing on this site a visitor can *do*, so the homepage says
 * plainly what offering one means — time, materials or support for a program —
 * and then hands over to the Seva page, which has the options and the form.
 */
export default function SevaInvite({ t, lang, events, onOpenSeva }) {
  const next = nextEvent(events || []);

  return (
    <section className="section seva-invite reveal" aria-labelledby="seva-invite-title">
      <div className="invite-card">
        <HeartHandshake size={22} className="invite-mark" aria-hidden="true" />
        <div className="invite-text">
          <h2 className="invite-title display" id="seva-invite-title">
            {t.joinSeva}
          </h2>
          <p className="invite-line">{t.sevaWhat}</p>
          {next && (
            <p className="invite-next">
              {t.nextProgram}: <b>{next.title}</b>
              {next.date ? ` · ${formatFullDate(next.date, lang)}` : ""}
            </p>
          )}
        </div>
        <button type="button" className="link-cta" onClick={onOpenSeva}>
          {t.sevaTab} <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
