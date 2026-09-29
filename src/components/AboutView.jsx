import { Heart, Mail } from "lucide-react";

export default function AboutView({ t }) {
  // Item-7 copy: three accurate, user-authored sections rendered from content
  // (bilingual) — replaces the old lead/paragraphs + three-pillar cards.
  const sections = [
    { heading: t.aboutS1H, body: t.aboutS1 },
    { heading: t.aboutS2H, body: t.aboutS2 },
    { heading: t.aboutS3H, body: t.aboutS3 },
  ];

  return (
    <div className="section section--narrow">
      <div className="section-head reveal">
        <h2 className="section-title display">{t.aboutTitle}</h2>
      </div>

      <div className="about-prose reveal">
        {sections.map(({ heading, body }) => (
          <section className="about-block" key={heading}>
            <h3 className="display">{heading}</h3>
            <p>{body}</p>
          </section>
        ))}
      </div>

      <div className="support-card reveal">
        <Heart size={24} className="pillar-icon" aria-hidden="true" />
        <h3 className="pillar-title display">{t.supportTitle}</h3>
        <p className="pillar-body">{t.supportBody}</p>
        <a className="support-cta magnetic" href={`mailto:${t.contactEmail}`}>
          <Mail size={14} aria-hidden="true" /> {t.supportCta}
        </a>
      </div>
    </div>
  );
}
