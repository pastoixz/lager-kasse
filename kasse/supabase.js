import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

export const supabase = createClient(
  "https://wjbouuvytdiuuqbuhkxz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqYm91dXZ5dGRpdXVxYnVoa3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NTQ5MjMsImV4cCI6MjA4MzAzMDkyM30.GS_sABv64Gj0To0djUANiBhz3H8Fj_pjKCkPEjcmJbc"
);
