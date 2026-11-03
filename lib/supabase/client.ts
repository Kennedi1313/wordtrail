import { createClient, SupabaseClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
export const isSupabaseConfigured = Boolean(url && key);
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, key)
  : null;
