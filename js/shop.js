import { supabase } from "./supabase.js";

// DOM Elemente
const productList = document.getElementById("product-list");
const cartItemsContainer = document.getElementById("cart-items");
const cartTotalEl = document.getElementById("cart-total");
const checkoutForm = document.getElementById("checkout-form");

// Lokaler Status
let cart = {}; // Format: { "3": 2, "10": 1 } (ID als Key, Menge als Value)
let products = []; // Array mit Objekten aus der DB

// Hilfsfunktion für Währung
function formatCHF(value) {
  return (Number(value) || 0).toFixed(2);
}

/**
 * 1. GLOBALE FUNKTION: updateCart
 * Wird von den + / - Buttons im HTML aufgerufen.
 */
window.updateCart = function(id, change) {
  // WICHTIG: Vergleich als String, da IDs aus dem HTML immer Strings sind
  const prod = products.find(p => String(p.id) === String(id));
  
  if (!prod) {
    console.error("Produkt mit ID " + id + " nicht gefunden.");
    return;
  }
  
  const currentQty = cart[id] || 0;
  let nextQty = currentQty + change;
  const stock = Number(prod.stock) || 0;
  
  // Grenzwerte prüfen
  if (nextQty < 0) nextQty = 0;
  if (nextQty > stock) {
    alert("Hoppla, mehr als " + stock + " Flaschen hab ich leider nicht mehr.");
    nextQty = stock;
  }
  
  // Status aktualisieren
  if (nextQty === 0) {
    delete cart[id];
  } else {
    cart[id] = nextQty;
  }
  
  // UI neu zeichnen
  renderProducts();
  renderCart();
};

/**
 * 2. PRODUKTE LADEN
 */
async function loadProducts() {
  if (!productList) return;
  
  const { data, error } = await supabase
    .from("drinks")
    .select("id, name, price, stock, public")
    .eq("public", true)
    .order("name");

  if (error) {
    console.error("Fehler beim Laden:", error);
    productList.innerHTML = "<p>Fehler beim Laden der Weine.</p>";
    return;
  }
  
  products = data || [];
  renderProducts();
}

/**
 * 3. PRODUKTLISTE RENDERN
 */
function renderProducts() {
  if (!productList) return;
  
  if (products.length === 0) {
    productList.innerHTML = "<p>Aktuell leider kein Wein verfügbar.</p>";
    return;
  }
  
  productList.innerHTML = products.map(p => {
    const qty = cart[p.id] || 0;
    const stock = Number(p.stock) || 0;
    const isOutOfStock = stock <= 0;
    
    return `
      <div class="product-item" style="${isOutOfStock ? 'opacity: 0.5' : ''}">
        <div>
          <div style="font-weight: bold;">${p.name}</div>
          <div class="small">CHF ${formatCHF(p.price)} • ${isOutOfStock ? 'ausverkauft' : `${stock} verfügbar`}</div>
        </div>
        <div class="product-actions">
          <button type="button" onclick="window.updateCart('${p.id}', -1)" ${qty === 0 ? 'disabled' : ''}>-</button>
          <span style="width: 30px; text-align: center; display: inline-block;">${qty}</span>
          <button type="button" onclick="window.updateCart('${p.id}', 1)" ${qty >= stock || isOutOfStock ? 'disabled' : ''}>+</button>
        </div>
      </div>
    `;
  }).join("");
}

/**
 * 4. WARENKORB RENDERN
 */
function renderCart() {
  let total = 0;
  let itemsHTML = "";
  let summaryTextForEmail = "";

  // Wir loopen durch das cart-Objekt
  Object.entries(cart).forEach(([id, qty]) => {
    // AUCH HIER: String-Vergleich für die ID
    const p = products.find(x => String(x.id) === String(id));
    
    if (p) {
      const lineTotal = qty * Number(p.price);
      total += lineTotal;
      
      itemsHTML += `
        <li style="margin-bottom: 8px; list-style: none;">
          ${qty}x ${p.name} 
          <span style="float:right;">CHF ${formatCHF(lineTotal)}</span>
        </li>`;
      
      summaryTextForEmail += `${qty}x ${p.name} (CHF ${formatCHF(lineTotal)})\n`;
    }
  });

  // Sidebar updaten
  if (cartItemsContainer) {
    cartItemsContainer.innerHTML = itemsHTML || "<li class='small' style='list-style: none;'>Noch leer.</li>";
  }
  
  if (cartTotalEl) {
    cartTotalEl.textContent = formatCHF(total);
  }
  
  // Versteckte Felder für Formspree befüllen
  const summaryInput = document.getElementById("cart-summary-input");
  const totalInput = document.getElementById("cart-total-input");
  
  if (summaryInput) summaryInput.value = summaryTextForEmail;
  if (totalInput) totalInput.value = formatCHF(total);
}

/**
 * 5. CHECKOUT LOGIK (Silent Submission & Auto-Clear)
 */
if (checkoutForm) {
  checkoutForm.addEventListener("submit", async (e) => {
    e.preventDefault(); // Wir verhindern, dass die Seite wegspringt
    
    if (Object.keys(cart).length === 0) {
      alert("Dein Warenkorb ist noch leer!");
      return;
    }

    // Button deaktivieren, damit niemand doppelt klickt
    const submitBtn = checkoutForm.querySelector('.submit-btn');
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Sende Anfrage...";

    // Items für Supabase vorbereiten
    const itemsForDB = Object.entries(cart).map(([id, qty]) => {
      const p = products.find(x => String(x.id) === String(id));
      return { 
        id: id, 
        qty: qty, 
        name: p ? p.name : "Unbekannt", 
        price: p ? Number(p.price) : 0 
      };
    });

    try {
      // 1. In Datenbank reservieren (Bestand abziehen)
      const { error: rpcError } = await supabase.rpc("checkout_order", { items: itemsForDB });
      if (rpcError) throw rpcError;

      // 2. Formular "lautlos" an Formspree senden
      const formData = new FormData(checkoutForm);
      const response = await fetch(checkoutForm.action, {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        // ERFOLG!
        // 3. Warenkorb leeren
        cart = {};
        
        // 4. UI aktualisieren
        renderProducts();
        renderCart();
        checkoutForm.reset();
        
        // 5. Erfolgsmeldung zeigen
        alert("Merci! I meld mi bald bi dir! :)");
        
        // Optional: Den User zurück zur Buy-Seite schicken
        // window.location.href = "/buy.html";
        
      } else {
        throw new Error("Formspree Fehler");
      }

    } catch (err) {
      console.error("Checkout Fehler:", err);
      alert("Da ist was schiefgelaufen: " + err.message);
    } finally {
      // Button wieder normal machen
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  });
}

// Skript starten
loadProducts();
