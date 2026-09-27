import { Flame, Music, Users, Heart, Mail } from "lucide-react";

export default function AboutView({ t }) {
  const pillars = [
    { icon: Flame, title: t.pillarBhakti, body: t.pillarBhaktiBody },
    { icon: Music, title: t.pillarHeritage, body: t.pillarHeritageBody },
    { icon: Users, title: t.pillarCommunity, body: t.pillarCommunityBody },
  ];

  return (
    <div className="section section--narrow">
      <div className="section-head reveal">
        <h2 className="section-title display">{t.aboutTitle}</h2>
      </div>

      <div className="about-prose">
        <p className="about-lead">{t.aboutLead}</p>
        <p>{t.aboutP1}</p>
        <p>{t.aboutP2}</p>
      </div>

      <div className="pillar-grid reveal">
        {pillars.map(({ icon: Icon, title, body }) => (
          <div key={title} className="pillar-card">
            <Icon size={24} className="pillar-icon" aria-hidden="true" />
            <h3 className="pillar-title display">{title}</h3>
            <p className="pillar-body">{body}</p>
          </div>
        ))}
      </div>

      <div className="support-card reveal">
        <Heart size={24} className="pillar-icon" aria-hidden="true" />
        <h3 className="pillar-title display">{t.supportTitle}</h3>
        <p className="pillar-body">{t.supportBody}</p>
        <a className="support-cta" href="mailto:info@omkarsamithi.com">
          <Mail size={14} aria-hidden="true" /> {t.supportCta}
        </a>
      </div>
    </div>
  );
}
