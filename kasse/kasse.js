import { supabase } from "./supabase.js";


// Farben pro Produkt (einfach rotierend)
const colors = ["#fbbf24","#60a5fa","#34d399","#f87171","#a78bfa","#fb7185","#22c55e","#38bdf8","#f59e0b","#c084fc"];

let products = []; // kommt aus Supabase
let cart = [];     // Array von Produktobjekten (wie in deinem Dummy)
let orders = [];   // kommt aus Supabase

// -----------------------------
// Produkte laden (Supabase)
// -----------------------------
async function loadProducts() {
  const container = document.getElementById("products");
  container.innerHTML = "Lade Produkte...";

  const { data, error } = await supabase
    .from("drinks")
    .select("id, name, price, stock, public")
    .eq("public", true)
    .order("name");

  if (error) {
    console.error(error);
    container.innerHTML = "Fehler beim Laden der Produkte";
    return;
  }

  products = data || [];
  renderProducts();
}

// -----------------------------
// Produkte anzeigen (Buttons)
// -----------------------------
function renderProducts() {
  const container = document.getElementById("products");
  container.innerHTML = "";

  if (products.length === 0) {
    container.innerHTML = "<div class='small'>Keine Produkte vorhanden.</div>";
    return;
  }

  products.forEach((item, idx) => {
    const btn = document.createElement("button");
    btn.className = "product-btn";
    btn.style.backgroundColor = colors[idx % colors.length];

    const stock = Number(item.stock) || 0;
    const price = Number(item.price) || 0;

    btn.disabled = stock <= 0;

    btn.innerHTML = `
      <div>${item.name}</div>
      <div class="product-meta">
        CHF ${price.toFixed(2)} • ${stock > 0 ? `${stock} verfügbar` : "ausverkauft"}
      </div>
    `;

    btn.onclick = () => addToCart(item.id);
    container.appendChild(btn);
  });
}

// -----------------------------
// In Warenkorb legen
// -----------------------------
function addToCart(productId) {
  const prod = products.find(p => p.id === productId);
  if (!prod) return;

  // Optional: Stock-Limit schon im UI verhindern (1 Klick = 1 Stück)
  const alreadyInCart = cart.filter(i => i.id === productId).length;
  if (alreadyInCart + 1 > (Number(prod.stock) || 0)) {
    alert("Nicht genug Bestand");
    return;
  }

  cart.push({ ...prod });
  updateCart();
}

// -----------------------------
// Warenkorb aktualisieren
// -----------------------------
function updateCart() {
  const ul = document.getElementById("cart");
  ul.innerHTML = "";

  let total = 0;

  cart.forEach((item, idx) => {
    const li = document.createElement("li");

    const price = Number(item.price) || 0;
    li.textContent = `${item.name} - ${price.toFixed(2)} CHF`;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "✖";
    removeBtn.className = "remove-btn";
    removeBtn.onclick = () => {
      cart.splice(idx, 1);
      updateCart();
    };

    li.appendChild(removeBtn);
    ul.appendChild(li);

    total += price;
  });

  document.getElementById("total").textContent = `Gesamt: ${total.toFixed(2)} CHF`;
}

// -----------------------------
// Bestellung abschliessen (Supabase RPC)
// -----------------------------
async function checkout() {
  if (cart.length === 0) {
    alert("Warenkorb ist leer!");
    return;
  }

  // items für RPC (pro Produkt Menge zählen)
  const grouped = new Map(); // id -> qty
  cart.forEach(it => grouped.set(it.id, (grouped.get(it.id) || 0) + 1));

  const items = Array.from(grouped.entries()).map(([id, qty]) => {
    const p = products.find(x => x.id === id);
    return {
      id,
      qty,
      name: p?.name ?? "",
      price: Number(p?.price) || 0
    };
  });

  const ok = confirm("Bestellung wirklich abschliessen?");
  if (!ok) return;

  // Atomar: stock reduzieren + order speichern
  const { data, error } = await supabase.rpc("checkout_order", { items });

  if (error) {
    console.error(error);
    alert("Checkout fehlgeschlagen: " + (error.message || "Unbekannt"));
    return;
  }

  cart = [];
  updateCart();

  await loadProducts();
  await loadOrders();
}

// -----------------------------
// Bestellungen laden (Supabase)
// -----------------------------
async function loadOrders() {
  const ul = document.getElementById("orders");
  ul.innerHTML = "Lade Bestellungen...";

  const { data, error } = await supabase
    .from("orders")
    .select("id, created_at, total, items")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error(error);
    ul.innerHTML = "Fehler beim Laden der Bestellungen";
    return;
  }

  orders = data || [];
  updateOrders();
}

// -----------------------------
// Bestellübersicht rendern (+ löschen mit confirm)
// -----------------------------
function updateOrders() {
  const ul = document.getElementById("orders");
  ul.innerHTML = "";

  let totalSum = 0;

  orders.forEach((order) => {
    const li = document.createElement("li");

    const itemsText = (order.items || [])
      .map(it => `${it.name}×${it.qty}`)
      .join(", ");

    const orderSum = Number(order.total) || 0;
    totalSum += orderSum;

    const time = new Date(order.created_at).toLocaleString();

    const left = document.createElement("div");
    left.innerHTML = `
      <div>${itemsText} - ${orderSum.toFixed(2)} CHF</div>
      <div class="small">${time} • #${order.id}</div>
    `;

    const delBtn = document.createElement("button");
    delBtn.textContent = "✖";
    delBtn.className = "remove-btn";
    delBtn.onclick = async () => {
      const confirmDelete = confirm("Willst du diese Bestellung wirklich löschen?\nBestand wird zurückgebucht.");
      if (!confirmDelete) return;

      const { error } = await supabase.rpc("delete_order_and_restore", { order_id: order.id });
      if (error) {
        console.error(error);
        alert("Löschen fehlgeschlagen: " + (error.message || "Unbekannt"));
        return;
      }

      await loadProducts();
      await loadOrders();
    };

    li.textContent = ""; // damit wir left + button sauber reinsetzen
    li.appendChild(left);
    li.appendChild(delBtn);
    ul.appendChild(li);
  });

  // Gesamtsumme unten
  const totalLi = document.createElement("li");
  totalLi.style.fontWeight = "bold";
  totalLi.textContent = `Gesamtsumme aller Bestellungen: ${totalSum.toFixed(2)} CHF`;
  ul.appendChild(totalLi);
}

// -----------------------------
// Event Listener
// -----------------------------
document.getElementById("checkout").addEventListener("click", checkout);

// -----------------------------
// Start
// -----------------------------
await loadProducts();
await loadOrders();

// Live updates (optional)
supabase
  .channel("pos-live")
  .on("postgres_changes", { event: "*", schema: "public", table: "drinks" }, () => loadProducts())
  .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadOrders())
  .subscribe();
