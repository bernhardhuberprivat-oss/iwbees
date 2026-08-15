import UIKit
import Capacitor

// Eigene Bridge-View-Controller-Unterklasse, nur um webView.isInspectable = true zu setzen.
// Ohne das kann Safaris Web-Inspector (Entwickler-Menü am Mac) die WKWebView in einem
// TestFlight-/Release-Build nicht anzapfen - das Flag ist ab iOS 16.4 nötig und ist nur
// bei einem direkt aus Xcode gestarteten Debug-Build automatisch an. Wirkt sich nicht auf
// den App-Store-Review aus (kein sichtbares Verhalten für Endnutzer), hilft aber beim
// Debuggen zukünftiger Probleme über TestFlight enorm - siehe die "Kaufvorgang zeigt
// wiederholt Fehlermeldung"-Diagnose vom 14. Aug. 2026.
class BridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        if #available(iOS 16.4, *) {
            self.webView?.isInspectable = true
        }
    }
}
