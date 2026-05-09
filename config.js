const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});
let sbUser = null;
let sbProfile = null;
const RESEND_API_KEY = re_fp3YXoRR_CNtLHg3irU2V85Phj5gmZiuz;