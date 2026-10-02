import Diya from "./Diya.jsx";
import { litDiyas, anyDiyaLit } from "../utils/diya.js";

export default function Hero({ t, events, onGoToEvents }) {
  // Each lamp lights a month before its own program and goes dark once the
  // program is over, so the lamps come on one by one through the year. The
  // lit one is always the soonest program — see src/utils/diya.js.
  const lamps = events.slice(0, 4);
  const lit = litDiyas(lamps);
  return (
    <section className="hero">
      {/* The logo is intentionally NOT rendered here — it is fixed-positioned
          once at page level (App.jsx) to the centre of the viewport at
          scrollY=0, animating into the navbar as the user scrolls. */}
      <div className="hero-content">
        <h1 className="display">Oman Karnataka Aradhana Samithi</h1>
        <p>{t.tagline}</p>
        <div className="diya-row">
          {lamps.map((e, i) => (
            <Diya key={e.id} lit={lit[i]} onClick={onGoToEvents} label={e.title} />
          ))}
        </div>
        {/* The line promises that a lit lamp marks the soonest program. With
            every lamp dark — early in the year, or between programs — it would
            be describing something that is not on screen, so it waits. */}
        {anyDiyaLit(lamps) && <p className="diya-hint">{t.diyaHint}</p>}
      </div>
    </section>
  );
}
