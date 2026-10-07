import { useState } from "react";
import { submitForm } from "../utils/submitForm.js";

export default function ContactView({ t, lang, flash }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      flash(t.messageRequired);
      return;
    }
    const mailSubject = subject.trim() || "Website enquiry";
    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      "",
      message,
      "",
      "Sent from the Omkar Samithi app.",
    ].join("\n");
    const mailto = `mailto:${t.contactEmail}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(body)}`;

    const res = await submitForm({
      form: "contact",
      lang,
      payload: { name, email, subject: mailSubject, message, body },
    });
    if (res.ok) {
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
      flash(t.formSent);
      return;
    }
    // No endpoint (default) or delivery failed → mailto never loses a message.
    window.location.href = mailto;
    flash(res.reason === "no-endpoint" ? t.emailPrepared : t.formFailed);
  };

  return (
    <>
      <div className="section section--narrow">
        <div className="section-head reveal">
          <h2 className="section-title display">{t.messageFormTitle}</h2>
        </div>
        <p className="view-sub">{t.contactSub}</p>

        <form className="form-card" onSubmit={submit}>
          <div className="field">
            <label htmlFor="ct-name">{t.fullName}</label>
            <input
              id="ct-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.fullNamePh}
              autoComplete="name"
            />
          </div>

          <div className="field">
            <label htmlFor="ct-email">{t.emailLabel}</label>
            <input
              id="ct-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@example.com"
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label htmlFor="ct-subject">{t.subjectLabel}</label>
            <input
              id="ct-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t.subjectPh}
            />
          </div>

          <div className="field">
            <label htmlFor="ct-message">{t.messageLabel}</label>
            <textarea
              id="ct-message"
              rows="5"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t.messagePh}
              required
              aria-required="true"
            />
          </div>

          <button type="submit" className="btn-primary">
            {t.sendMessage}
          </button>
        </form>
      </div>
    </>
  );
}
