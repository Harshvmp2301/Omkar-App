import { useCallback, useEffect, useState } from "react";
import { AdminEmpty, AdminError, AdminLoading } from "../ui.jsx";
import { formatWhen } from "../format.js";

const STATUSES = ["new", "contacted", "confirmed", "declined"];

export default function SevaAdmin({ getSupabase }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  // A pure read: it returns the result and sets no state, so it works both
  // from the effect below and as an imperative refresh after an edit.
  const fetchRows = useCallback(
    () =>
      getSupabase().then((supabase) =>
        supabase
          ? supabase
              .from("seva_signups")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(500)
          : { data: [], error: null }
      ),
    [getSupabase]
  );

  // Fetch on mount. The .then() keeps setState out of the effect body, which
  // otherwise triggers the cascading-render warning React 19 calls out.
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

  async function setStatus(id, status) {
    const supabase = await getSupabase();
    if (!supabase) return;
    // Optimistic: the row is already on screen, so show the change at once
    // and put it back if the database refuses.
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    const { error: err } = await supabase
      .from("seva_signups")
      .update({ status })
      .eq("id", id);
    if (err) {
      setError(err.message);
      reload();
    }
  }

  if (error) return <AdminError>Could not load seva signups: {error}</AdminError>;
  if (!rows) return <AdminLoading />;

  const shown =
    filter === "all" ? rows : rows.filter((r) => (r.status || "new") === filter);
  const counts = STATUSES.map((s) => ({
    s,
    n: rows.filter((r) => (r.status || "new") === s).length,
  }));

  return (
    <>
      <div className="admin-filters">
        <button
          className={`admin-chip ${filter === "all" ? "is-active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All <span className="admin-chip-n">{rows.length}</span>
        </button>
        {counts.map(({ s, n }) => (
          <button
            key={s}
            className={`admin-chip ${filter === s ? "is-active" : ""}`}
            onClick={() => setFilter(s)}
          >
            {s} <span className="admin-chip-n">{n}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <AdminEmpty>
          {rows.length === 0
            ? "No seva signups yet. They'll appear here as soon as someone registers."
            : `No signups with status "${filter}".`}
        </AdminEmpty>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Received</th>
                <th>Name</th>
                <th>Contact</th>
                <th>Seva</th>
                <th>Details</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td className="admin-nowrap admin-muted">{formatWhen(r.created_at)}</td>
                  <td className="admin-strong">{r.name}</td>
                  <td>{r.contact || "—"}</td>
                  <td>
                    {r.seva || "—"}
                    {r.seva_detail ? (
                      <span className="admin-muted"> · {r.seva_detail}</span>
                    ) : null}
                  </td>
                  <td className="admin-wrap">{r.details || "—"}</td>
                  <td>
                    <select
                      className="admin-select"
                      value={r.status || "new"}
                      aria-label={`Status for ${r.name}`}
                      onChange={(e) => setStatus(r.id, e.target.value)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
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
