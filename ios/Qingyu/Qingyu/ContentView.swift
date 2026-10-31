import SwiftUI
import WebKit
import UniformTypeIdentifiers

struct ContentView: View {
    @StateObject private var browser = ResearchBrowser()

    var body: some View {
        NavigationStack {
            ZStack(alignment: .top) {
                ResearchWebView(browser: browser)
                if browser.loading { ProgressView(value: browser.progress).tint(.mint) }
                if let error = browser.error {
                    ContentUnavailableView {
                        Label("工作台暫時無法載入", systemImage: "wifi.exclamationmark")
                    } description: {
                        Text(error)
                    } actions: {
                        Button("重新連線") { browser.reload() }.buttonStyle(.borderedProminent)
                    }
                    .background(Color(red: 0.03, green: 0.08, blue: 0.13))
                }
            }
            .navigationTitle("青嶼研究室")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { browser.back() } label: { Image(systemName: "chevron.backward") }
                        .disabled(!browser.canGoBack).accessibilityLabel("上一頁")
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button { browser.reload() } label: { Image(systemName: "arrow.clockwise") }
                        .accessibilityLabel("重新讀取工作台")
                    if let url = browser.appURL { ShareLink(item: url) }
                }
            }
            .sheet(isPresented: $browser.showDownload) {
                if let url = browser.downloadURL { ActivitySheet(url: url) }
            }
        }
    }
}

struct ResearchWebView: UIViewRepresentable {
    let browser: ResearchBrowser
    func makeUIView(context: Context) -> WKWebView { browser.webView }
    func updateUIView(_ view: WKWebView, context: Context) {}
}

/// Uses the deployed workbench, sharing its research rules and daily official snapshots.
/// No account credentials or private notes are sent through a native JavaScript bridge.
final class ResearchBrowser: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    @Published var loading = false
    @Published var progress = 0.0
    @Published var canGoBack = false
    @Published var error: String?
    @Published var downloadURL: URL?
    @Published var showDownload = false
    let webView: WKWebView
    let appURL: URL?
    private var observations: [NSKeyValueObservation] = []

    override init() {
        let raw = Bundle.main.object(forInfoDictionaryKey: "QingyuAppURL") as? String ?? ""
        let candidate = URL(string: raw)
        appURL = candidate?.scheme == "https" && candidate?.host != nil && candidate?.user == nil && candidate?.password == nil ? candidate : nil
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        webView = WKWebView(frame: .zero, configuration: config)
        super.init()
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.03, green: 0.08, blue: 0.13, alpha: 1)
        webView.allowsBackForwardNavigationGestures = true
        observations = [
            webView.observe(\.estimatedProgress, options: [.new]) { [weak self] view, _ in
                self?.progress = view.estimatedProgress
            },
            webView.observe(\.isLoading, options: [.new]) { [weak self] view, _ in
                self?.loading = view.isLoading
            },
            webView.observe(\.canGoBack, options: [.new]) { [weak self] view, _ in
                self?.canGoBack = view.canGoBack
            }
        ]
        reload()
    }

    func reload() {
        guard let url = appURL else { error = "App 網址設定有誤，請設定有效的 HTTPS 工作台網址。"; return }
        error = nil
        webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30))
    }
    func back() { if webView.canGoBack { webView.goBack() } }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if action.shouldPerformDownload && (url.scheme == "blob" || url.host == appURL?.host) {
            decisionHandler(.download); return
        }
        if url.scheme == "https", url.host == appURL?.host, url.port == appURL?.port {
            decisionHandler(.allow); return
        }
        // Research-source links open in Safari. Never allow arbitrary schemes in the WebView.
        if url.scheme == "https", action.navigationType == .linkActivated {
            UIApplication.shared.open(url)
        }
        decisionHandler(.cancel)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url, url.scheme == "https" { UIApplication.shared.open(url) }
        return nil
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { self.error = error.localizedDescription }
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { self.error = error.localizedDescription }
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { reload() }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let name = (suggestedFilename as NSString).lastPathComponent
            let url = folder.appendingPathComponent(name.isEmpty ? "qingyu-backup.json" : name)
            downloadURL = url
            completionHandler(url)
        } catch { completionHandler(nil); self.error = "無法建立匯出檔案：\(error.localizedDescription)" }
    }
    func downloadDidFinish(_ download: WKDownload) { showDownload = true }
    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) { self.error = "匯出失敗：\(error.localizedDescription)" }
}

struct ActivitySheet: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> UIActivityViewController { UIActivityViewController(activityItems: [url], applicationActivities: nil) }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
