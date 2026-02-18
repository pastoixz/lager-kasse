import { supabase } from "./supabase.js";

const productList = document.getElementById("product-list");
const cartItemsContainer = document.getElementById("cart-items");
const cartTotalEl = document.getElementById("cart-total");
const checkoutForm = document.getElementById("checkout-form");

let cart = {}; 
let products = []; 

function formatCHF(value) {
  return (Number(value) || 0).toFixed(2);
}

async function loadProducts() {
  if (!productList) return;
  const { data, error } = await supabase
    .from("drinks")
    .select("id, name, price, stock, public")
    .eq("public", true) // Nur öffentliche Weine zeigen
    .order("name");

  if (error) {
    productList.innerHTML = "<p>Fehler beim Laden.</p>";
    return;
  }
  products = data || [];
  renderProducts();
}

function renderProducts() {
  if (products.length === 0) {
    productList.innerHTML = "<p>Aktuell leider alles ausgetrunken!</p>";
    return;
  }
  productList.innerHTML = products.map(p => {
    const qty = cart[p.id] || 0;
    const stock = Number(p.stock) || 0;
    return `
      <div class="product-item" style="${stock <= 0 ? 'opacity: 0.5' : ''}">
        <div>
          <div style="font-weight: bold;">${p.name}</div>
          <div class="small">CHF ${formatCHF(p.price)} • ${stock > 0 ? `${stock} verfügbar` : 'ausverkauft'}</div>
        </div>
        <div class="product-actions">
          <button type="button" onclick="updateCart('${p.id}', -1)" ${qty === 0 ? 'disabled' : ''}>-</button>
          <span style="width: 30px; text-align: center;">${qty}</span>
          <button type="button" onclick="updateCart('${p.id}', 1)" ${qty >= stock ? 'disabled' : ''}>+</button>
        </div>
      </div>
    `;
  }).join("");
}

window.updateCart = (id, change) => {
  const prod = products.find(p => p.id === id);
  if (!prod) return;
  const current = cart[id] || 0;
  let next = current + change;
  if (next < 0) next = 0;
  if (next > (Number(prod.stock) || 0)) next = Number(prod.stock);
  
  if (next === 0) delete cart[id];
  else cart[id] = next;
  
  renderProducts();
  renderCart();
};

function renderCart() {
  let total = 0;
  let itemsHTML = "";
  let summaryText = "";

  Object.entries(cart).forEach(([id, qty]) => {
    const p = products.find(x => x.id === id);
    if (p) {
      const sub = qty * Number(p.price);
      total += sub;
      itemsHTML += `<li style="margin-bottom: 8px;">${qty}x ${p.name} <span style="float:right;">${formatCHF(sub)}</span></li>`;
      summaryText += `${qty}x ${p.name} (CHF ${formatCHF(sub)})\n`;
    }
  });

  cartItemsContainer.innerHTML = itemsHTML || "<li class='small'>Noch leer.</li>";
  cartTotalEl.textContent = formatCHF(total);
  
  document.getElementById("cart-summary-input").value = summaryText;
  document.getElementById("cart-total-input").value = formatCHF(total);
}

if (checkoutForm) {
  checkoutForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (Object.keys(cart).length === 0) return alert("Warenkorb leer!");

    const items = Object.entries(cart).map(([id, qty]) => {
      const p = products.find(x => x.id === id);
      return { id, qty, name: p.name, price: Number(p.price) };
    });

    // 1. Bestand in Supabase reservieren (RPC wie in deiner Kasse)
    const { error } = await supabase.rpc("checkout_order", { items });
    if (error) return alert("Fehler: " + error.message);

    // 2. Formular absenden (Formspree Mail)
    checkoutForm.submit();
  });
}

loadProducts();
