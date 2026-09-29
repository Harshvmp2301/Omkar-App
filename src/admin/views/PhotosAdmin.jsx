import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { AdminEmpty, AdminError, AdminLoading } from "../ui.jsx";
import { formatWhen } from "../format.js";

const BUCKET = "photos";

/** A short, collision-proof, URL-safe filename for the storage bucket. */
function storageName(file) {
  const ext = (file.name.match(/\.[a-z0-9]+$/i) || [".jpg"])[0].toLowerCase();
  const stamp = new Date().toISOString().slice(0, 10);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${stamp}/${Date.now().toString(36)}-${rand}${ext}`;
}

export default function PhotosAdmin({ getSupabase }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState({ caption_en: "", caption_kn: "", published: true });
  const fileRef = useRef(null);

  const fetchRows = useCallback(
    () =>
      getSupabase().then((supabase) =>
        supabase
          ? supabase
              .from("photos")
              .select("*")
              .order("sort_order", { ascending: true })
              .order("created_at", { ascending: false })
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

  /** The bucket is public, so a plain URL works for previews. */
  async function urlFor(path) {
    const supabase = await getSupabase();
    if (!supabase) return "";
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async function upload(files) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");
    setStatus("");

    const supabase = await getSupabase();
    if (!supabase) return setUploading(false);

    let done = 0;
    const failures = [];

    for (const file of files) {
      const path = storageName(file);
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "31536000", upsert: false });

      if (upErr) {
        failures.push(`${file.name}: ${upErr.message}`);
        continue;
      }

      // The row is what the website reads; the file alone would be orphaned.
      const { error: rowErr } = await supabase.from("photos").insert({
        storage_path: path,
        caption_en: draft.caption_en.trim() || null,
        caption_kn: draft.caption_kn.trim() || null,
        published: draft.published,
      });

      if (rowErr) {
        // Do not leave a file the database knows nothing about.
        await supabase.storage.from(BUCKET).remove([path]);
        failures.push(`${file.name}: ${rowErr.message}`);
        continue;
      }
      done += 1;
    }

    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    setStatus(done === 1 ? "1 photo added." : `${done} photos added.`);
    if (failures.length) setError(failures.join("\n"));
    reload();
  }

  async function setPublished(row, published) {
    const supabase = await getSupabase();
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, published } : r)));
    const { error: err } = await supabase
      .from("photos")
      .update({ published })
      .eq("id", row.id);
    if (err) {
      setError(err.message);
      reload();
    }
  }

  async function remove(row) {
    if (!window.confirm("Delete this photo? It will disappear from the website.")) return;
    const supabase = await getSupabase();
    // Row first: an orphaned file is recoverable, a row pointing at a
    // deleted file would show a broken image to visitors.
    const { error: rowErr } = await supabase.from("photos").delete().eq("id", row.id);
    if (rowErr) return setError(rowErr.message);
    const { error: fileErr } = await supabase.storage
      .from(BUCKET)
      .remove([row.storage_path]);
    if (fileErr) setError(`Photo removed, but the stored file could not be deleted: ${fileErr.message}`);
    reload();
  }

  return (
    <>
      <form
        className="admin-card admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          upload(fileRef.current?.files);
        }}
      >
        <p className="admin-card-title">Add photos</p>
        <p className="admin-muted">
          Choose one or many — all of them are uploaded with the captions below.
          JPEG, PNG and WebP work best. Files are kept exactly as uploaded, so
          export them at a sensible size first (around 1600px wide is plenty).
        </p>

        <div className="admin-grid-2">
          <label className="admin-field">
            <span>Caption — English (optional)</span>
            <input
              className="admin-input"
              value={draft.caption_en}
              onChange={(e) => setDraft({ ...draft, caption_en: e.target.value })}
              placeholder="Anjaneya Pooje 2026"
            />
          </label>
          <label className="admin-field">
            <span>Caption — Kannada (optional)</span>
            <input
              className="admin-input"
              value={draft.caption_kn}
              onChange={(e) => setDraft({ ...draft, caption_kn: e.target.value })}
              placeholder="ಆಂಜನೇಯ ಪೂಜೆ ೨೦೨೬"
            />
          </label>
        </div>

        <input
          ref={fileRef}
          className="admin-input admin-file"
          type="file"
          accept="image/*"
          multiple
        />

        <label className="admin-check">
          <input
            type="checkbox"
            checked={draft.published}
            onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
          />
          <span>Show on the website straight away</span>
        </label>

        <div className="admin-form-actions">
          <button className="admin-btn admin-btn--primary" disabled={uploading}>
            <Upload size={14} aria-hidden="true" />
            {uploading ? "Uploading…" : "Upload"}
          </button>
          {status && <span className="admin-ok">{status}</span>}
        </div>
      </form>

      {error && <AdminError>{error}</AdminError>}

      {!rows ? (
        <AdminLoading />
      ) : rows.length === 0 ? (
        <AdminEmpty>
          No photos stored yet. The website is showing the photos bundled with
          the app. Anything you upload here is added alongside them.
        </AdminEmpty>
      ) : (
        <div className="admin-photos">
          {rows.map((r) => (
            <PhotoCard
              key={r.id}
              row={r}
              urlFor={urlFor}
              onPublish={(v) => setPublished(r, v)}
              onDelete={() => remove(r)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function PhotoCard({ row, urlFor, onPublish, onDelete }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let alive = true;
    urlFor(row.storage_path).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [row.storage_path, urlFor]);

  return (
    <figure className={`admin-photo ${row.published ? "" : "is-hidden"}`}>
      {url ? (
        <img src={url} alt={row.alt_en || row.caption_en || ""} loading="lazy" />
      ) : (
        <div className="admin-photo-ph" aria-hidden="true" />
      )}
      <figcaption>
        <p className="admin-photo-caption">{row.caption_en || row.caption_kn || "—"}</p>
        <p className="admin-muted admin-photo-when">{formatWhen(row.created_at)}</p>
        <div className="admin-photo-actions">
          <label className="admin-check admin-check--tight">
            <input
              type="checkbox"
              checked={Boolean(row.published)}
              onChange={(e) => onPublish(e.target.checked)}
            />
            <span>On site</span>
          </label>
          <button
            className="admin-btn admin-btn--danger"
            onClick={onDelete}
            aria-label="Delete photo"
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      </figcaption>
    </figure>
  );
}
