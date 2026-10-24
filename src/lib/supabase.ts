import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined) ||
  "https://jwldccdrzmtbmybhgzau.supabase.co";

const supabaseKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  "sb_publishable_YsDS6-W2HefpTla3iB41sA_z1BN2N2v";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase =
  isSupabaseConfigured && supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;
