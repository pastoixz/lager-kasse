import { supabase } from "./supabase.js";

console.log("Shop.js geladen!"); // Test-Log

const productList = document.getElementById("product-list");
const cartItemsContainer = document.getElementById("cart-items");
const cartTotalEl = document.getElementById("cart-total");
const checkoutForm = document.getElementById("checkout-form");

let cart = {}; 
let products = []; 

function formatCHF(value) {
  return (Number(value) || 0).toFixed(2);
}

// DIE FUNKTION GLOBAL MACHEN
window.updateCart = function(id, change) {
  console.log("updateCart aufgerufen für ID:", id, "Typ:", typeof id);
  
  // Wir wandeln beides in Strings um, um sicherzugehen (Verhindert Number vs String Fehler)
  const prod = products.find(p => String(p.id) === String(id));
  
  if (!prod) {
    console.error("Produkt nicht gefunden! Vorhandene IDs:", products.map(p => p.id));
    return;
  }
  
  const current = cart[id] || 0;
  let next = current + change;
  const stock = Number(prod.stock) || 0;
  
  if (next < 0) next = 0;
  if (next > stock) {
    alert("Nö, so viel hab ich leider nimmer auf Lager!");
    next = stock;
  }
  
  if (next === 0) delete cart[id];
  else cart[id] = next;
  
  console.log("Neuer Warenkorb-Status:", cart);
  renderProducts();
  renderCart();
};

async function loadProducts() {
  console.log("Lade Produkte von Supabase...");
  
  const { data, error } = await supabase
    .from("drinks")
    .select("id, name, price, stock, public")
    .eq("public", true)
    .order("name");

  if (error) {
    console.error("Fehler beim Laden der Produkte:", error);
    productList.innerHTML = "<p>Fehler beim Laden. Schau in die Console!</p>";
    return;
  }
  
  products = data || [];
  console.log("Produkte erfolgreich geladen:", products);
  renderProducts();
}

function renderProducts() {
  if (!productList) return;
  if (products.length === 0) {
    productList.innerHTML = "<p>Keine Weine gefunden.</p>";
    return;
  }
  
  productList.innerHTML = products.map(p => {
    const qty = cart[p.id] || 0;
    const stock = Number(p.stock) || 0;
    const outOfStock = stock <= 0;
    
    return `
      <div class="product-item" style="${outOfStock ? 'opacity: 0.5' : ''}">
        <div>
          <div style="font-weight: bold;">${p.name}</div>
          <div class="small">CHF ${formatCHF(p.price)} • ${outOfStock ? 'ausverkauft' : `${stock} verfügbar`}</div>
        </div>
        <div class="product-actions">
          <button type="button" onclick="window.updateCart('${p.id}', -1)" ${qty === 0 ? 'disabled' : ''}>-</button>
          <span style="width: 30px; text-align: center; display: inline-block;">${qty}</span>
          <button type="button" onclick="window.updateCart('${p.id}', 1)" ${qty >= stock || outOfStock ? 'disabled' : ''}>+</button>
        </div>
      </div>
    `;
  }).join("");
}

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

    console.log("Sende Checkout an Supabase RPC...");
    const { error } = await supabase.rpc("checkout_order", { items });
    
    if (error) {
      console.error("RPC Fehler:", error);
      return alert("Fehler beim Reservieren: " + error.message);
    }

    console.log("Supabase Erfolg! Sende E-Mail...");
    checkoutForm.submit();
  });
}

loadProducts();
