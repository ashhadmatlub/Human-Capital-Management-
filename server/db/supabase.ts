import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://jwldccdrzmtbmybhgzau.supabase.co';

const key =
  process.env.SUPABASE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_YsDS6-W2HefpTla3iB41sA_z1BN2N2v';

export const isSupabaseConfigured = Boolean(url && key);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, key)
  : null;

// Test connectivity
export async function testSupabaseConnection(): Promise<{ connected: boolean; message: string }> {
  if (!supabase) {
    return { connected: false, message: 'Supabase credentials not configured' };
  }
  try {
    const { error } = await supabase.from('settings').select('id').limit(1);
    if (error) {
      if (error.code === 'PGRST205') {
        return {
          connected: true,
          message:
            'Supabase connected. Database schema tables need to be created via SQL Editor (use supabase/migrations/01_initial_schema.sql).',
        };
      }
      return { connected: false, message: error.message };
    }
    return { connected: true, message: 'Supabase fully connected with active schema.' };
  } catch (err: any) {
    return { connected: false, message: err.message };
  }
}
