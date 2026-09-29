import { useCallback, useEffect, useState } from "react";
import { Mail, MailOpen } from "lucide-react";
import { AdminEmpty, AdminError, AdminLoading } from "../ui.jsx";
import { formatWhen } from "../format.js";

export default function MessagesAdmin({ getSupabase }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const fetchRows = useCallback(
    () =>
      getSupabase().then((supabase) =>
        supabase
          ? supabase
              .from("messages")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(500)
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

  async function patch(id, fields) {
    const supabase = await getSupabase();
    if (!supabase) return;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...fields } : r)));
    const { error: err } = await supabase.from("messages").update(fields).eq("id", id);
    if (err) {
      setError(err.message);
      reload();
    }
  }

  async function toggleRead(row) {
    const isNew = (row.status || "new") === "new";
    await patch(row.id, {
      status: isNew ? "read" : "new",
      read_at: isNew ? new Date().toISOString() : null,
    });
  }

  if (error) return <AdminError>Could not load messages: {error}</AdminError>;
  if (!rows) return <AdminLoading />;

  const unread = rows.filter((r) => (r.status || "new") === "new").length;
  const shown =
    filter === "all"
      ? rows
      : filter === "unread"
      ? rows.filter((r) => (r.status || "new") === "new")
      : rows.filter((r) => (r.status || "new") === filter);

  return (
    <>
      <div className="admin-filters">
        <button
          className={`admin-chip ${filter === "all" ? "is-active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All <span className="admin-chip-n">{rows.length}</span>
        </button>
        <button
          className={`admin-chip ${filter === "unread" ? "is-active" : ""}`}
          onClick={() => setFilter("unread")}
        >
          Unread <span className="admin-chip-n">{unread}</span>
        </button>
        <button
          className={`admin-chip ${filter === "replied" ? "is-active" : ""}`}
          onClick={() => setFilter("replied")}
        >
          Replied{" "}
          <span className="admin-chip-n">
            {rows.filter((r) => r.status === "replied").length}
          </span>
        </button>
      </div>

      {shown.length === 0 ? (
        <AdminEmpty>
          {rows.length === 0
            ? "No messages yet. Anything sent through the About page's contact form lands here."
            : `Nothing under "${filter}".`}
        </AdminEmpty>
      ) : (
        <ul className="admin-messages">
          {shown.map((m) => {
            const isNew = (m.status || "new") === "new";
            return (
              <li key={m.id} className={`admin-message ${isNew ? "is-new" : ""}`}>
                <div className="admin-message-head">
                  <span className="admin-strong">
                    {isNew && <span className="admin-dot" aria-label="unread" />}
                    {m.name}
                  </span>
                  {m.email && (
                    <a className="admin-link" href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject || "Your message to Omkar Samithi"}`)}`}>
                      {m.email}
                    </a>
                  )}
                  <span className="admin-muted admin-nowrap">{formatWhen(m.created_at)}</span>
                  <span className="admin-message-actions">
                    <button className="admin-btn admin-btn--quiet" onClick={() => toggleRead(m)}>
                      {isNew ? (
                        <>
                          <Mail size={14} aria-hidden="true" /> Mark read
                        </>
                      ) : (
                        <>
                          <MailOpen size={14} aria-hidden="true" /> Mark unread
                        </>
                      )}
                    </button>
                    {m.status !== "replied" && (
                      <button
                        className="admin-btn admin-btn--quiet"
                        onClick={() => patch(m.id, { status: "replied", replied_at: new Date().toISOString() })}
                      >
                        Mark replied
                      </button>
                    )}
                  </span>
                </div>
                {m.subject && <p className="admin-message-subject">{m.subject}</p>}
                <p className="admin-message-body">{m.message}</p>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
