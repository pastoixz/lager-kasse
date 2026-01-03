import { supabase } from "./supabase.js";

const produkteDiv = document.getElementById("produkte");
const totalSpan = document.getElementById("total");
const undoBtn = document.getElementById("undo");

let total = 0;
let letzterVerkauf = null;

async function ladeProdukte() {
  const { data } = await supabase
    .from("Drinks")
    .select("*")
    .order("name");

  produkteDiv.innerHTML = "";

  data.forEach(p => {
    const btn = document.createElement("button");
    btn.textContent = `${p.name} – CHF ${p.preis}`;
    btn.onclick = () => verkaufen(p);
    produkteDiv.appendChild(btn);
  });
}

async function verkaufen(p) {
  if (p.bestand <= 0) return alert("Nicht mehr an Lager");

  total += p.preis;
  totalSpan.textContent = total.toFixed(2);

  letzterVerkauf = p;

  await supabase
    .from("Drinks")
    .update({ bestand: p.bestand - 1 })
    .eq("id", p.id);

  ladeProdukte();
}

undoBtn.onclick = async () => {
  if (!letzterVerkauf) return;

  total -= letzterVerkauf.preis;
  totalSpan.textContent = total.toFixed(2);

  await supabase
    .from("Drinks")
    .update({ bestand: letzterVerkauf.bestand + 1 })
    .eq("id", letzterVerkauf.id);

  letzterVerkauf = null;
  ladeProdukte();
};

ladeProdukte();
