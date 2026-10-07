import { Flame, Music, Users } from "lucide-react";

/**
 * What the Samithi does, in three lines.
 *
 * The About page explains all of this at length; on the homepage the reader
 * only needs to place the organisation in ten seconds. The three pillars are
 * the same three things the About copy is built on — bhakti, culture and
 * community — so the two pages cannot drift apart.
 */
export default function WhatWeDo({ t, narrow = false }) {
  const pillars = [
    { id: "bhakti", Icon: Flame, title: t.pillarBhakti, body: t.pillarBhaktiBody },
    { id: "culture", Icon: Music, title: t.pillarCulture, body: t.pillarCultureBody },
    { id: "community", Icon: Users, title: t.pillarCommunity, body: t.pillarCommunityBody },
  ];

  return (
    <section
      className={`section what-we-do reveal${narrow ? " section--narrow" : ""}`}
      aria-labelledby="what-we-do-title"
    >
      <div className="section-head section-head--plain">
        <h2 className="section-title display" id="what-we-do-title">
          {t.whatWeDo}
        </h2>
      </div>
      <p className="section-lede">{t.whatWeDoIntro}</p>
      <div className="pillar-grid">
        {pillars.map(({ id, Icon, title, body }) => (
          <div className="pillar" key={id}>
            <Icon size={20} className="pillar-mark" aria-hidden="true" />
            <h3 className="pillar-heading display">{title}</h3>
            <p className="pillar-line">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
