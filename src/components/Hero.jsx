import Diya from "./Diya.jsx";

export default function Hero({ t, events, onGoToEvents }) {
  return (
    <section className="hero">
      <img src="/Omkar Logo Final Transparent.png" alt="" className="hero-logo" />
      <h1 className="display">Oman Karnataka Aradhana Samithi</h1>
      <p>{t.tagline}</p>
      <div className="diya-row">
        {events.slice(0, 4).map((e, i) => (
          <Diya key={e.id} lit={i === 0} onClick={onGoToEvents} label={e.title} />
        ))}
      </div>
      <p className="diya-hint">{t.diyaHint}</p>
    </section>
  );
}
