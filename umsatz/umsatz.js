import { supabase } from "./supabase.js";

const elDatum = document.getElementById("datum");
const elUmsatz = document.getElementById("umsatz");
const elAnzahl = document.getElementById("anzahl");
const msg = document.getElementById("msg");
const refreshBtn = document.getElementById("refresh");

function chf(n){ return (Number(n)||0).toFixed(2); }

function todayRangeISO(){
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString(), label: start.toLocaleDateString() };
}

async function loadToday() {
  msg.textContent = "Lade…";

  const { start, end, label } = todayRangeISO();
  elDatum.textContent = label;

  const { data, error } = await supabase
    .from("orders")
    .select("total, created_at")
    .gte("created_at", start)
    .lt("created_at", end);

  if (error) {
    console.error(error);
    msg.textContent = "Fehler beim Laden";
    return;
  }

  const total = (data || []).reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  elUmsatz.textContent = `CHF ${chf(total)}`;
  elAnzahl.textContent = String((data || []).length);

  msg.textContent = "Aktualisiert";
}

refreshBtn.addEventListener("click", loadToday);

loadToday();

