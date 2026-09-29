import { useEffect, useState } from "react";
import { checkAdmin, getSupabase } from "./client.js";

/**
 * Tracks the Supabase auth session and whether that person is an allow-listed
 * admin. Returns a single `status` so the UI never has to guess:
 *
 *   loading        — still working it out
 *   unconfigured   — no Supabase URL/key yet (see config/README.md)
 *   signed-out     — show the sign-in screen
 *   not-admin      — signed in, but not on the allowlist
 *   ready          — signed in AND allow-listed; render the dashboard
 */
export default function useAdminSession() {
  const [state, setState] = useState({ status: "loading", session: null, reason: null });

  useEffect(() => {
    let alive = true;

    (async () => {
      const supabase = await getSupabase();
      if (!alive) return;

      if (!supabase) {
        setState({ status: "unconfigured", session: null, reason: null });
        return;
      }

      const apply = async (session) => {
        if (!alive) return;
        if (!session) {
          setState({ status: "signed-out", session: null, reason: null });
          return;
        }
        const { isAdmin, reason } = await checkAdmin(session);
        if (!alive) return;
        setState({
          status: isAdmin ? "ready" : "not-admin",
          session,
          reason: reason || null,
        });
      };

      const { data } = await supabase.auth.getSession();
      await apply(data?.session || null);

      // Fires on sign-in, sign-out, and token refresh.
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        apply(session);
      });

      return () => sub?.subscription?.unsubscribe?.();
    })();

    return () => {
      alive = false;
    };
  }, []);

  return state;
}
