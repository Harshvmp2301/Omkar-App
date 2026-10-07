import { Heart, Mail } from "lucide-react";
import WhatWeDo from "./WhatWeDo.jsx";
import Voices from "./Voices.jsx";

/**
 * The About page, in reading order rather than one wall of text:
 *
 *   who we are → what we do → the heritage we keep → the community that keeps
 *   it → who has come → how to join in
 *
 * Nothing was reworded to make this work. The copy is the Samithi's own,
 * moved into the blocks it already had sentences for, so each paragraph can be
 * read on its own instead of scrolled past.
 */
export default function AboutView({ t }) {
  const blocks = [
    { heading: t.aboutWho, body: t.aboutIntro },
    { heading: t.aboutS2H, body: t.aboutS2 },
    { heading: t.aboutS3H, body: t.aboutS3 },
  ];

  return (
    <>
      <div className="section section--narrow">
        <div className="section-head reveal">
          <h1 className="section-title display">{t.aboutTitle}</h1>
        </div>

        <div className="about-prose reveal">
          <section className="about-block">
            <h2 className="display">{blocks[0].heading}</h2>
            <p>{blocks[0].body}</p>
          </section>
        </div>
      </div>

      {/* The same three pillars the homepage leads with — one source, so the
          two pages cannot describe the Samithi differently. */}
      <WhatWeDo t={t} narrow />

      <div className="section section--narrow">
        <div className="about-prose reveal">
          {blocks.slice(1).map(({ heading, body }) => (
            <section className="about-block" key={heading}>
              <h2 className="display">{heading}</h2>
              <p>{body}</p>
            </section>
          ))}
        </div>
      </div>

      <Voices t={t} narrow />

      <div className="section section--narrow">
        <div className="support-card reveal">
          <Heart size={24} className="pillar-icon" aria-hidden="true" />
          <h3 className="pillar-title display">{t.supportTitle}</h3>
          <p className="pillar-body">{t.supportBody}</p>
          <a className="support-cta" href={`mailto:${t.contactEmail}`}>
            <Mail size={14} aria-hidden="true" /> {t.supportCta}
          </a>
        </div>
      </div>
    </>
  );
}
