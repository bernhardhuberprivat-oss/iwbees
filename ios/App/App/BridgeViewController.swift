import UIKit
import Capacitor
import WebKit

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

    // Erlaubt der Web-App (getUserMedia, siehe VoiceNotes.tsx) Mikrofonzugriff für die
    // Sprachnotizen-Aufnahme. Wichtig: ab iOS 15 zeigt eine WKWebView OHNE diese
    // WKUIDelegate-Methode KEINEN System-Dialog für getUserMedia und lehnt die Anfrage
    // automatisch/stillschweigend ab - anders als in Safari selbst. Die
    // NSMicrophoneUsageDescription in Info.plist allein reicht also nicht aus, diese
    // Delegate-Methode muss die Anfrage explizit gewähren. Kamera wird hier bewusst NICHT
    // pauschal erlaubt - Fotos laufen weiterhin über den nativen Picker
    // (<input type="file">, siehe imageCompression.ts), nicht über getUserMedia.
    @available(iOS 15.0, *)
    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        switch type {
        case .microphone:
            decisionHandler(.grant)
        default:
            decisionHandler(.deny)
        }
    }
}
