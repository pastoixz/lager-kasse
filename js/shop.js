import { supabase } from "./supabase.js";

const productList = document.getElementById("product-list");
const cartItemsContainer = document.getElementById("cart-items");
const cartTotalEl = document.getElementById("cart-total");
const checkoutForm = document.getElementById("checkout-form");

let cart = {}; // Speichert die ausgewählten Weine (id -> Menge)
let products = []; // Speichert die Weine aus Supabase

// Hilfsfunktion für schöne Preise
function formatCHF(value) {
  return (Number(value) || 0).toFixed(2);
}

// -----------------------------
// 1. Produkte laden
// -----------------------------
async function loadProducts() {
  if (!productList) return; 
  productList.innerHTML = "<p>Lade Weine...</p>";
  
  // Lädt alle Getränke aus der Datenbank
  const { data, error } = await supabase
    .from("drinks")
    .select("id, name, price, stock, public")
    .order("name"); 

  if (error) {
    console.error("Supabase Fehler:", error);
    productList.innerHTML = "<p>Fehler beim Laden der Weine. Bitte lade die Seite neu.</p>";
    return;
  }

  // Filter: Zeigt nur Produkte an, die public sind (falls du das nutzt) oder alle
  // Wir filtern hier zur Sicherheit leere Einträge raus
  products = data.filter(p => p.name); 
  
  renderProducts();
}

// -----------------------------
// 2. Produkte im HTML anzeigen
// -----------------------------
function renderProducts() {
  if (products.length === 0) {
    productList.innerHTML = "<p>Aktuell leider alles ausgetrunken!</p>";
    return;
  }

  productList.innerHTML = products.map(p => {
    const qtyInCart = cart[p.id] || 0;
    const stockNum = Number(p.stock) || 0;
    const isOutOfStock = stockNum <= 0;

    return `
      <div class="product-item" style="${isOutOfStock ? 'opacity: 0.5;' : ''}">
        <div class="product-info">
          <h4 style="margin: 0 0 5px 0;">${p.name}</h4>
          <span class="small">CHF ${formatCHF(p.price)} | ${isOutOfStock ? 'Ausverkauft' : `Auf Lager: ${stockNum}`}</span>
        </div>
        <div class="product-actions">
          <button type="button" onclick="updateCart('${p.id}', -1)" ${qtyInCart === 0 ? 'disabled' : ''}>-</button>
          <span style="width: 24px; text-align: center;">${qtyInCart}</span>
          <button type="button" onclick="updateCart('${p.id}', 1)" ${isOutOfStock || qtyInCart >= stockNum ? 'disabled' : ''}>+</button>
        </div>
      </div>
    `;
  }).join("");
}

// -----------------------------
// 3. Warenkorb aktualisieren (Global, damit HTML Buttons es finden)
// -----------------------------
window.updateCart = function(id, change) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  const currentQty = cart[id] || 0;
  let newQty = currentQty + change;
  const maxStock = Number(product.stock) || 0;

  if (newQty < 0) newQty = 0;
  if (newQty > maxStock) newQty = maxStock;

  if (newQty === 0) {
    delete cart[id];
  } else {
    cart[id] = newQty;
  }

  renderProducts();
  renderCart();
};

// -----------------------------
// 4. Warenkorb rechts rendern
// -----------------------------
function renderCart() {
  let total = 0;
  let cartHTML = "";
  let emailSummary = ""; 

  for (const [id, qty] of Object.entries(cart)) {
    const product = products.find(p => p.id === id);
    if (product) {
      const lineTotal = qty * Number(product.price);
      total += lineTotal;
      
      cartHTML += `
        <li style="display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px dashed #ccc; padding-bottom: 4px;">
          <span>${qty}x ${product.name}</span>
          <span>CHF ${formatCHF(lineTotal)}</span>
        </li>
      `;
      // Das kommt später in die E-Mail
      emailSummary += `${qty}x ${product.name} (CHF ${formatCHF(lineTotal)})\n`;
    }
  }

  if (cartHTML === "") {
    cartItemsContainer.innerHTML = "<li class='small'>Noch leer.</li>";
  } else {
    cartItemsContainer.innerHTML = cartHTML;
  }

  cartTotalEl.textContent = formatCHF(total);

  // Versteckte Felder im Formular updaten
  const summaryInput = document.getElementById("cart-summary-input");
  const totalInput = document.getElementById("cart-total-input");
  
  if (summaryInput) summaryInput.value = emailSummary || "Warenkorb war leer";
  if (totalInput) totalInput.value = formatCHF(total);
}

// -----------------------------
// 5. Checkout (Supabase -> Formspree E-Mail)
// -----------------------------
if (checkoutForm) {
  checkoutForm.addEventListener("submit", async (e) => {
    // 1. Erstmal stoppen wir das Formular, damit wir mit Supabase reden können
    e.preventDefault(); 
    
    if (Object.keys(cart).length === 0) {
      alert("Wähl doch erst e paar feini Weine us! :)");
      return;
    }

    // 2. Daten genau so aufbereiten, wie deine Kassen-RPC es braucht
    const items = Object.entries(cart).map(([id, qty]) => {
      const p = products.find(x => x.id === id);
      return {
        id: id,
        qty: qty,
        name: p?.name ?? "",
        price: Number(p?.price) || 0
      };
    });

    // 3. Supabase RPC aufrufen (Bestand anpassen & Order anlegen)
    const { error } = await supabase.rpc("checkout_order", { items });

    if (error) {
      console.error("Supabase Checkout Error:", error);
      alert("Oops, da ist was schiefgelaufen bei der Reservierung. Bitte versuchs nochmal!");
      return;
    }

    // 4. Wenn Supabase erfolgreich war: Das Formular jetzt ECHT abfeuern (Formspree Mail senden)
    // Wir nutzen .submit() auf dem HTML-Element, das umgeht den Event-Listener
    HTMLFormElement.prototype.submit.call(checkoutForm); 
  });
}

// Startschuss: Produkte laden, wenn die Seite aufgeht
loadProducts();
