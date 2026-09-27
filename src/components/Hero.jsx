import Diya from "./Diya.jsx";

export default function Hero({ t, events, onGoToEvents }) {
  return (
    <section className="hero">
      {/* The logo is intentionally NOT rendered here — it is fixed-positioned
          once at page level (App.jsx) to the centre of the viewport at
          scrollY=0, animating into the navbar as the user scrolls. */}
      <div className="hero-content">
        <h1 className="display">Oman Karnataka Aradhana Samithi</h1>
        <p>{t.tagline}</p>
        <div className="diya-row">
          {events.slice(0, 4).map((e, i) => (
            <Diya key={e.id} lit={i === 0} onClick={onGoToEvents} label={e.title} />
          ))}
        </div>
        <p className="diya-hint">{t.diyaHint}</p>
      </div>
    </section>
  );
}
