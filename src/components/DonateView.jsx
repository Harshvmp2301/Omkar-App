import { useState } from "react";

export default function DonateView({ t, flash }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [purposeIdx, setPurposeIdx] = useState(0);
  const [amount, setAmount] = useState("");

  const submit = (e) => {
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
    window.location.href = `mailto:info@omkarsamithi.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    flash(t.emailPrepared);
  };

  return (
    <div className="section" style={{ maxWidth: 760 }}>
      <div className="section-head">
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
        <button type="submit" className="btn-primary">
          {t.proceedPayment}
        </button>
      </form>
    </div>
  );
}
