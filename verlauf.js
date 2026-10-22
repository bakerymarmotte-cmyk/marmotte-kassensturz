import { db } from "./firebase-config.js";
import {
  collection, query, where, orderBy, limit, startAfter, getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ALLE, chf, chfDiff, esc, datumZeit } from "./geld.js";
import { openModal, closeModal } from "./ui.js";

const SEITE = 30; // Zählungen pro Ladevorgang

export function initVerlauf(session) {
  const isAdmin = session.profile.role === "admin";
  const listEl = document.getElementById("verlauf-list");
  const mehrBtn = document.getElementById("verlauf-mehr");
  const filter = document.getElementById("verlauf-kasse");

  let eintraege = [];
  let letzter = null;
  let geladen = false;
  let laedt = false;

  // Admin: alle Zählungen (optional nach Kasse gefiltert, direkt in der Datenbank)
  // Mitarbeitende: nur eigene Zählungen (Kassenfilter im Browser)
  function baueQuery() {
    const teile = [collection(db, "zaehlungen")];
    if (!isAdmin) teile.push(where("uid", "==", session.uid));
    else if (filter.value) teile.push(where("kasseId", "==", filter.value));
    teile.push(orderBy("createdAt", "desc"));
    if (letzter) teile.push(startAfter(letzter));
    teile.push(limit(SEITE));
    return query(...teile);
  }

  async function lade(neu) {
    if (laedt) return;
    laedt = true;
    if (neu) { eintraege = []; letzter = null; listEl.innerHTML = '<p class="hint-text">Lädt …</p>'; }
    try {
      const snap = await getDocs(baueQuery());
      eintraege.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      letzter = snap.docs[snap.docs.length - 1] || letzter;
      mehrBtn.style.display = snap.docs.length === SEITE ? "block" : "none";
      render();
      geladen = true;
    } catch (err) {
      console.error(err);
      listEl.innerHTML = '<p class="error-text">Verlauf konnte nicht geladen werden.</p>';
    } finally {
      laedt = false;
    }
  }

  function render() {
    const sichtbar = !isAdmin && filter.value ? eintraege.filter((e) => e.kasseId === filter.value) : eintraege;
    if (!sichtbar.length) {
      listEl.innerHTML = '<p class="hint-text">Noch keine Zählungen vorhanden.</p>';
      return;
    }
    listEl.innerHTML = sichtbar
      .map((z) => `
        <button class="verlauf-item" data-id="${z.id}">
          <div class="vi-main">
            <div class="vi-top"><strong>${esc(z.kasseName)}</strong><span class="vi-date">${datumZeit(z.createdAt)}</span></div>
            <div class="vi-sub">${esc(z.userName || "–")}${z.bemerkung ? ` · <i data-icon="info" data-size="13"></i> ${esc(z.bemerkung)}` : ""}</div>
          </div>
          <div class="vi-nums">
            <span class="mono">${chf(z.total)}</span>
            <span class="diff-badge mono ${z.differenz > 0 ? "plus" : z.differenz < 0 ? "minus" : "zero"}">${chfDiff(z.differenz)}</span>
          </div>
        </button>`)
      .join("");
    listEl.querySelectorAll(".verlauf-item").forEach((b) =>
      b.addEventListener("click", () => zeigeDetail(eintraege.find((e) => e.id === b.dataset.id)))
    );
  }

  function zeigeDetail(z) {
    document.getElementById("detail-title").textContent = z.kasseName;
    const zeilen = ALLE.filter((s) => (z.anzahl?.[s.key] || 0) > 0)
      .map((s) => `
        <tr><td class="mono">${s.label}</td><td class="mono r">${z.anzahl[s.key]} ×</td><td class="mono r">${chf(z.anzahl[s.key] * Number(s.key))}</td></tr>`)
      .join("");
    document.getElementById("detail-body").innerHTML = `
      <div class="detail-grid">
        <span>Datum</span><span>${datumZeit(z.createdAt)}</span>
        <span>Gezählt von</span><span>${esc(z.userName || "–")}</span>
        ${z.bemerkung ? `<span>Bemerkung</span><span>${esc(z.bemerkung)}</span>` : ""}
      </div>
      <table class="detail-table">
        <tbody>${zeilen || '<tr><td colspan="3" class="hint-text">Nichts gezählt</td></tr>'}</tbody>
        <tfoot>
          <tr><td>Gezählt</td><td></td><td class="mono r"><strong>${chf(z.total)}</strong></td></tr>
          <tr><td>Stock</td><td></td><td class="mono r">${chf(z.stock)}</td></tr>
          <tr class="${z.differenz > 0 ? "txt-plus" : z.differenz < 0 ? "txt-minus" : ""}"><td>Differenz</td><td></td><td class="mono r"><strong>${chfDiff(z.differenz)}</strong></td></tr>
        </tfoot>
      </table>`;
    openModal("detail-modal");
  }
  document.getElementById("detail-close").addEventListener("click", () => closeModal("detail-modal"));

  filter.addEventListener("change", () => (isAdmin ? lade(true) : render()));
  mehrBtn.addEventListener("click", () => lade(false));

  return {
    setKassen(list) {
      const aktuell = filter.value;
      filter.innerHTML = '<option value="">Alle Kassen</option>' +
        list.map((k) => `<option value="${k.id}">${esc(k.name)}${k.active === false ? " (inaktiv)" : ""}</option>`).join("");
      filter.value = list.some((k) => k.id === aktuell) ? aktuell : "";
    },
    // Wird beim Öffnen des Tabs aufgerufen: lädt neu, damit frische Zählungen erscheinen
    ladeErsteSeite() {
      lade(true);
    },
  };
}
