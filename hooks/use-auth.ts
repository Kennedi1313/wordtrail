"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
export function useAuth() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [ready, setReady] = useState(!supabase);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(
        data.session?.user
          ? { id: data.session.user.id, email: data.session.user.email }
          : null,
      );
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setUser(
        session?.user
          ? { id: session.user.id, email: session.user.email }
          : null,
      ),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  async function signIn() {
    if (supabase)
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
  }
  async function signOut() {
    if (supabase) await supabase.auth.signOut();
  }
  return { user, ready, signIn, signOut, configured: Boolean(supabase) };
}
