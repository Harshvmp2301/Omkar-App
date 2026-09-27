import { Mail, Send, Facebook, Youtube, ExternalLink } from "lucide-react";

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

        <a
          href="https://omkarfeedback.blogspot.com/"
          target="_blank"
          rel="noreferrer"
          className="contact-card"
        >
          <Send size={28} className="icon" aria-hidden="true" />
          <div className="label">{t.feedbackForm}</div>
          <div className="value">omkarfeedback.blogspot.com</div>
        </a>
      </div>

      <div className="social-icons">
        <a
          href="https://www.facebook.com/groups/omkarsamithi/"
          target="_blank"
          rel="noreferrer"
          className="social-link"
        >
          <Facebook size={18} className="social-icon" aria-hidden="true" />
          Facebook Group
        </a>
        <a
          href="https://www.youtube.com/@OmkarSamithi"
          target="_blank"
          rel="noreferrer"
          className="social-link"
        >
          <Youtube size={18} className="social-icon" aria-hidden="true" />
          YouTube Channel
        </a>
        <a
          href="https://omkarfeedback.blogspot.com/"
          target="_blank"
          rel="noreferrer"
          className="social-link"
        >
          <ExternalLink size={18} className="social-icon" aria-hidden="true" />
          Feedback Form
        </a>
      </div>
    </section>
  );
}
