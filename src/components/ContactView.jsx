import { useEffect, useRef, useState } from "react";
import { submitForm } from "../utils/submitForm.js";
import { botFilled, requiredErrors, tooFast } from "../utils/formGuard.js";

export default function ContactView({ t, lang, flash }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  /* Round 64 (audit A5 + B3): the message error lives under the textarea
     (aria-invalid + aria-describedby); the honeypot and the velocity guard
     stand in front of every submission, as on the Seva form. */
  const [company, setCompany] = useState("");
  const [msgErr, setMsgErr] = useState(false);
  const [waitNote, setWaitNote] = useState(false);
  // Stamped on mount (not during render — render must stay pure): the
  // clock the velocity guard measures against.
  const openedAt = useRef(0);
  useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (botFilled({ company })) {
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
      setMsgErr(false);
      flash(t.formSent);
      return;
    }
    if (tooFast(openedAt.current)) {
      setWaitNote(true);
      return;
    }
    setWaitNote(false);
    if (requiredErrors({ message }, ["message"]).message) {
      setMsgErr(true);
      const el = document.getElementById("ct-message");
      if (el) el.focus();
      return;
    }
    setMsgErr(false);
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
          {/* Round 64 (audit B3): the honeypot — off-screen, untabbable,
              aria-hidden; a bot that fills every input fills this one. */}
          <div className="hp-field" aria-hidden="true">
            <label htmlFor="ct-company">Company</label>
            <input
              id="ct-company"
              name="company"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
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
              onChange={(e) => {
                setMessage(e.target.value);
                if (msgErr) setMsgErr(false);
              }}
              placeholder={t.messagePh}
              required
              aria-required="true"
              aria-invalid={msgErr ? true : undefined}
              aria-describedby={msgErr ? "ct-message-err" : undefined}
            />
            {msgErr ? (
              <p className="field-err" id="ct-message-err">
                {t.messageRequired}
              </p>
            ) : null}
          </div>

          {waitNote ? (
            <p className="field-err" id="ct-wait" role="status">
              {t.formWait}
            </p>
          ) : null}
          <button type="submit" className="btn-primary">
            {t.sendMessage}
          </button>
        </form>
      </div>
    </>
  );
}
