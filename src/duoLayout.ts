// iPhone Duo / breite Anzeigen (Vorbild LionHealth, Group Cash):
// Aufgeklappt (quer, ab 600x600 pt) oder zwei Display-Segmente nebeneinander -> body.wide,
// zwei Spalten links und rechts vom Knick. --hinge = Breite des freien Streifens,
// --hinge-x = Lage des Knicks. Zugeklappt wirken nur die safe-area-Abstaende im CSS.
const BREIT_MQ = "(min-width: 600px) and (min-height: 600px)";
const KNICK_MIN = 40;

function segmente(): any[] | null {
  const s = (window as any).viewport?.segments;
  return Array.isArray(s) ? s : null;
}

function istBreit(): boolean {
  const s = segmente();
  if (s && s.length === 2 && Math.abs(s[0].left - s[1].left) < 1) return false; // Knick waagrecht
  if (s && s.length === 2) return true;
  return window.matchMedia(BREIT_MQ).matches;
}

function knickAktualisieren() {
  const s = segmente();
  let spalt = 0;
  let mitte = window.innerWidth / 2;
  if (s && s.length === 2 && s[1].left > s[0].left) {
    spalt = Math.max(0, s[1].left - (s[0].left + s[0].width));
    mitte = s[0].left + s[0].width + spalt / 2;
  }
  const st = document.documentElement.style;
  st.setProperty("--hinge", Math.max(KNICK_MIN, spalt + 32) + "px");
  st.setProperty("--hinge-x", mitte + "px");
  document.body.classList.toggle("wide", istBreit());
}

export function initDuoLayout() {
  knickAktualisieren();
  const mq = window.matchMedia(BREIT_MQ);
  if (mq.addEventListener) mq.addEventListener("change", knickAktualisieren);
  window.addEventListener("resize", knickAktualisieren);
  (window as any).viewport?.addEventListener?.("segmentschange", knickAktualisieren);
}
