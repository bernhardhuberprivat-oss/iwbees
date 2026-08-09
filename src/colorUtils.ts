// Wählt Schwarz oder Weiß als Textfarbe, je nachdem was auf dem Hintergrund besser lesbar ist
export function readableTextColor(hex: string) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#3a2a1a" : "#ffffff";
}

// Liefert die Umrandungsfarbe für eine Stock-Markierung. Bei Weiß (eine gültige
// Königinnen-Markierungsfarbe) würde ein weißer Rahmen auf dem hellen Hintergrund
// unsichtbar sein und wäre nicht von einem noch nicht angelegten/markierten Stock zu
// unterscheiden – deshalb bekommt Weiß hier stattdessen einen dunklen Rahmen.
export function hiveRingColor(hex: string) {
  return hex.toLowerCase() === "#ffffff" ? "#3a2a1a" : hex;
}
