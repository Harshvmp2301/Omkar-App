import { useState } from "react";
import { formatFullDate } from "../utils/calendar.js";

export default function SevaView({ t, lang, flash }) {
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [details, setDetails] = useState("");

  const submit = (e) => {
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
    window.location.href = `mailto:info@omkarsamithi.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    flash(t.emailPrepared);
  };

  return (
    <div className="section" style={{ maxWidth: 760 }}>
      <div className="section-head">
        <h2 className="section-title display">{t.sevaTitle}</h2>
      </div>
      <p className="view-sub">{t.sevaSub}</p>

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

        <button type="submit" className="btn-primary">
          {t.registerSeva}
        </button>
      </form>

      <div className="note-card">{t.sevaNote}</div>
    </div>
  );
}
