import { supabase } from "./supabase.js";

const lager = document.getElementById("lager");

async function ladeProdukte() {
  lager.innerHTML = "<tr><td colspan='3'>Lade Daten...</td></tr>";

  const { data, error } = await supabase
    .from("drinks")
    .select("name, price, stock")
    .order("name");

  if (error) {
    console.error(error);
    lager.innerHTML = "<tr><td colspan='3'>Fehler beim Laden</td></tr>";
    return;
  }

  if (!data || data.length === 0) {
    lager.innerHTML = "<tr><td colspan='3'>Keine Produkte vorhanden</td></tr>";
    return;
  }

  lager.innerHTML = "";

  data.forEach(p => {
    const preis = Number(p.price) || 0;
    const bestand = Number(p.stock) || 0;

    lager.innerHTML += `
      <tr>
        <td>${p.name}</td>
        <td>CHF ${preis.toFixed(2)}</td>
        <td>${bestand}</td>
      </tr>
    `;
  });
}

ladeProdukte();
