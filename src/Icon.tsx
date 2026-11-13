// Schlichte Linien-Icons (24x24, stroke) statt Emojis. Label zeigt vorangestellte Emojis
// aus den Übersetzungstexten automatisch als passendes Icon an.
const ICON_PATHS: Record<string, string> = {
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01",
  pdf: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6",
  install: "M12 4v11m0 0-4-4m4 4 4-4M5 20h14",
  feedback: "M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  admin: "M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0",
  user: "M16 8a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0",
  card: "M3 6h18v12H3zM3 10h18",
  switch: "M7 7h13m0 0-3-3m3 3-3 3M17 17H4m0 0 3-3m-3 3 3 3",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9S14.5 18.5 12 21c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3z",
  drop: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z",
  calendar: "M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M8 3v4M16 3v4",
  crown: "M4 18h16M5 18 4 7l5 4 3-6 3 6 5-4-1 11",
  hexagon: "M12 3l7.5 4.5v9L12 21l-7.5-4.5v-9z",
  flask: "M9 3h6M10 3v6L5 19a1 1 0 0 0 1 1.5h12a1 1 0 0 0 1-1.5l-5-10V3",
  scale: "M12 4v16M6 20h12M5 8h14M5 8l-3 6h6zM19 8l-3 6h6z",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  grid: "M4 4h16v16H4zM4 12h16M12 4v16",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
};

const EMOJI_ICON: Record<string, string> = {
  "👤": "user",
  "🍯": "drop",
  "📷": "camera",
  "🎙": "mic",
  "📅": "calendar",
  "👑": "crown",
  "🐝": "hexagon",
  "🔬": "flask",
  "⚖": "scale",
  "👁": "eye",
  "🧱": "grid",
  "⏳": "clock",
};

export function Icon({ name }: { name: string }) {
  return (
    <svg className="menu-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

// Ersetzt ein führendes Emoji im Text durch das passende Linien-Icon.
export function Label({ text }: { text: string }) {
  const clean = text.replace(/️/g, "");
  if (clean.startsWith("🟢") || clean.startsWith("🔴")) {
    return (
      <>
        <span className={`status-dot ${clean.startsWith("🟢") ? "on" : "off"}`} aria-hidden="true" />
        {clean.slice(2).trimStart()}
      </>
    );
  }
  for (const [emoji, name] of Object.entries(EMOJI_ICON)) {
    if (clean.startsWith(emoji)) {
      return (
        <>
          <Icon name={name} />
          {clean.slice(emoji.length).trimStart()}
        </>
      );
    }
  }
  return <>{text}</>;
}
