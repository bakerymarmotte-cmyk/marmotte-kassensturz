import { db } from "./firebase-config.js";
import { addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { NOTEN, MUENZEN, ALLE, leereAnzahl, total, chf, chfDiff, esc } from "./geld.js";
import { toast, openModal, closeModal } from "./ui.js";

export function initZaehlen(session) {
  let kassen = [];
  let aktiveKasse = null;
  let anzahl = leereAnzahl();
  let speichert = false;

  const chips = document.getElementById("kasse-chips");
  const bereich = document.getElementById("zaehl-bereich");
  const keine = document.getElementById("keine-kassen");
  const errorEl = document.getElementById("zaehl-error");

  // Eingabezeilen für Noten und Münzen aufbauen
  function rowHtml(s) {
    return `
      <div class="zaehl-row" data-key="${s.key}">
        <span class="zaehl-label mono">${s.label}</span>
        <div class="stepper">
          <button type="button" class="step" data-step="-1" aria-label="Weniger ${s.label}"><i data-icon="minus" data-size="16"></i></button>
          <input type="number" inputmode="numeric" min="0" step="1" value="" placeholder="0" aria-label="Anzahl ${s.label}">
          <button type="button" class="step" data-step="1" aria-label="Mehr ${s.label}"><i data-icon="plus" data-size="16"></i></button>
        </div>
        <span class="zaehl-betrag mono">0.00</span>
      </div>`;
  }
  document.getElementById("rows-noten").innerHTML = NOTEN.map(rowHtml).join("");
  document.getElementById("rows-muenzen").innerHTML = MUENZEN.map(rowHtml).join("");

  bereich.querySelectorAll(".zaehl-row").forEach((row) => {
    const key = row.dataset.key;
    const input = row.querySelector("input");
    input.addEventListener("input", () => {
      const n = parseInt(input.value, 10);
      anzahl[key] = Number.isFinite(n) && n > 0 ? Math.min(n, 99999) : 0;
      aktualisieren();
    });
    input.addEventListener("focus", () => input.select());
    row.querySelectorAll(".step").forEach((b) =>
      b.addEventListener("click", () => {
        anzahl[key] = Math.max(0, (anzahl[key] || 0) + Number(b.dataset.step));
        input.value = anzahl[key] || "";
        aktualisieren();
      })
    );
  });

  function aktualisieren() {
    bereich.querySelectorAll(".zaehl-row").forEach((row) => {
      const key = row.dataset.key;
      row.querySelector(".zaehl-betrag").textContent = chf((anzahl[key] || 0) * Number(key));
      row.classList.toggle("has-value", (anzahl[key] || 0) > 0);
    });
    const t = total(anzahl);
    const stock = aktiveKasse ? aktiveKasse.stock : 0;
    const diff = t - stock;
    document.getElementById("sum-total").textContent = chf(t);
    document.getElementById("sum-stock").textContent = chf(stock);
    document.getElementById("sum-diff").textContent = chfDiff(diff);
    const line = document.getElementById("sum-diff-line");
    line.classList.toggle("plus", diff > 0);
    line.classList.toggle("minus", diff < 0);
    errorEl.textContent = "";
  }

  function leeren() {
    anzahl = leereAnzahl();
    bereich.querySelectorAll(".zaehl-row input").forEach((i) => (i.value = ""));
    document.getElementById("bemerkung").value = "";
    aktualisieren();
  }

  function renderChips() {
    const aktive = kassen.filter((k) => k.active !== false);
    keine.style.display = aktive.length ? "none" : "block";
    if (aktiveKasse && !aktive.some((k) => k.id === aktiveKasse.id)) aktiveKasse = null;
    if (aktiveKasse) aktiveKasse = aktive.find((k) => k.id === aktiveKasse.id); // aktuellen Stock übernehmen
    chips.innerHTML = aktive
      .map((k) => `
        <button type="button" class="kasse-chip ${aktiveKasse?.id === k.id ? "active" : ""}" data-id="${k.id}">
          <span class="kc-name">${esc(k.name)}</span>
          <span class="kc-stock mono">Stock ${chf(k.stock)}</span>
        </button>`)
      .join("");
    chips.querySelectorAll(".kasse-chip").forEach((b) =>
      b.addEventListener("click", () => {
        if (aktiveKasse?.id !== b.dataset.id && total(anzahl) > 0 &&
            !confirm("Die bisherige Eingabe wird für die andere Kasse übernommen. Fortfahren?")) return;
        aktiveKasse = kassen.find((k) => k.id === b.dataset.id);
        renderChips();
      })
    );
    bereich.style.display = aktiveKasse ? "block" : "none";
    aktualisieren();
  }

  // Speichern: zuerst Zusammenfassung zeigen
  document.getElementById("zaehl-reset").addEventListener("click", () => {
    if (total(anzahl) === 0 || confirm("Alle Eingaben löschen?")) leeren();
  });
  document.getElementById("zaehl-speichern").addEventListener("click", () => {
    if (!aktiveKasse) return;
    const t = total(anzahl);
    if (t === 0 && !confirm("Es wurde nichts gezählt (Total 0.00). Trotzdem speichern?")) return;
    const diff = t - aktiveKasse.stock;
    document.getElementById("confirm-body").innerHTML = `
      <div class="detail-grid">
        <span>Kasse</span><strong>${esc(aktiveKasse.name)}</strong>
        <span>Gezählt</span><strong class="mono">${chf(t)}</strong>
        <span>Stock</span><span class="mono">${chf(aktiveKasse.stock)}</span>
        <span>Differenz</span><strong class="mono ${diff > 0 ? "txt-plus" : diff < 0 ? "txt-minus" : ""}">${chfDiff(diff)}</strong>
      </div>`;
    openModal("confirm-modal");
  });
  document.getElementById("confirm-cancel").addEventListener("click", () => closeModal("confirm-modal"));
  document.getElementById("confirm-ok").addEventListener("click", async () => {
    if (speichert || !aktiveKasse) return;
    speichert = true;
    const okBtn = document.getElementById("confirm-ok");
    okBtn.disabled = true;
    okBtn.textContent = "Wird gespeichert …";
    const t = total(anzahl);
    try {
      await addDoc(collection(db, "zaehlungen"), {
        kasseId: aktiveKasse.id,
        kasseName: aktiveKasse.name,
        stock: aktiveKasse.stock,
        anzahl: Object.fromEntries(ALLE.map((s) => [s.key, anzahl[s.key] || 0])),
        total: t,
        differenz: t - aktiveKasse.stock,
        bemerkung: document.getElementById("bemerkung").value.trim().slice(0, 300),
        uid: session.uid,
        userName: session.profile.name || "",
        createdAt: serverTimestamp(),
      });
      closeModal("confirm-modal");
      leeren();
      toast("Zählung gespeichert");
    } catch (err) {
      console.error(err);
      closeModal("confirm-modal");
      errorEl.textContent = err.code === "permission-denied"
        ? "Speichern abgelehnt. Wurde der Stock der Kasse gerade geändert? Bitte Kasse neu wählen und erneut speichern."
        : "Speichern fehlgeschlagen. Bitte Verbindung prüfen und erneut versuchen.";
    } finally {
      speichert = false;
      okBtn.disabled = false;
      okBtn.textContent = "Speichern";
    }
  });

  return {
    setKassen(list) {
      kassen = list;
      renderChips();
    },
  };
}
