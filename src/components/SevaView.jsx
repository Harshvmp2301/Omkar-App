import { useState } from "react";
import { formatFullDate } from "../utils/calendar.js";
import { submitForm } from "../utils/submitForm.js";

export default function SevaView({ t, lang, flash }) {
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [details, setDetails] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (selected === null) {
      flash(t.chooseSeva);
      return;
    }
    if (!name.trim() || !contact.trim()) {
      flash(t.requiredFields);
      return;
    }
    const seva = t.sevaCards[selected];
    const subject = `Omkar Samithi Seva — ${seva.title}`;
    const body = [
      `Seva: ${seva.title} (${seva.sub})`,
      `Function: ${t.sevaFunction}`,
      `Name: ${name}`,
      `Contact: ${contact}`,
      `Quantity / Details: ${details || "—"}`,
      "",
      "Sent from the Omkar Samithi app.",
    ].join("\n");
    const mailto = `mailto:${t.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    const res = await submitForm({
      form: "seva",
      lang,
      payload: {
        name,
        contact,
        details,
        seva: seva.title,
        sevaSub: seva.sub,
        subject,
        body,
      },
    });
    if (res.ok) {
      setName("");
      setContact("");
      setDetails("");
      flash(t.formSent);
      return;
    }
    // No endpoint (default) or delivery failed → mailto never loses a message.
    window.location.href = mailto;
    flash(res.reason === "no-endpoint" ? t.emailPrepared : t.formFailed);
  };

  return (
    <div className="section section--narrow">
      <div className="section-head reveal">
        <h2 className="section-title display">{t.sevaTitle}</h2>
      </div>
      <p className="view-sub">{t.sevaSub}</p>
      {/* What "offering a seva" actually means, before the options are shown */}
      <p className="seva-what">{t.sevaWhat}</p>

      {/* The three yearly programs and their announced dates (read-only) */}
      <div className="seva-programs">
        <span className="seva-programs-label">{t.sevaProgramsLabel}</span>
        <div className="seva-chips">
          {t.eventsList.map((e) => (
            <span key={e.id} className="seva-chip">
              {e.title}
              <b>{e.date ? formatFullDate(e.date, lang) : t.tbaDate}</b>
            </span>
          ))}
        </div>
      </div>

      <div className="seva-grid" role="radiogroup" aria-label={t.sevaTitle}>
        {t.sevaCards.map((card, i) => (
          <button
            key={card.id}
            type="button"
            role="radio"
            aria-checked={selected === i}
            className={`seva-card ${selected === i ? "selected" : ""}`}
            onClick={() => setSelected(i)}
          >
            <span className="seva-radio" aria-hidden="true" />
            <span className="seva-card-title display">{card.title}</span>
            <span className="seva-card-sub">{card.sub}</span>
          </button>
        ))}
      </div>

      <form className="form-card" onSubmit={submit}>
        {/* Seva is offered for Sri Anjaneya Pooja only — fixed, no date field */}
        <div className="function-row">
          <span className="function-key">{t.sevaFunctionLabel}</span>
          <span className="function-val">🕉 {t.sevaFunction}</span>
        </div>

        <div className="field">
          <label htmlFor="seva-name">{t.fullName}</label>
          <input
            id="seva-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.fullNamePh}
            autoComplete="name"
            required
            aria-required="true"
          />
        </div>

        <div className="field">
          <label htmlFor="seva-contact">{t.contactField}</label>
          <input
            id="seva-contact"
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder={t.contactPh}
            autoComplete="email"
            required
            aria-required="true"
          />
        </div>

        <div className="field">
          <label htmlFor="seva-details">{t.sevaDetailsLabel}</label>
          <input
            id="seva-details"
            type="text"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder={t.sevaDetailsPh}
          />
        </div>

        <p className="form-note">{t.emailOpensNote}</p>
        <button type="submit" className="btn-primary">
          {t.registerSeva}
        </button>
      </form>

      <div className="note-card">{t.sevaNote}</div>
    </div>
  );
}
