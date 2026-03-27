import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;   // use service‑role key for writes
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

