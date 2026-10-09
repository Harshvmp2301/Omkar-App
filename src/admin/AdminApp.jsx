import { useState } from "react";
import { ArrowLeft, LogOut, Inbox, CalendarDays, Images, HandHeart, Bell } from "lucide-react";
import useAdminSession from "./useAdminSession.js";
import { adminMissing, getSupabase, signInWithGoogle, signOut } from "./client.js";
import SevaAdmin from "./views/SevaAdmin.jsx";
import MessagesAdmin from "./views/MessagesAdmin.jsx";
import EventsAdmin from "./views/EventsAdmin.jsx";
import PhotosAdmin from "./views/PhotosAdmin.jsx";
import PushAdmin from "./views/PushAdmin.jsx";

const TABS = [
  { id: "seva", label: "Seva signups", Icon: HandHeart },
  { id: "messages", label: "Messages", Icon: Inbox },
  { id: "events", label: "Events", Icon: CalendarDays },
  { id: "photos", label: "Photos", Icon: Images },
  { id: "push", label: "Push", Icon: Bell },
];

/** The addresses that may sign in, for a clearer "not allowed" message. */
const ALLOWED_HINT = String(import.meta.env.VITE_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

function Shell({ children }) {
  return (
    <div className="admin">
      <header className="admin-bar">
        <a className="admin-back" href="#/hub">
          <ArrowLeft size={15} aria-hidden="true" /> Back to site
        </a>
        <span className="admin-bar-title">Omkar Samithi · Admin</span>
        {children}
      </header>
    </div>
  );
}

function Notice({ title, children, tone = "info" }) {
  return (
    <div className={`admin-notice admin-notice--${tone}`}>
      <p className="admin-notice-title">{title}</p>
      <div className="admin-notice-body">{children}</div>
    </div>
  );
}

export default function AdminApp() {
  const { status, session, reason } = useAdminSession();
  const [tab, setTab] = useState("seva");
  const [busy, setBusy] = useState(false);

  if (status === "loading") {
    return (
      <Shell>
        <p className="admin-muted">Checking your sign-in…</p>
      </Shell>
    );
  }

  if (status === "unconfigured") {
    return (
      <Shell>
        <Notice title="The database isn't connected yet" tone="warn">
          <p>
            Add <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_ANON_KEY</code> to <code>config/.env.local</code>,
            then restart the dev server. The full walkthrough is in{" "}
            <code>supabase/README.md</code>.
          </p>
          {adminMissing.length > 0 && (
            <p className="admin-muted">Currently missing: {adminMissing.join(", ")}</p>
          )}
        </Notice>
      </Shell>
    );
  }

  if (status === "signed-out") {
    return (
      <Shell>
        <div className="admin-signin">
          <h1 className="admin-signin-title">Admin sign-in</h1>
          <p className="admin-muted">
            Sign in with the Google account that was added to the administrator
            list. There is no public sign-up — access is granted by the Samithi.
          </p>
          <button
            className="admin-btn admin-btn--primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const res = await signInWithGoogle();
              if (!res.ok) setBusy(false);
            }}
          >
            {busy ? "Opening Google…" : "Continue with Google"}
          </button>
        </div>
      </Shell>
    );
  }

  if (status === "not-admin") {
    return (
      <Shell>
        <Notice title="This account can't open the dashboard" tone="warn">
          <p>
            You signed in as <strong>{session?.user?.email}</strong>, but that
            address isn't on the administrator list.
          </p>
          {ALLOWED_HINT.length > 0 && (
            <p className="admin-muted">
              Expected: {ALLOWED_HINT.join(", ")}. To add someone, insert their
              address into the <code>admins</code> table (see{" "}
              <code>supabase/README.md</code>).
            </p>
          )}
          <p className="admin-muted">
            If you are meant to have access, check the <code>admins</code> table —
            in particular that the address matches exactly, in lower case.
            {reason === "not-listed" ? "" : ` (${reason})`}
          </p>
          <button
            className="admin-btn"
            onClick={async () => {
              setBusy(true);
              await signOut();
              setBusy(false);
            }}
          >
            Sign out
          </button>
        </Notice>
      </Shell>
    );
  }

  const Active = {
    seva: SevaAdmin,
    messages: MessagesAdmin,
    events: EventsAdmin,
    photos: PhotosAdmin,
    push: PushAdmin,
  }[tab];

  return (
    <Shell>
      <span className="admin-who">
        <span className="admin-email">{session?.user?.email}</span>
        <button
          className="admin-btn admin-btn--quiet"
          title="Sign out"
          onClick={() => signOut()}
        >
          <LogOut size={14} aria-hidden="true" /> Sign out
        </button>
      </span>

      <nav className="admin-tabs" aria-label="Admin sections">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`admin-tab ${tab === id ? "is-active" : ""}`}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
          >
            <Icon size={15} aria-hidden="true" /> {label}
          </button>
        ))}
      </nav>

      <main className="admin-main">
        <Active key={tab} getSupabase={getSupabase} />
      </main>
    </Shell>
  );
}
