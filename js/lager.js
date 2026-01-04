import { supabase } from "./supabase.js";

const lager = document.getElementById("lager");

// Wir merken uns die aktuelle Liste im Speicher, damit wir nur Änderungen patchen
const state = new Map(); // key: id, value: {id,name,price,stock}
let initialLoaded = false;

function formatCHF(value) {
  const n = Number(value) || 0;
  return n.toFixed(2);
}

function renderRow(p) {
  const bestand = Number(p.stock) || 0;
  return `
    <tr data-id="${p.id}">
      <td>${p.name}</td>
      <td>CHF ${formatCHF(p.price)}</td>
      <td>${bestand}</td>
    </tr>
  `;
}

function upsertRow(p) {
  state.set(p.id, p);

  const existing = lager.querySelector(`tr[data-id="${p.id}"]`);
  if (existing) {
    // Nur die Zellen ersetzen -> kein Flackern
    const tds = existing.querySelectorAll("td");
    tds[0].textContent = p.name;
    tds[1].textContent = `CHF ${formatCHF(p.price)}`;
    tds[2].textContent = String(Number(p.stock) || 0);
  } else {
    // Neue Zeile einfügen (alphabetisch nach Name)
    const rows = Array.from(lager.querySelectorAll("tr"));
    const nameLower = (p.name || "").toLowerCase();

    let inserted = false;
    for (const r of rows) {
      const rid = r.getAttribute("data-id");
      const rp = rid ? state.get(rid) : null;
      const rNameLower = (rp?.name || "").toLowerCase();

      if (nameLower < rNameLower) {
        r.insertAdjacentHTML("beforebegin", renderRow(p));
        inserted = true;
        break;
      }
    }
    if (!inserted) lager.insertAdjacentHTML("beforeend", renderRow(p));
  }
}

function removeRow(id) {
  state.delete(id);
  const existing = lager.querySelector(`tr[data-id="${id}"]`);
  if (existing) existing.remove();
}

async function initialLoad() {
  lager.innerHTML = "<tr><td colspan='3'>Lade Daten...</td></tr>";

  const { data, error } = await supabase
    .from("drinks")
    .select("id, name, price, stock")
    .order("name");

  if (error) {
    console.error(error);
    lager.innerHTML = "<tr><td colspan='3'>Fehler beim Laden</td></tr>";
    return;
  }

  state.clear();

  if (!data || data.length === 0) {
    lager.innerHTML = "<tr><td colspan='3'>Keine Produkte vorhanden</td></tr>";
    initialLoaded = true;
    return;
  }

  // Einmalig komplett rendern (nur beim Start)
  lager.innerHTML = data.map(renderRow).join("");
  data.forEach(p => state.set(p.id, p));
  initialLoaded = true;
}

await initialLoad();

// ✅ LIVE: nur betroffene Zeile patchen (kein "neu laden")
supabase
  .channel("drinks-live-lager-patch")
  .on(
    "postgres_changes",
    { event: "UPDATE", schema: "public", table: "drinks" },
    (payload) => {
      if (!initialLoaded) return;
      // payload.new enthält die neue Zeile
      upsertRow(payload.new);
    }
  )
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "drinks" },
    (payload) => {
      if (!initialLoaded) return;
      upsertRow(payload.new);
    }
  )
  .on(
    "postgres_changes",
    { event: "DELETE", schema: "public", table: "drinks" },
    (payload) => {
      if (!initialLoaded) return;
      // payload.old enthält die gelöschte Zeile
      removeRow(payload.old.id);
    }
  )
  .subscribe();
