import { Mail } from "lucide-react";

/**
 * Contact details (emails). Shown ONLY inside the merged About tab —
 * the social/feedback links moved into the Pranaams footer.
 */
export default function Contact({ t }) {
  return (
    <section className="contact-section">
      <h2 className="contact-title display">{t.contactUs}</h2>
      <p className="contact-sub">{t.contactMethods}</p>

      <div className="contact-grid">
        <div className="contact-card">
          <Mail size={28} className="icon" aria-hidden="true" />
          <div className="label">{t.emailUs}</div>
          <div className="contact-emails">
            <span className="value">
              <a href="mailto:info@omkarsamithi.com">info@omkarsamithi.com</a>
            </span>
            <span className="value">
              <a href="mailto:omkarsamithi@gmail.com">omkarsamithi@gmail.com</a>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
