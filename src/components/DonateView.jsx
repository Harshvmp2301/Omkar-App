import { useState } from "react";
import { submitForm } from "../utils/submitForm.js";

export default function DonateView({ t, lang, flash }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [purposeIdx, setPurposeIdx] = useState(0);
  const [amount, setAmount] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !contact.trim()) {
      flash(t.requiredFields);
      return;
    }
    const purpose = t.purposes[purposeIdx] || t.purposes[0];
    const subject = `Omkar Samithi Donation — ${purpose}`;
    const body = [
      `Name: ${name}`,
      `Contact: ${contact}`,
      `Purpose: ${purpose}`,
      `Amount: OMR ${amount || "0.00"}`,
      "",
      "Sent from the Omkar Samithi app.",
    ].join("\n");
    const mailto = `mailto:${t.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    const res = await submitForm({
      form: "donate",
      lang,
      payload: { name, contact, purpose, amount: amount || "0.00", subject, body },
    });
    if (res.ok) {
      setName("");
      setContact("");
      setAmount("");
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
        <h2 className="section-title display">{t.donateTitle}</h2>
      </div>
      <p className="view-sub">{t.donateSub}</p>

      <form className="form-card" onSubmit={submit}>
        <div className="field">
          <label htmlFor="donate-name">{t.fullName}</label>
          <input
            id="donate-name"
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
          <label htmlFor="donate-contact">{t.contactField}</label>
          <input
            id="donate-contact"
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
          <label htmlFor="donate-purpose">{t.purposeLabel}</label>
          <select
            id="donate-purpose"
            value={purposeIdx}
            onChange={(e) => setPurposeIdx(Number(e.target.value))}
          >
            {t.purposes.map((p, i) => (
              <option key={`${i}-${p}`} value={i}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="donate-amount">{t.amountLabel}</label>
          <input
            id="donate-amount"
            type="number"
            min="0"
            step="0.001"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <p className="form-note">{t.donateDisclaimer}</p>
        <p className="form-note">{t.emailOpensNote}</p>
        <button type="submit" className="btn-primary">
          {t.proceedPayment}
        </button>
      </form>
    </div>
  );
}
