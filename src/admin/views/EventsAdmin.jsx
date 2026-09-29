import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { AdminEmpty, AdminError, AdminLoading } from "../ui.jsx";
import { formatWhen, toInput, toIso } from "../format.js";

const BLANK = {
  id: null,
  title_en: "",
  title_kn: "",
  description_en: "",
  description_kn: "",
  starts_at: "",
  date_label_en: "",
  date_label_kn: "",
  location_en: "",
  location_kn: "",
  url: "",
  published: true,
  sort_order: 0,
};

export default function EventsAdmin({ getSupabase }) {
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const fetchRows = useCallback(
    () =>
      getSupabase().then((supabase) =>
        supabase
          ? supabase
              .from("events")
              .select("*")
              .order("starts_at", { ascending: true, nullsFirst: false })
          : { data: [], error: null }
      ),
    [getSupabase]
  );

  useEffect(() => {
    let alive = true;
    fetchRows().then(({ data, error: err }) => {
      if (!alive) return;
      if (err) setError(err.message);
      else setRows(data || []);
    });
    return () => {
      alive = false;
    };
  }, [fetchRows]);

  const reload = () =>
    fetchRows().then(({ data, error: err }) => {
      if (err) setError(err.message);
      else setRows(data || []);
    });

  function edit(row) {
    setForm({ ...BLANK, ...row, starts_at: toInput(row.starts_at) });
    setStatus("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setStatus("");
    const supabase = await getSupabase();
    if (!supabase) return setSaving(false);

    if (!form.title_en.trim()) {
      setError("An English title is required — it is what the site displays by default.");
      setSaving(false);
      return;
    }

    // A date, or a label for one not yet announced ("TBA"). The website shows
    // the label whenever starts_at is empty, which is how e2/e3 are handled.
    const payload = {
      title_en: form.title_en.trim(),
      title_kn: form.title_kn.trim() || null,
      description_en: form.description_en.trim() || null,
      description_kn: form.description_kn.trim() || null,
      starts_at: toIso(form.starts_at),
      date_label_en: form.date_label_en.trim() || null,
      date_label_kn: form.date_label_kn.trim() || null,
      location_en: form.location_en.trim() || null,
      location_kn: form.location_kn.trim() || null,
      url: form.url.trim() || null,
      published: Boolean(form.published),
      sort_order: Number(form.sort_order) || 0,
    };

    const { error: err } = form.id
      ? await supabase.from("events").update(payload).eq("id", form.id)
      : await supabase.from("events").insert(payload);

    setSaving(false);
    setError("");
    if (err) {
      setError(err.message);
      return;
    }
    setStatus(form.id ? "Event updated." : "Event added.");
    setForm(BLANK);
    reload();
  }

  async function remove(row) {
    if (!window.confirm(`Delete "${row.title_en}"? This cannot be undone.`)) return;
    const supabase = await getSupabase();
    const { error: err } = await supabase.from("events").delete().eq("id", row.id);
    if (err) return setError(err.message);
    reload();
  }

  return (
    <>
      <form className="admin-card admin-form" onSubmit={save}>
        <p className="admin-card-title">
          {form.id ? `Editing: ${form.title_en}` : "Add an event"}
        </p>

        <div className="admin-grid-2">
          <label className="admin-field">
            <span>Title — English *</span>
            <input
              className="admin-input"
              value={form.title_en}
              onChange={(e) => setForm({ ...form, title_en: e.target.value })}
              placeholder="Omkar Jnanamrutha 2026"
            />
          </label>
          <label className="admin-field">
            <span>Title — Kannada</span>
            <input
              className="admin-input"
              value={form.title_kn}
              onChange={(e) => setForm({ ...form, title_kn: e.target.value })}
              placeholder="ಓಂಕಾರ ಜ್ಞಾನಾಮೃತ ೨೦೨೬"
            />
          </label>
        </div>

        <div className="admin-grid-2">
          <label className="admin-field">
            <span>Date &amp; time</span>
            <input
              className="admin-input"
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
            />
          </label>
          <label className="admin-field">
            <span>…or a label, if the date isn't fixed</span>
            <input
              className="admin-input"
              value={form.date_label_en}
              onChange={(e) => setForm({ ...form, date_label_en: e.target.value })}
              placeholder="Date to be announced"
            />
          </label>
        </div>

        <div className="admin-grid-2">
          <label className="admin-field">
            <span>Description — English</span>
            <textarea
              className="admin-input admin-textarea"
              rows={3}
              value={form.description_en}
              onChange={(e) => setForm({ ...form, description_en: e.target.value })}
            />
          </label>
          <label className="admin-field">
            <span>Description — Kannada</span>
            <textarea
              className="admin-input admin-textarea"
              rows={3}
              value={form.description_kn}
              onChange={(e) => setForm({ ...form, description_kn: e.target.value })}
            />
          </label>
        </div>

        <div className="admin-grid-2">
          <label className="admin-field">
            <span>Location — English</span>
            <input
              className="admin-input"
              value={form.location_en}
              onChange={(e) => setForm({ ...form, location_en: e.target.value })}
            />
          </label>
          <label className="admin-field">
            <span>Location — Kannada</span>
            <input
              className="admin-input"
              value={form.location_kn}
              onChange={(e) => setForm({ ...form, location_kn: e.target.value })}
            />
          </label>
        </div>

        <div className="admin-grid-2">
          <label className="admin-field">
            <span>Link (optional)</span>
            <input
              className="admin-input"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://omkarsamithi.blogspot.com/…"
            />
          </label>
          <label className="admin-field">
            <span>Order on the page (lower shows first)</span>
            <input
              className="admin-input"
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
            />
          </label>
        </div>

        <label className="admin-check">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => setForm({ ...form, published: e.target.checked })}
          />
          <span>Show on the website</span>
        </label>

        <div className="admin-form-actions">
          <button className="admin-btn admin-btn--primary" disabled={saving}>
            {saving ? "Saving…" : form.id ? "Save changes" : "Add event"}
          </button>
          {form.id && (
            <button
              type="button"
              className="admin-btn"
              onClick={() => {
                setForm(BLANK);
                setStatus("");
              }}
            >
              Cancel
            </button>
          )}
          {status && <span className="admin-ok">{status}</span>}
        </div>
      </form>

      {error && <AdminError>{error}</AdminError>}

      {!rows ? (
        <AdminLoading />
      ) : rows.length === 0 ? (
        <AdminEmpty>
          No events stored yet — the website is showing its built-in list. Any
          event you add here takes over from it.
        </AdminEmpty>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>When</th>
                <th>Location</th>
                <th>On site</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="admin-strong">
                    {r.title_en}
                    {r.title_kn ? <span className="admin-muted"> · {r.title_kn}</span> : null}
                  </td>
                  <td className="admin-nowrap">
                    {r.starts_at ? formatWhen(r.starts_at) : r.date_label_en || "TBA"}
                  </td>
                  <td>{r.location_en || "—"}</td>
                  <td>{r.published ? "Yes" : "Hidden"}</td>
                  <td className="admin-row-actions">
                    <button className="admin-btn admin-btn--quiet" onClick={() => edit(r)}>
                      Edit
                    </button>
                    <button
                      className="admin-btn admin-btn--danger"
                      onClick={() => remove(r)}
                      aria-label={`Delete ${r.title_en}`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
