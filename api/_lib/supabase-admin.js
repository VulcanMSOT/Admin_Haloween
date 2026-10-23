import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://ryotqaievumejewpdzmr.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

export async function createSignedScreenshotUrl(path) {
  if (!path) return null;
  const client = getSupabaseAdmin();
  if (!client) return null;
  try {
    const { data, error } = await client.storage
      .from('payment-screenshots')
      .createSignedUrl(path, 3600);
    if (error) {
      console.warn('Error signing screenshot URL:', error.message);
      return null;
    }
    return data?.signedUrl || null;
  } catch (err) {
    console.warn('Error creating signed screenshot URL:', err);
    return null;
  }
}
