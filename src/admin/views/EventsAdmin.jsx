import { useCallback, useEffect, useState } from "react";
import { AdminError, AdminLoading } from "../ui.jsx";
import { eventRowFromForm } from "../../utils/events.js";
import { dateOnly } from "../../utils/calendar.js";

/**
 * The Samithi's programs, as a living list (round 66).
 *
 * Round 31 froze this page to three fixed tiles because the programs never
 * changed. The client's round-66 ruling reversed that: the dashboard must be
 * able to ADD an event (the Omkar Dashamotsava and whatever comes next),
 * RENAME any event in both languages, and set a TIME of day beside the date.
 * So the tiles became cards built from the stored rows themselves, plus an
 * "Add event" card that inserts a fresh row.
 *
 * Saving a card writes its one row (updating when the card came from the
 * database, inserting when it is new) and publishes it, because the public
 * site only ever reads published rows: what you save here is exactly what
 * the Events page, the homepage bar and the reminder bells show — now
 * including the time of day, which rides in the `time_text` column
 * (added with: alter table public.events add column if not exists
 * time_text text;).
 */

const BLANK_CARD = {
  id: null,
  title_en: "",
  title_kn: "",
  starts_at: "",
  time_text: "",
  guest_en: "",
  guest_kn: "",
};

let cardSeq = 0;
const nextKey = () => `new-${(cardSeq += 1)}`;

const cardFromRow = (row) => ({
  id: row.id,
  title_en: row.title_en || "",
  title_kn: row.title_kn || "",
  starts_at: dateOnly(row.starts_at),
  time_text: row.time_text || "",
  guest_en: row.description_en || "",
  guest_kn: row.description_kn || "",
});

export default function EventsAdmin({ getSupabase }) {
  const [rows, setRows] = useState(null);
  const [cards, setCards] = useState([]);
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

  useEffect(() => {
    let alive = true;
    fetchRows().then(({ data, error: err }) => {
      if (!alive) return;
      if (err) return setError(err.message);
      const list = data || [];
      setRows(list);
      // Soonest first, undated last — the same order the public list uses.
      setCards(
        [...list]
          .sort((a, b) =>
            String(a.starts_at || "9999").localeCompare(String(b.starts_at || "9999"))
          )
          .map((row) => ({ ...cardFromRow(row), key: nextKey() }))
      );
    });
    return () => {
      alive = false;
    };
  }, [fetchRows]);

  const setCard = (key, field, value) =>
    setCards((all) => all.map((c) => (c.key === key ? { ...c, [field]: value } : c)));

  const addCard = () =>
    setCards((all) => [...all, { ...BLANK_CARD, key: nextKey() }]);

  async function save(card) {
    if (!String(card.title_en || "").trim()) {
      return setError("Every event needs an English name — it is the row's identity.");
    }
    setSaving(card.key);
    setError("");
    setStatus("");
    const supabase = await getSupabase();
    if (!supabase) return setSaving("");

    const payload = {
      ...eventRowFromForm({
        title_en: card.title_en,
        title_kn: card.title_kn,
        starts_at: card.starts_at || null,
        time_text: card.time_text,
        guest_en: card.guest_en,
        guest_kn: card.guest_kn,
      }),
      // The public page only ever reads published rows: saving an event is
      // publishing it.
      published: true,
    };
    const { error: err } = card.id
      ? await supabase.from("events").update(payload).eq("id", card.id)
      : await supabase.from("events").insert(payload);

    setSaving("");
    if (err) return setError(err.message);
    setStatus(`“${card.title_en}” saved — the site now shows exactly this.`);
    /* Round 33: the database trigger has already queued this change for
       every subscribed device; this asks the edge function to deliver it
       now instead of at the next cron tick. Fire-and-forget on purpose. */
    supabase.functions.invoke("push-send").catch(() => {});
    fetchRows().then(({ data, error: err2 }) => {
      if (err2) return setError(err2.message);
      const list = data || [];
      setRows(list);
      // Re-point every card at its stored row (new cards get their id here)
      // without throwing away cards the owner is still typing.
      setCards((all) =>
        all.map((c) => {
          if (c.key !== card.key) return c;
          const mine = list
            .filter((r) => r.title_en === String(card.title_en).trim())
            .sort((a, b) =>
              (b.published === true) - (a.published === true) ||
              String(b.starts_at || "").localeCompare(String(a.starts_at || ""))
            )[0];
          return mine ? { ...c, id: mine.id } : c;
        })
      );
    });
  }

  if (!rows) return <AdminLoading label="Reading the programs…" />;

  return (
    <div className="admin-tiles">
      <p className="admin-muted">
        Add, rename, date and time any event — what you save is exactly what
        the public site shows: every published event on the Events page at its
        stored date and time, and under “Upcoming Programs” on the homepage
        while the date is still ahead. Names are free text in both languages;
        the time is shown beside the date wherever the date appears.
      </p>
      {error ? <AdminError>{error}</AdminError> : null}
      {status ? <p className="admin-muted">{status}</p> : null}

      {cards.map((card) => (
        <section
          className="admin-tile"
          key={card.key}
          aria-label={card.title_en || "New event"}
        >
          <h3>
            {card.title_en || "New event"}
            {card.title_kn ? <span className="admin-tile-kn">{card.title_kn}</span> : null}
          </h3>

          <label className="admin-field">
            Name (English)
            <input
              className="admin-input"
              type="text"
              value={card.title_en}
              placeholder="e.g. Omkar Dashamotsava"
              onChange={(e) => setCard(card.key, "title_en", e.target.value)}
            />
          </label>
          <label className="admin-field">
            Name (Kannada)
            <input
              className="admin-input"
              type="text"
              value={card.title_kn}
              placeholder="ಉದಾ. ಓಂಕಾರ ದಶಮಹೋತ್ಸವ"
              onChange={(e) => setCard(card.key, "title_kn", e.target.value)}
            />
          </label>
          <label className="admin-field">
            Date
            <input
              className="admin-input"
              type="date"
              value={card.starts_at}
              onChange={(e) => setCard(card.key, "starts_at", e.target.value)}
            />
          </label>
          <label className="admin-field">
            Time of day (shown beside the date)
            <input
              className="admin-input"
              type="text"
              value={card.time_text}
              placeholder="e.g. 6:30 PM / ಸಂಜೆ 6:30"
              onChange={(e) => setCard(card.key, "time_text", e.target.value)}
            />
          </label>
          <label className="admin-field">
            Guest (English)
            <input
              className="admin-input"
              type="text"
              value={card.guest_en}
              placeholder="e.g. Smt. Amrutha Naidu — leave empty for none"
              onChange={(e) => setCard(card.key, "guest_en", e.target.value)}
            />
          </label>
          <label className="admin-field">
            Guest (Kannada)
            <input
              className="admin-input"
              type="text"
              value={card.guest_kn}
              placeholder="ಉದಾ. ಶ್ರೀಮತಿ ಅಮೃತಾ ನಾಯ್ಡು"
              onChange={(e) => setCard(card.key, "guest_kn", e.target.value)}
            />
          </label>

          <button
            type="button"
            className="admin-btn"
            disabled={saving !== ""}
            onClick={() => save(card)}
          >
            {saving === card.key ? "Saving…" : "Save event"}
          </button>
        </section>
      ))}

      <section className="admin-tile" aria-label="Add an event">
        <h3>Add an event</h3>
        <p className="admin-muted">
          A new card appears below the saved ones; fill it and save — it joins
          the public list the moment it is stored.
        </p>
        <button type="button" className="admin-btn admin-btn--primary" onClick={addCard}>
          + Add event
        </button>
      </section>
    </div>
  );
}
