# 青嶼研究室｜投資研究工作台

上市／上櫃官方盤後資料、策略交集、行業排除、指標熱力圖、法人籌碼、自選股與研究筆記。保留現有 GitHub／Cloudflare 架構與每日股票更新。

## 本機啟動

1. 安裝 Python 3.10+、Node 22+（測試用途）。
2. 在專案根目錄執行 `python -m http.server 8000`，開啟 <http://localhost:8000>。
3. 內附官方盤後快照；重新取得資料用 `python scripts/update_data.py` 及 `python scripts/update_chips.py`。

網頁是靜態 HTML／CSS／JavaScript，資料由 Python 透過 TWSE／TPEx 官方來源擷取後寫入 JSON。更新失敗保留原有有日期的資料，不以示範值替代。自選股、筆記及儲存條件只在使用者裝置保存；沒有跨裝置同步、下單或個人化投資建議。

## iPhone App、策略交集與籌碼面（此分支）

- `ios/Qingyu/Qingyu.xcodeproj`：SwiftUI + WKWebView iPhone／iPad 專案，原生返回、分享、載入進度、重試與下載分享。最低 iOS 17；開發與簽署步驟見 [ios/README.md](ios/README.md)。這不是已簽署的 IPA，目前未發佈 App Store／TestFlight。
- 根目錄 PWA：Safari 分享 → 加入主畫面。行動版安全區、固定底部導覽、本機自選與筆記備份。Service Worker 不快取頁面、行情或私人筆記，離線只顯示重新連線提示。
- **多策略全部符合（AND）**：策略頁按鈕可複選，選擇成長、低估值、股息、進取等組合，再按「查看全部符合個股」。所有已選策略、手動篩選、自選、行業排除與籌碼條件一起取交集；取消其中一項不會清掉其他策略。沒有交集就顯示0檔。舊的單策略儲存設定／備份可載入。
- **籌碼頁與個股明細**：外資（不含外資自營商）、投信、自營商、合計的當日淨買賣超。原始儲存單位股，UI÷1,000換算張，零與缺值分開。可疊加外資買超、投信買超、合計買超或三類皆買超到策略交集。
- **期間核對**：策略只採7日內行情、同日估值；營收型策略另需100日內的實際營收月份。`scripts/update_data.py` 現在保留 `valuationDate`、`revenueMonth`、`cumulative`，沒有日期不從股價日期推定。這修復舊快照遺失期間、累計欄位而無法判定策略的問題。
- **歷史累積**：`scripts/update_chips.py` 每日保留最多60期。5／20日累計須逐個平日完整；休市尚未核對或有缺日就不計算。連買／連賣遇缺值、缺日立即停止；歷史起點未確認則只顯示「已知N日」，不宣稱完整連續天數。本次初始籌碼快照僅1期，因此5／20日目前為「—」。

### 資料與更新

網頁直接讀取 `./data/stocks.json`、`./data/chips.json`，不依賴 Sites 專用 `/api/market`。繼續保留原本週一至週五 UTC 11:15 的股票更新排程，另接籌碼步驟；籌碼失敗不阻擋股票日更。失敗市場保留原有日期；兩市場皆失敗不覆寫檔案。更新結果會顯示市場日期、來源錯誤及筆數。資料檔不包含使用者筆記或憑證。

官方籌碼來源：

- TWSE：<https://www.twse.com.tw/rwd/zh/fund/T86?selectType=ALLBUT0999&response=json>
- TPEx：<https://www.tpex.org.tw/openapi/v1/tpex_3insti_daily_trading>；欄位定義 <https://www.tpex.org.tw/openapi/swagger.json>

自營商已包含外資自營商，合計不重複加入外資自營商。管線依欄名解析、驗證日期與涵蓋率，並核對合計。

### 本機驗證

```sh
python -m unittest discover -s tests -v
node --test tests/*.test.mjs
python scripts/audit_coverage.py
python -m http.server 8000
```

Node 22或以上；以 HTTP 開啟根目錄。GitHub Quality gate 包含 Python／Node 回歸與 macOS 的 iOS 模擬器免簽署編譯。沒有把原生模擬器編譯視為 iPhone 實機驗收。

此分支僅供 PR 審核，不直接合併或部署，不更動既有存取可見性。原生預設 URL 仍指向現有正式站；新功能須在部署獲准後才會出現在該網址。正式裝置與行動／桌面瀏覽器完整驗收仍需在含此分支的核准測試站進行。

### 熱力圖研究優先度

熱力圖預設依研究優先度降冪，再按代號穩定排序；缺必要資料的個股另列最後，不賦予0分。100分自訂規則為成長30／估值30／歷史股息15／當日法人25，詳見頁面「研究優先度怎麼排？」。未回測，未涵蓋ROE、EPS、現金流、負債、人氣或技術面，不等同完整50／25／15／10框架或報酬預測。色塊保留所選原始指標顏色，另顯示分數與順序；鍵盤聚焦或移到色塊可見明細。所有既有熱力圖範圍、行業排除及期間控制繼續生效。籌碼非同步載入完成後，會重新計算排序。

### Cloudflare 正式部署

`wrangler.jsonc` 綁定既有 `qingyu-stock` Worker。Wrangler 執行 `python3 scripts/build_static.py` 產生 `dist/`，只包含明確允許的網站資產、官方快照、快取標頭與雜湊清單 `deployment.json`。原始碼、iOS 專案、測試、工作流程及其他儲存庫檔案不會打包上站。使用既有 Workers Builds 的部署命令 `npx wrangler deploy`；分支預覽可用 `npx wrangler versions upload`。不需要將整個儲存庫根目錄設定為公開資產目錄。
