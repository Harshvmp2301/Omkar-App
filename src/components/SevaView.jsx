import { useState } from "react";
import { formatFullDate } from "../utils/calendar.js";
import { submitForm } from "../utils/submitForm.js";

export default function SevaView({ t, lang, flash, events }) {
  const programs =
    Array.isArray(events) && events.length ? events : t.eventsList;
  // Round 40: a volunteer often offers more than one seva at once — flowers
  // AND lamps, prasada AND cleaning — so the cards are a multi-select now.
  // `selected` holds the indexes of every chosen card.
  const [selected, setSelected] = useState([]);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [details, setDetails] = useState("");

  const toggle = (i) =>
    setSelected((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
    );

  const submit = async (e) => {
    e.preventDefault();
    if (selected.length === 0) {
      flash(t.chooseSeva);
      return;
    }
    if (!name.trim() || !contact.trim()) {
      flash(t.requiredFields);
      return;
    }
    // Round 40, the owner's rule: an Oman phone number is eight digits —
    // not less, not more. The input itself refuses anything but digits and
    // stops at eight; this check is the belt to those braces.
    if (!/^\d{8}$/.test(contact.trim())) {
      flash(t.contactDigits);
      return;
    }
    const chosen = selected.map((i) => t.sevaCards[i]);
    const subject = `Omkar Samithi Seva — ${chosen.map((c) => c.title).join(", ")}`;
    const body = [
      ...chosen.map((c) => `Seva: ${c.title} (${c.sub})`),
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
        seva: chosen.map((c) => c.title).join(" + "),
        sevaSub: chosen.map((c) => c.sub).join(" + "),
        subject,
        body,
      },
    });
    if (res.ok) {
      setName("");
      setContact("");
      setDetails("");
      setSelected([]);
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
        <h1 className="section-title display">{t.sevaTitle}</h1>
      </div>
      <p className="view-sub">{t.sevaSub}</p>
      {/* What "offering a seva" actually means, before the options are shown */}
      <p className="seva-what">{t.sevaWhat}</p>

      {/* The three yearly programs and their announced dates (read-only).
          `events` is App's stored list (sortedByDate) — the SAME list the
          program rows and the homepage use, so this page cannot print a date
          that has already passed. It falls back to the curated list only when
          the prop is absent, which is how the standalone render test mounts
          this view. */}
      <div className="seva-programs">
        <span className="seva-programs-label">{t.sevaProgramsLabel}</span>
        <div className="seva-chips">
          {programs.map((e) => (
            <span key={e.id} className="seva-chip">
              {e.title}
              <b>{e.date ? formatFullDate(e.date, lang) : t.tbaDate}</b>
            </span>
          ))}
        </div>
      </div>

      <div className="seva-grid" role="group" aria-label={t.sevaTitle}>
        {t.sevaCards.map((card, i) => (
          <button
            key={card.id}
            type="button"
            aria-pressed={selected.includes(i)}
            className={`seva-card ${selected.includes(i) ? "selected" : ""}`}
            onClick={() => toggle(i)}
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
          {/* No Om mark here: round 21 replaced the device emoji with an SVG
              glyph, and round 26 removed even that at the owner's request —
              beside the function name it read as misaligned decoration. The
              name stands alone. */}
          <span className="function-val">{t.sevaFunction}</span>
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
            inputMode="numeric"
            maxLength={8}
            value={contact}
            onChange={(e) => setContact(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder={t.contactPh}
            autoComplete="tel"
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
