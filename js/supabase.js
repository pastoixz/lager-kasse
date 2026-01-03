import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

export const supabase = createClient(
  "https://DEIN-PROJEKT.supabase.co",
  "DEIN_PUBLIC_ANON_KEY"
);
