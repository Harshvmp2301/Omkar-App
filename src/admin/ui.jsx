import { RefreshCw } from "lucide-react";

/**
 * Small shared pieces for the dashboard views.
 *
 * Kept in their own file (rather than alongside AdminApp) so that both stay
 * fast-refresh friendly: a module that exports components only can be hot
 * reloaded without remounting the tree.
 */

export function AdminEmpty({ children }) {
  return <p className="admin-empty">{children}</p>;
}

export function AdminError({ children }) {
  return <p className="admin-error">{children}</p>;
}

export function AdminLoading({ label = "Loading…" }) {
  return (
    <p className="admin-muted admin-inline-loading">
      <RefreshCw size={14} aria-hidden="true" /> {label}
    </p>
  );
}
