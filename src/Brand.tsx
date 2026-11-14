// Marken-Block: App-Icon und Wortmarke "isybee" (Variante: Unterkanten bündig mit dem Icon).
// Die Wortmarke ist als Vektorgrafik (public/isybee-wortmarke.svg, Inter ExtraBold als Pfade)
// eingebunden, damit sie auf Web, iOS und Android exakt gleich aussieht.
export default function Brand({ size = 38, icon = "icon-192.png" }: { size?: number; icon?: string }) {
  return (
    <span className="brand" style={{ ["--h" as any]: `${size}px` }} role="img" aria-label="isybee">
      <img src={icon} alt="" />
      <img src="isybee-wortmarke.svg" alt="" />
    </span>
  );
}
