import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { AdminEmpty, AdminError, AdminLoading } from "../ui.jsx";
import { formatDate } from "../format.js";
import { dateOnly } from "../../utils/calendar.js";
import {
  EVENT_TITLES,
  TITLE_EN,
  titleKnFor,
  eventRowFromForm,
} from "../../utils/events.js";

/**
 * Three programs, three choices. The form deliberately cannot type a title or
 * a venue: a typo there is a typo on the public website. The only free text is
 * the guest's name, and the only other decision is the date.
 */
const BLANK = {
  id: null,
  title_en: "",
  title_kn: "",
  starts_at: "",
  guest_en: "",
  guest_kn: "",
  published: true,
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
    setForm({
      id: row.id,
      title_en: row.title_en || "",
      title_kn: row.title_kn || "",
      starts_at: dateOnly(row.starts_at),
      guest_en: row.description_en || "",
      guest_kn: row.description_kn || "",
      published: row.published !== false,
    });
    setStatus("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setStatus("");
    setError("");

    if (!form.title_en) {
      setError("Choose which program this is.");
      setSaving(false);
      return;
    }

    const supabase = await getSupabase();
    if (!supabase) return setSaving(false);

    const payload = eventRowFromForm(form);
    const { error: err } = form.id
      ? await supabase.from("events").update(payload).eq("id", form.id)
      : await supabase.from("events").insert(payload);

    setSaving(false);
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

  const alreadyListed = (title) =>
    Boolean(rows && rows.some((r) => r.title_en === title && r.id !== form.id));

  return (
    <>
      <form className="admin-card admin-form" onSubmit={save}>
        <p className="admin-card-title">
          {form.id ? `Editing: ${form.title_en}` : "Add an event"}
        </p>

        <div className="admin-grid-2">
          <label className="admin-field">
            <span>Program — English *</span>
            <select
              className="admin-input"
              value={form.title_en}
              onChange={(e) =>
                // The Kannada name belongs to the English one, so it follows.
                // It stays a dropdown, so it can still be changed on its own.
                setForm({
                  ...form,
                  title_en: e.target.value,
                  title_kn: titleKnFor(e.target.value),
                })
              }
            >
              <option value="">Choose a program…</option>
              {TITLE_EN.map((title) => (
                <option key={title} value={title}>
                  {title}
                  {alreadyListed(title) ? " — already on the list" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Program — Kannada</span>
            <select
              className="admin-input"
              value={form.title_kn}
              onChange={(e) => setForm({ ...form, title_kn: e.target.value })}
            >
              <option value="">Choose a program…</option>
              {EVENT_TITLES.map((t) => (
                <option key={t.kn} value={t.kn}>
                  {t.kn}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="admin-field">
          <span>Date</span>
          <input
            className="admin-input"
            type="date"
            value={form.starts_at}
            onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
          />
          <em className="admin-hint">
            Not decided yet? Leave this empty — the website shows “Date TBA” by
            itself. The date is the day of the program, not the year: the
            website repeats it every year on its own, so there is nothing to
            update in January. The venue is always Sri Krishna Temple, Darsait.
          </em>
        </label>

        <div className="admin-grid-2">
          <label className="admin-field">
            <span>Guest names — English</span>
            <input
              className="admin-input"
              value={form.guest_en}
              onChange={(e) => setForm({ ...form, guest_en: e.target.value })}
              placeholder="Smt. Amrutha Naidu"
            />
          </label>
          <label className="admin-field">
            <span>Guest names — Kannada</span>
            <input
              className="admin-input"
              value={form.guest_kn}
              onChange={(e) => setForm({ ...form, guest_kn: e.target.value })}
              placeholder="ಶ್ರೀಮತಿ ಅಮೃತಾ ನಾಯ್ಡು"
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
                <th>Program</th>
                <th>Date</th>
                <th>Guest</th>
                <th>On site</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="admin-strong">
                    {r.title_en}
                    {r.title_kn ? (
                      <span className="admin-muted"> · {r.title_kn}</span>
                    ) : null}
                  </td>
                  <td className="admin-nowrap">
                    {r.starts_at ? formatDate(r.starts_at) : "Date TBA"}
                  </td>
                  <td>{r.description_en || "—"}</td>
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
