import Diya from "./Diya.jsx";
import { litDiyas, anyDiyaLit } from "../utils/diya.js";

export default function Hero({ t, events, onGoToEvents }) {
  // Each lamp lights a month before its own program and then STAYS lit — the
  // programs finish, the flames do not. So the row gets brighter through the
  // year and goes dark again on 1 January. See src/utils/diya.js.
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
