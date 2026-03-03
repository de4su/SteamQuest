/**
 * supabaseClient.ts
 *
 * Initialises and exports the shared Supabase client used across all services
 * (quiz caching, favorites, Steam stats cache).  Credentials are read from Vite
 * environment variables so they are never hard-coded in source.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) ?? '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables are not set. Quiz caching and profile history will be unavailable.');
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');
