import { db } from "./firebase-config.js";
import {
  addDoc, collection, doc, updateDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { chf, parseChf, esc } from "./geld.js";
import { toast } from "./ui.js";

// Kassen verwalten (nur Admin)
// Kassen werden nie gelöscht, nur deaktiviert – damit der Verlauf vollständig bleibt.
export function initKassen() {
  let kassen = [];
  let bearbeiteId = null;

  const nameEl = document.getElementById("kasse-name");
  const stockEl = document.getElementById("kasse-stock");
  const errorEl = document.getElementById("kasse-error");
  const saveBtn = document.getElementById("kasse-speichern");
  const cancelBtn = document.getElementById("kasse-abbrechen");
  const titleEl = document.getElementById("kasse-form-title");
  const listEl = document.getElementById("kassen-list");

  function formularLeeren() {
    bearbeiteId = null;
    nameEl.value = "";
    stockEl.value = "";
    errorEl.textContent = "";
    titleEl.textContent = "Neue Kasse";
    saveBtn.textContent = "Kasse anlegen";
    cancelBtn.style.display = "none";
  }

  saveBtn.addEventListener("click", async () => {
    errorEl.textContent = "";
    const name = nameEl.value.trim();
    const stock = parseChf(stockEl.value);
    if (!name) { errorEl.textContent = "Bitte einen Namen eingeben."; return; }
    if (stock === null) { errorEl.textContent = "Bitte einen gültigen Stock eingeben, z.B. 300 oder 300.50."; return; }
    if (kassen.some((k) => k.name.toLowerCase() === name.toLowerCase() && k.id !== bearbeiteId)) {
      errorEl.textContent = "Es gibt bereits eine Kasse mit diesem Namen."; return;
    }
    saveBtn.disabled = true;
    try {
      if (bearbeiteId) {
        await updateDoc(doc(db, "kassen", bearbeiteId), { name, stock, updatedAt: serverTimestamp() });
        toast("Kasse gespeichert");
      } else {
        await addDoc(collection(db, "kassen"), { name, stock, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        toast("Kasse angelegt");
      }
      formularLeeren();
    } catch (err) {
      console.error(err);
      errorEl.textContent = "Speichern fehlgeschlagen.";
    } finally {
      saveBtn.disabled = false;
    }
  });
  cancelBtn.addEventListener("click", formularLeeren);

  function render() {
    if (!kassen.length) { listEl.innerHTML = '<p class="hint-text">Noch keine Kassen angelegt.</p>'; return; }
    listEl.innerHTML = kassen
      .map((k) => `
        <div class="list-item ${k.active === false ? "is-inactive" : ""}">
          <div class="li-main">
            <strong>${esc(k.name)}</strong>
            <span class="li-sub">Stock <span class="mono">${chf(k.stock)}</span>${k.active === false ? " · inaktiv" : ""}</span>
          </div>
          <div class="li-actions">
            <button class="icon-btn" data-edit="${k.id}" title="Bearbeiten"><i data-icon="pencil" data-size="15"></i></button>
            <button class="btn btn-secondary btn-small" data-toggle="${k.id}">${k.active === false ? "Aktivieren" : "Deaktivieren"}</button>
          </div>
        </div>`)
      .join("");
    listEl.querySelectorAll("[data-edit]").forEach((b) =>
      b.addEventListener("click", () => {
        const k = kassen.find((x) => x.id === b.dataset.edit);
        bearbeiteId = k.id;
        nameEl.value = k.name;
        stockEl.value = (k.stock / 100).toFixed(2);
        titleEl.textContent = "Kasse bearbeiten";
        saveBtn.textContent = "Speichern";
        cancelBtn.style.display = "inline-flex";
        errorEl.textContent = "";
        window.scrollTo({ top: 0, behavior: "smooth" });
      })
    );
    listEl.querySelectorAll("[data-toggle]").forEach((b) =>
      b.addEventListener("click", async () => {
        const k = kassen.find((x) => x.id === b.dataset.toggle);
        const neu = k.active === false;
        if (!neu && !confirm(`Kasse «${k.name}» deaktivieren? Sie erscheint dann nicht mehr beim Zählen. Der Verlauf bleibt erhalten.`)) return;
        try {
          await updateDoc(doc(db, "kassen", k.id), { active: neu, updatedAt: serverTimestamp() });
        } catch (err) {
          console.error(err);
          toast("Ändern fehlgeschlagen");
        }
      })
    );
  }

  return {
    setKassen(list) {
      kassen = list;
      render();
    },
  };
}
