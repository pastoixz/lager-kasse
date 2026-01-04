import { supabase } from "/js/supabase.js";

const produkteDiv = document.getElementById("produkte");
const cartDiv = document.getElementById("cart");
const totalSpan = document.getElementById("total");
const checkoutBtn = document.getElementById("checkout");
const clearBtn = document.getElementById("clearCart");
const historyDiv = document.getElementById("history");

let products = []; // aktuelle drinks aus DB
let cart = new Map(); // id -> {id,name,price,qty,stock}
let busy = false;

const palette = [
  "#fbbf24", "#60a5fa", "#34d399", "#f87171", "#a78bfa",
  "#fb7185", "#22c55e", "#38bdf8", "#f59e0b", "#c084fc"
];

function chf(n){ return (Number(n)||0).toFixed(2); }

function cartTotal(){
  let t = 0;
  for (const it of cart.values()) t += (it.price * it.qty);
  return t;
}

function renderProducts(){
  produkteDiv.innerHTML = "";

  products.forEach((p, idx) => {
    const price = Number(p.price) || 0;
    const stock = Number(p.stock) || 0;

    const btn = document.createElement("button");
    btn.className = "pbtn";
    btn.style.background = palette[idx % palette.length];
    btn.disabled = busy || stock <= 0;

    btn.innerHTML = `
      <div class="pname">${p.name}</div>
      <div class="pmeta">
        <span>CHF ${chf(price)}</span>
        <span>${stock > 0 ? `${stock} verfügbar` : "ausverkauft"}</span>
      </div>
    `;

    btn.onclick = () => addToCart(p.id);

    produkteDiv.appendChild(btn);
  });
}

function renderCart(){
  const items = Array.from(cart.values());

  if (items.length === 0){
    cartDiv.innerHTML = `<div class="small">Noch keine Produkte ausgewählt.</div>`;
    totalSpan.textContent = "0.00";
    return;
  }

  cartDiv.innerHTML = "";
  items.forEach(it => {
    const row = document.createElement("div");
    row.className = "cart-item";
    row.title = "Tippen um diese Position zu entfernen";

    row.innerHTML = `
      <div class="cart-left">
        <div class="cart-title">${it.name} × ${it.qty}</div>
        <div class="cart-sub">CHF ${chf(it.price)} • Subtotal CHF ${chf(it.price * it.qty)}</div>
      </div>
      <div class="cart-sub">${it.stock} an Lager</div>
    `;

    row.onclick = () => removeLine(it.id); // komplettes Produkt entfernen

    cartDiv.appendChild(row);
  });

  totalSpan.textContent = chf(cartTotal());
}

function renderHistory(orders){
  historyDiv.innerHTML = "";
  if (!orders || orders.length === 0){
    historyDiv.innerHTML = `<div class="small">Noch keine Bestellungen.</div>`;
    return;
  }

  orders.forEach(o => {
    const items = (o.items || []).map(it => `${it.name}×${it.qty}`).join(", ");
    const time = new Date(o.created_at).toLocaleString();

    const row = document.createElement("div");
    row.className = "order-row";

    row.innerHTML = `
      <div>
        <div class="order-items"><strong>#${o.id}</strong> • ${items}</div>
        <div class="order-meta">CHF ${chf(o.total)} • ${time}</div>
      </div>
      <div class="order-actions">
        <button class="btn danger" data-id="${o.id}">Löschen</button>
      </div>
    `;

    row.querySelector("button").onclick = () => deleteOrder(o.id);

    historyDiv.appendChild(row);
  });
}

function addToCart(id){
  const p = products.find(x => x.id === id);
  if (!p) return;

  const price = Number(p.price) || 0;
  const stock = Number(p.stock) || 0;

  const existing = cart.get(id);
  const newQty = (existing?.qty || 0) + 1;

  if (newQty > stock){
    alert("Nicht genug Bestand");
    return;
  }

  cart.set(id, {
    id,
    name: p.name,
    price,
    qty: newQty,
    stock
  });

  renderCart();
}

function removeLine(id){
  cart.delete(id);
  renderCart();
}

function clearCart(){
  cart.clear();
  renderCart();
}

async function loadProducts(){
  const { data, error } = await supabase
    .from("drinks")
    .select("id, name, price, stock")
    .order("name");

  if (error){
    console.error(error);
    produkteDiv.innerHTML = "<p>Fehler beim Laden</p>";
    return;
  }

  products = data || [];
  // Stock/Preis im Warenkorb updaten, falls sich was geändert hat
  for (const it of cart.values()){
    const p = products.find(x => x.id === it.id);
    if (p){
      it.stock = Number(p.stock) || 0;
      it.price = Number(p.price) || 0;
      if (it.qty > it.stock) it.qty = it.stock; // clamp
      if (it.qty <= 0) cart.delete(it.id);
    }
  }

  renderProducts();
  renderCart();
}

async function loadHistory(){
  const { data, error } = await supabase
    .from("orders")
    .select("id, created_at, total, items")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error){
    console.error(error);
    historyDiv.innerHTML = "<p>Fehler beim Laden</p>";
    return;
  }

  renderHistory(data);
}

async function checkout(){
  if (busy) return;
  const items = Array.from(cart.values()).map(it => ({
    id: it.id,
    name: it.name,
    price: it.price,
    qty: it.qty
  }));

  if (items.length === 0) return;

  if (!confirm("Bestellung abschliessen?")) return;

  busy = true;
  checkoutBtn.disabled = true;

  const { data, error } = await supabase.rpc("checkout_order", { items });

  if (error){
    console.error(error);
    alert("Checkout fehlgeschlagen: " + (error.message || "Unbekannt"));
  } else {
    clearCart();
    await loadProducts();
    await loadHistory();
  }

  busy = false;
  checkoutBtn.disabled = false;
}

async function deleteOrder(orderId){
  if (busy) return;

  const ok = confirm(`Bestellung #${orderId} wirklich löschen?\nBestand wird wieder zurückgebucht.`);
  if (!ok) return;

  busy = true;

  const { error } = await supabase.rpc("delete_order_and_restore", { order_id: orderId });

  if (error){
    console.error(error);
    alert("Löschen fehlgeschlagen: " + (error.message || "Unbekannt"));
  } else {
    await loadProducts();
    await loadHistory();
  }

  busy = false;
}

checkoutBtn.onclick = checkout;
clearBtn.onclick = () => {
  if (cart.size === 0) return;
  if (confirm("Warenkorb wirklich leeren?")) clearCart();
};

// Initial
await loadProducts();
await loadHistory();

// Live: ohne flackern -> wir laden hier einfach neu (kann man später patchen)
supabase
  .channel("drinks-live-kasse-ui")
  .on("postgres_changes", { event: "*", schema: "public", table: "drinks" }, () => loadProducts())
  .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadHistory())
  .subscribe();
