import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

// MARK: - PDF text (Avant statements)
//
// Reads a PDF's text with iOS's own PDFKit and hands it back line by line
// with positions, so the web side (src/pdfText.js) rebuilds rows the same way
// it does from pdf.js. Done natively because pdf.js needs newer JavaScript
// than the iOS 26 web view has. Nothing leaves the phone.
import PDFKit

@objc(PdfTextPlugin)
public class PdfTextPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PdfTextPlugin"
    public let jsName = "PdfText"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "extract", returnType: CAPPluginReturnPromise)
    ]

    @objc func extract(_ call: CAPPluginCall) {
        guard let base64 = call.getString("data"), let data = Data(base64Encoded: base64) else {
            call.reject("No PDF data")
            return
        }
        DispatchQueue.global(qos: .userInitiated).async {
            guard let doc = PDFDocument(data: data) else {
                call.reject("This file isn't a PDF Gild can open")
                return
            }
            var pages: [[[String: Any]]] = []
            for index in 0..<doc.pageCount {
                guard let page = doc.page(at: index) else { continue }
                var items: [[String: Any]] = []
                if let selection = page.selection(for: page.bounds(for: .mediaBox)) {
                    for line in selection.selectionsByLine() {
                        let text = line.string ?? ""
                        if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { continue }
                        let box = line.bounds(for: page)
                        items.append(["str": text, "x": box.minX, "y": box.minY, "w": box.width])
                    }
                }
                pages.append(items)
            }
            call.resolve(["pages": pages])
        }
    }
}

// The app's web view controller, so the PdfText plugin above gets registered.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PdfTextPlugin())
    }
}

// MARK: - Apple Pay → GILD (Shortcuts)
//
// A Shortcuts action, "Log Apple Pay in GILD", meant for a personal
// automation on the Wallet "Transaction" trigger. It doesn't log anything by
// itself: it appends the payment to an inbox file in the app's own Library
// folder, and GILD shows it as a payment to check next time it opens (see
// src/applePay.js). Nothing leaves the phone.
import AppIntents

@available(iOS 16.0, *)
struct LogApplePayIntent: AppIntent {
    static var title: LocalizedStringResource = "Log Apple Pay in GILD"
    static var description = IntentDescription("Adds an Apple Pay payment to GILD for you to check.")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Amount") var amount: String
    @Parameter(title: "Merchant") var merchant: String
    @Parameter(title: "Card", default: "") var card: String

    func perform() async throws -> some IntentResult {
        try ApplePayInbox.append(amount: amount, merchant: merchant, card: card)
        return .result()
    }
}

@available(iOS 16.0, *)
struct GildShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: LogApplePayIntent(), phrases: ["Log Apple Pay in \(.applicationName)"], shortTitle: "Log Apple Pay", systemImageName: "creditcard")
    }
}

enum ApplePayInbox {
    static let fileName = "gild-applepay-inbox.json"

    static func append(amount: String, merchant: String, card: String) throws {
        let dir = try FileManager.default.url(for: .libraryDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let url = dir.appendingPathComponent(fileName)
        var items: [[String: String]] = []
        if let data = try? Data(contentsOf: url), let existing = try? JSONSerialization.jsonObject(with: data) as? [[String: String]] {
            items = existing
        }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        items.append([
            "id": UUID().uuidString,
            "at": iso.string(from: Date()),
            "amount": amount,
            "merchant": merchant,
            "card": card
        ])
        let out = try JSONSerialization.data(withJSONObject: items)
        try out.write(to: url, options: .atomic)
    }
}
