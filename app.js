import { requireSession, logout } from "./session.js";
import { db } from "./firebase-config.js";
import { collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { initZaehlen } from "./zaehlen.js";
import { initVerlauf } from "./verlauf.js";
import { initKassen } from "./kassen.js";
import { initTeam } from "./team.js";
import { toast } from "./ui.js";

let session = null;

async function start() {
  try {
    session = await requireSession();
  } catch (e) {
    return; // requireSession hat bereits umgeleitet
  }

  const { profile } = session;
  const isAdmin = profile.role === "admin";
  document.getElementById("user-name-label").textContent = profile.name || "";
  document.body.classList.toggle("is-admin", isAdmin);
  document.getElementById("logout-btn").addEventListener("click", logout);

  setupNav();

  // Kassen einmal live laden und an alle Bereiche weitergeben
  const listeners = [];
  const onKassen = (fn) => listeners.push(fn);

  const zaehlen = initZaehlen(session);
  onKassen(zaehlen.setKassen);
  const verlauf = initVerlauf(session);
  onKassen(verlauf.setKassen);
  if (isAdmin) {
    const kassen = initKassen(session);
    onKassen(kassen.setKassen);
    initTeam(session);
  }

  onSnapshot(
    query(collection(db, "kassen"), orderBy("name")),
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      listeners.forEach((fn) => fn(list));
    },
    (err) => {
      console.error(err);
      toast("Kassen konnten nicht geladen werden.");
    }
  );

  // Verlauf erst laden, wenn der Tab geöffnet wird (spart Lesevorgänge)
  document.querySelector('[data-tab="verlauf"]').addEventListener("click", () => verlauf.ladeErsteSeite());

  document.querySelectorAll(".modal-backdrop").forEach((m) =>
    m.addEventListener("click", (e) => { if (e.target === m) m.classList.remove("active"); })
  );
}

function setupNav() {
  const buttons = document.querySelectorAll("#main-nav button");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      document.getElementById("panel-" + btn.dataset.tab).classList.add("active");
      window.scrollTo(0, 0);
    });
  });
}

start();
