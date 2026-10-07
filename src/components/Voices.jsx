/**
 * The scholars and artists the Samithi has invited.
 *
 * These names used to live inside a paragraph, where nobody read them. They
 * are the clearest evidence of what this organisation is, so they get their
 * own block: the same sentence the About copy used, then two labelled lists —
 * no invented biographies, no invented titles.
 */
export default function Voices({ t, narrow = false }) {
  const voices = t.voices || [];
  const group = (key) => voices.filter((v) => v.group === key);

  const list = (key, label, program) => {
    const people = group(key);
    if (!people.length) return null;
    return (
      <div className="voices-group">
        <h3 className="voices-label">{label}</h3>
        <p className="voices-program">{program}</p>
        <ul className="voices-names">
          {people.map((p) => (
            <li key={p.id} className="voices-name display">
              {p.name}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <section
      className={`section voices reveal${narrow ? " section--narrow" : ""}`}
      aria-labelledby="voices-title"
    >
      <div className="section-head section-head--plain">
        <h2 className="section-title display" id="voices-title">
          {t.voicesTitle}
        </h2>
      </div>
      <p className="section-lede">{t.voicesIntro}</p>
      <div className="voices-groups">
        {list("scholars", t.voicesScholars, t.voicesProgramScholars)}
        {list("artists", t.voicesArtists, t.voicesProgramArtists)}
      </div>
      <p className="voices-note">{t.aboutAward}</p>
    </section>
  );
}
