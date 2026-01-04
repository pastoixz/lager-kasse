import { supabase } from "./supabase.js";

const produkteDiv = document.getElementById("produkte");
const totalSpan = document.getElementById("total");
const undoBtn = document.getElementById("undo");

let total = 0;
let letzterVerkauf = null;
let busy = false; // verhindert Doppelklick-Probleme

async function ladeProdukte() {
  const { data, error } = await supabase
    .from("drinks")
    .select("id, name, price, stock")
    .order("name");

  if (error) {
    console.error(error);
    produkteDiv.innerHTML = "<p>Fehler beim Laden</p>";
    return;
  }

  produkteDiv.innerHTML = "";

  data.forEach(p => {
    const preis = Number(p.price) || 0;
    const bestand = Number(p.stock) || 0;

    const btn = document.createElement("button");
    btn.textContent = `${p.name} – CHF ${preis.toFixed(2)} (${bestand})`;
    btn.disabled = bestand <= 0 || busy;

    btn.onclick = () => verkaufen(p.id, preis, bestand);

    produkteDiv.appendChild(btn);
  });
}

async function verkaufen(id, preis, bestand) {
  if (busy) return;
  if (bestand <= 0) return alert("Nicht mehr an Lager");

  busy = true;

  // UI sofort aktualisieren
  total += preis;
  totalSpan.textContent = total.toFixed(2);

  // Für Undo merken wir den Zustand VOR dem Verkauf
  letzterVerkauf = { id, preis, bestandVorher: bestand };

  // Bestand reduzieren
  const { error } = await supabase
    .from("drinks")
    .update({ stock: bestand - 1 })
    .eq("id", id);

  if (error) {
    console.error(error);
    // rollback UI
    total -= preis;
    totalSpan.textContent = total.toFixed(2);
    letzterVerkauf = null;
    alert("Fehler beim Verkauf");
  }

  busy = false;

  // Lade Produkte neu (oder warte auf Realtime — beides ok)
  ladeProdukte();
}

undoBtn.onclick = async () => {
  if (busy) return;
  if (!letzterVerkauf) return;

  busy = true;

  // UI sofort zurück
  total -= letzterVerkauf.preis;
  totalSpan.textContent = total.toFixed(2);

  const { id, bestandVorher } = letzterVerkauf;

  // Bestand wieder auf den vorherigen Wert setzen
  const { error } = await supabase
    .from("drinks")
    .update({ stock: bestandVorher })
    .eq("id", id);

  if (error) {
    console.error(error);
    // rollback UI wieder vorwärts
    total += letzterVerkauf.preis;
    totalSpan.textContent = total.toFixed(2);
    alert("Undo fehlgeschlagen");
  }

  letzterVerkauf = null;
  busy = false;
  ladeProdukte();
};

// Initial laden
ladeProdukte();

// ✅ LIVE-UPDATES: wenn irgendwo drinks geändert wird → Buttons aktualisieren
supabase
  .channel("drinks-live-kasse")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "drinks" },
    () => {
      // nur neu laden, wenn wir gerade nicht mitten in einem Update sind
      if (!busy) ladeProdukte();
    }
  )
  .subscribe();
