# 青嶼研究室 iOS

SwiftUI + WKWebView iPhone／iPad 專案，最低 iOS 17，使用同一套網頁選股、策略交集、行業排除、熱力圖與籌碼面。具備原生返回、重新載入、分享、進度及重試畫面；備份下載可透過系統分享存到「檔案」。外部研究連結交由 Safari，App 內僅允許設定工作台的 HTTPS 主機，沒有原生 JavaScript 權限橋接。

## 在 Mac 執行

1. 用 Xcode 16 或以上開啟 `Qingyu/Qingyu.xcodeproj`，選擇 Qingyu scheme。
2. 在 Signing & Capabilities 選自己的 Apple 開發團隊，並按需求更改 Bundle Identifier。
3. Build Settings 的 `QINGYU_APP_URL` 預設為既有 Cloudflare 正式站。此 PR **尚未部署**，因此預設網址仍顯示正式站原有功能。先使用含此分支的 HTTPS 測試站網址驗證新功能；不要為測試改動正式站或公開私人站。
4. 選 iPhone 模擬器或自己的 iPhone，Run。
5. 模擬器編譯驗證：`xcodebuild -project ios/Qingyu/Qingyu.xcodeproj -scheme Qingyu -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build`。

此環境沒有 Xcode／Apple SDK，目前未編譯、未簽署，也未產生 IPA、上架 App Store 或傳送 TestFlight。這是原生容器 App；行情與研究功能由部署網站提供，需要網路。它沿用網站存取設定，並不額外建立登入或改變可見性。

自選、研究筆記與篩選設定保存在 App 的 WKWebView，與 Safari／PWA 分開，不會自動同步。可用網頁內的備份匯出／匯入搬移。正式裝置驗收需包含 JSON 匯出／匯入、背景恢復、離線重試、旋轉、VoiceOver、字體與手勢、App 留存資料及外連 Safari。若使用需登入的私人站，須另驗證其登入方式是否支援 WKWebView，不能假設 Safari 登入狀態會沿用。
