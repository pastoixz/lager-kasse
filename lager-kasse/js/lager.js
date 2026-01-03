import { supabase } from "./supabase.js";

const lager = document.getElementById("lager");

async function ladeProdukte() {
  const { data, error } = await supabase
    .from("Drinks")
    .select("name, preis, bestand")
    .order("name");

  if (error) {
    lager.innerHTML = "<tr><td colspan='3'>Fehler</td></tr>";
    return;
  }

  lager.innerHTML = "";

  data.forEach(p => {
    lager.innerHTML += `
      <tr>
        <td>${p.name}</td>
        <td>CHF ${p.preis.toFixed(2)}</td>
        <td>${p.bestand}</td>
      </tr>
    `;
  });
}

ladeProdukte();
