import { useCallback, useEffect, useState } from "react";
import { AdminError, AdminLoading } from "../ui.jsx";
import { EVENT_TITLES, eventRowFromForm } from "../../utils/events.js";
import { dateOnly } from "../../utils/calendar.js";

/**
 * The three programs, as three fixed tiles (round 31).
 *
 * The owner's rule: the programs never change — Jnanamrutha, Naadamrutha and
 * the Anjaneya Pooje are the Samithi's year — so nothing here can add, rename
 * or delete one. Each tile holds exactly what moves: the date, and for the
 * two programs that have one, the guest's name in English and Kannada. The
 * Anjaneya Pooje tile carries the date alone, as asked.
 *
 * Saving writes the one row for that program (updating it if the dashboard
 * already holds one, inserting it the first time), and the public site shows
 * exactly what was saved: the Events tab at the stored date, the homepage
 * under "Upcoming Programs" while the date is still ahead.
 */

/** The two programs with a guest; the Pooje tile shows the date only. */
const WITH_GUEST = new Set(["Omkar Jnanamrutha", "Omkar Naadamrutha"]);

const BLANK_TILE = { starts_at: "", guest_en: "", guest_kn: "" };

export default function EventsAdmin({ getSupabase }) {
  const [rows, setRows] = useState(null);
  const [tiles, setTiles] = useState({});
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState("");

  const fetchRows = useCallback(
    () =>
      getSupabase().then((supabase) =>
        supabase
          ? supabase.from("events").select("*")
          : { data: [], error: null }
      ),
    [getSupabase]
  );

  /**
   * The row a tile edits — and it must be the SAME row the public site reads.
   * The public fetch filters `published=eq.true` and orders by starts_at, so
   * the row a visitor sees is the published one with the latest date. Round
   * 31 sorted by date alone and never touched `published`, so a save could
   * land on a row the public page never reads (the owner's 7 Dec save stayed
   * invisible behind an unpublished April row). Published first, then latest
   * date, puts the tile on exactly the public row.
   */
  const rowFor = useCallback(
    (title) =>
      (rows || [])
        .filter((r) => r.title_en === title)
        .sort(
          (a, b) =>
            (b.published === true) - (a.published === true) ||
            String(b.starts_at || "").localeCompare(String(a.starts_at || ""))
        )[0],
    [rows]
  );

  useEffect(() => {
    let alive = true;
    fetchRows().then(({ data, error: err }) => {
      if (!alive) return;
      if (err) return setError(err.message);
      const list = data || [];
      setRows(list);
      const seeded = {};
      for (const { en } of EVENT_TITLES) {
        const row = list
          .filter((r) => r.title_en === en)
          .sort(
            (a, b) =>
              (b.published === true) - (a.published === true) ||
              String(b.starts_at || "").localeCompare(String(a.starts_at || ""))
          )[0];
        seeded[en] = row
          ? {
              starts_at: dateOnly(row.starts_at),
              guest_en: row.description_en || "",
              guest_kn: row.description_kn || "",
            }
          : { ...BLANK_TILE };
      }
      setTiles(seeded);
    });
    return () => {
      alive = false;
    };
  }, [fetchRows]);

  const set = (title, field, value) =>
    setTiles((all) => ({ ...all, [title]: { ...all[title], [field]: value } }));

  async function save(title) {
    setSaving(title);
    setError("");
    setStatus("");
    const tile = tiles[title] || BLANK_TILE;
    const supabase = await getSupabase();
    if (!supabase) return setSaving("");

    const payload = {
      ...eventRowFromForm({
        title_en: title,
        starts_at: tile.starts_at || null,
        guest_en: WITH_GUEST.has(title) ? tile.guest_en : "",
        guest_kn: WITH_GUEST.has(title) ? tile.guest_kn : "",
      }),
      // The public page only ever reads published rows: saving a program is
      // publishing it. Without this, a row born unpublished in the old table
      // stayed invisible no matter how many times it was saved.
      published: true,
    };
    const row = rowFor(title);
    const { error: err } = row
      ? await supabase.from("events").update(payload).eq("id", row.id)
      : await supabase.from("events").insert(payload);

    setSaving("");
    if (err) return setError(err.message);
    setStatus(`${title} saved — the site now shows exactly this.`);
    fetchRows().then(({ data, error: err2 }) => {
      if (err2) return setError(err2.message);
      setRows(data || []);
    });
  }

  if (!rows) return <AdminLoading label="Reading the three programs…" />;

  return (
    <div className="admin-tiles">
      <p className="admin-muted">
        The three programs are fixed. Update a date or a guest and save — the
        public site shows exactly what is stored here: every program on the
        Events page at its stored date, and under “Upcoming Programs” on the
        homepage while its date is still ahead.
      </p>
      {error ? <AdminError>{error}</AdminError> : null}
      {status ? <p className="admin-muted">{status}</p> : null}

      {EVENT_TITLES.map(({ en, kn }) => {
        const tile = tiles[en] || BLANK_TILE;
        const stored = (rows || []).filter((r) => r.title_en === en);
        return (
          <section className="admin-tile" key={en} aria-label={en}>
            <h3>
              {en} <span className="admin-tile-kn">{kn}</span>
            </h3>
            {stored.length > 1 ? (
              <p className="admin-muted">
                Heads-up: {stored.length} stored rows carry this program's name
                (left over from the old free-form table). This tile edits the
                published one with the latest date — the same row the site
                reads. The duplicates can be removed with the SQL in
                TRANSFER-NOTES; until then they are simply ignored.
              </p>
            ) : null}

            <label className="admin-field">
              Date of the program
              <input
                className="admin-input"
                type="date"
                value={tile.starts_at}
                onChange={(e) => set(en, "starts_at", e.target.value)}
              />
            </label>

            {WITH_GUEST.has(en) ? (
              <>
                <label className="admin-field">
                  Guest (English)
                  <input
                    className="admin-input"
                    type="text"
                    value={tile.guest_en}
                    placeholder="e.g. Smt. Amrutha Naidu"
                    onChange={(e) => set(en, "guest_en", e.target.value)}
                  />
                </label>
                <label className="admin-field">
                  Guest (Kannada)
                  <input
                    className="admin-input"
                    type="text"
                    value={tile.guest_kn}
                    placeholder="ಉದಾ. ಶ್ರೀಮತಿ ಅಮೃತಾ ನಾಯ್ಡು"
                    onChange={(e) => set(en, "guest_kn", e.target.value)}
                  />
                </label>
              </>
            ) : (
              <p className="admin-muted">This program carries no guest — the date alone.</p>
            )}

            <button
              type="button"
              className="admin-btn"
              disabled={saving !== ""}
              onClick={() => save(en)}
            >
              {saving === en ? "Saving…" : "Save"}
            </button>
          </section>
        );
      })}
    </div>
  );
}
