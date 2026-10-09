import { useEffect, useMemo, useState } from "react";
import { dueReminders, nextSeen, readSeen, writeSeen } from "../utils/reminders.js";
import { fetchLatestPostsDetailed } from "../utils/blogger.js";
import { fetchLatestVideos } from "../utils/youtube.js";

/**
 * One quiet line under the header: the reminder that is due right now.
 *
 * A visitor with a tab open is told, in the tab, about the program that is
 * today / tomorrow / within the week, about a program whose date moved, and
 * about a new blog post or YouTube video. One notice at a time, highest
 * priority first; dismissing it reveals the next, and the dismissal sticks
 * in this browser. The installed PWA's real push arrives later on the same
 * triggers — this strip is what every visitor gets, no permission asked.
 *
 * role="status" so a screen reader announces the line when it appears, and
 * nothing here grabs focus or moves the layout under anyone's fingers.
 */
export default function ReminderStrip({ t, lang, programs }) {
  const [due, setDue] = useState([]);

  useEffect(() => {
    let alive = true;

    // The engine never reads a clock of its own; the caller hands it today.
    // In DEV only, ?remindDay=YYYY-MM-DD stands in for today so every window
    // can be looked at in a browser. The production build ships none of it.
    let todayISO = new Date().toISOString();
    if (import.meta.env.DEV) {
      const probe = new URLSearchParams(window.location.search).get("remindDay");
      if (probe && /^\d{4}-\d{2}-\d{2}$/.test(probe)) todayISO = probe;
    }

    (async () => {
      const [postsRes, videos] = await Promise.all([
        fetchLatestPostsDetailed(lang).catch(() => null),
        fetchLatestVideos(lang).catch(() => null),
      ]);
      if (!alive) return;
      const post = postsRes && Array.isArray(postsRes.posts) ? postsRes.posts[0] || null : null;
      const video = Array.isArray(videos) ? videos[0] || null : null;
      const seen = readSeen();
      setDue(dueReminders({ todayISO, programs, post, video, seen }));
      writeSeen(nextSeen({ programs, post, video, seen }));
    })();

    return () => {
      alive = false;
    };
  }, [lang, programs]);

  const top = due[0] || null;
  const text = useMemo(() => {
    if (!top) return "";
    const label = `${top.day || ""} ${top.mon || ""}`.trim();
    const fill = (s) =>
      String(s)
        .replaceAll("{name}", top.name || "")
        .replaceAll("{days}", String(top.days || ""))
        .replaceAll("{date}", label)
        .replaceAll("{title}", top.title || "");
    switch (top.kind) {
      case "today": return fill(t.remindToday);
      case "day": return fill(t.remindDay);
      case "week": return fill(t.remindWeek);
      case "moved": return fill(t.remindMoved);
      case "blog": return fill(t.remindBlog);
      case "video": return fill(t.remindVideo);
      default: return "";
    }
  }, [top, t]);

  if (!top || !text) return null;

  const dismiss = () => {
    const seen = readSeen() || {};
    const dismissed = seen.dismissed && typeof seen.dismissed === "object" ? seen.dismissed : {};
    dismissed[top.id] = 1;
    writeSeen({ ...nextSeen({ programs, post: null, video: null, seen }), dismissed });
    setDue((list) => list.filter((r) => r.id !== top.id));
  };

  return (
    <div className="remind-strip" role="status">
      <span className="remind-dot" aria-hidden="true" />
      <span className="remind-text">{text}</span>
      <button type="button" className="remind-x" onClick={dismiss} aria-label={t.remindDismiss}>
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
          <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </svg>
      </button>
    </div>
  );
}
