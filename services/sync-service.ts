import { AppState, UserSettings } from "@/types/domain";
import { supabase } from "@/lib/supabase/client";
const TABLE = "wordtrail_user_data";
export async function loadCloudData(userId: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.data as { state: AppState; settings: UserSettings } | null;
}
export async function saveCloudData(
  userId: string,
  state: AppState,
  settings: UserSettings,
) {
  if (!supabase) return;
  const { error } = await supabase.from(TABLE).upsert({
    user_id: userId,
    data: { state, settings },
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
