# 青嶼研究室｜台股智慧選股篩選器 V1

本專案是**可執行的前端 + 官方盤後資料更新腳本**，不是即時行情，也不會由 AI 虛構股價。

## 快速啟動（Windows / macOS）

1. 安裝 Python 3.10+。
2. 解壓縮後在專案資料夾開啟終端機。
3. 先執行 `python -m http.server 8000`（Windows 若 python 不可用，試 `py -m http.server 8000`）。
4. 在瀏覽器打開 http://localhost:8000 。此時顯示醒目的「DEMO 示範模式」，資料全部為虛構測試值。
5. 另開終端機，在網路可連通官方服務的情況下執行 `python scripts/update_data.py`，重新整理網頁。資料更新成功後會顯示「官方盤後資料」。

> 更新需要網路連線。若官方服務不可用、拒絕雲端 IP 或回傳格式改變，更新腳本會顯示錯誤；若兩個價量來源都不可用，保留舊資料，不會假裝成功。只有成功來源的部分資料也可能產生快照，介面會列出成功的價量來源。建議確認 `data/stocks.json` 的 `meta.errors` 與 `meta.source_details`。

## 功能

- 搜尋股票代號與名稱、上市/上櫃切換
- PE、PB 上限、殖利率下限、月營收年增下限；缺值不會通過被指定的門檻
- 排序、分頁、CSV 匯出、響應式手機介面
- 當官方欄位缺漏時顯示「—」，不偽造指標
- 官方資料取得失敗時不以示範資料冒充真實行情

## 架構

`TWSE / TPEx OpenAPI → Python 更新程式 → data/stocks.json → HTML / CSS / JS 前端`

端點：
- TWSE `https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL`
- TWSE `https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL`
- TWSE `https://openapi.twse.com.tw/v1/opendata/t187ap05_L`
- TPEx `https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes`
- TPEx `https://www.tpex.org.tw/openapi/v1/tpex_mainboard_peratio_analysis`

**注意：** 上櫃 API 的欄位映射尚未在本執行環境取得實際回應驗證；目前提供容錯欄位映射，上線前請於可連線環境測試並依正式回應調整。月營收 YoY 亦僅對已明確映射的欄位填值。ROE、法人籌碼、即時行情、AI 投資建議及使用者登入尚未開發。

## 部署 Cloudflare Pages（建議）

1. 建立 GitHub repository，將解壓縮後**所有檔案（包含 `.github` 隱藏資料夾）**推到 repository 根目錄。
2. 登入 Cloudflare → Workers & Pages → Create → Pages → Connect to Git。
3. 選擇剛建立的 repository，Framework preset 選 `None`，Build command 留空，Output directory 指向專案根目錄 `.`。
4. 部署後 Cloudflare 會提供 `pages.dev` 網址。
5. 在 GitHub 的 Actions 頁面手動執行 `Update official EOD snapshots`。若工作流程沒有出現，確認 `.github/workflows/update-data.yml` 已推送至 GitHub。
6. 檢查 Actions 執行記錄；若成功會更新 `data/stocks.json` 並觸發 Cloudflare 重新部署。排程為台灣時間工作日 19:15（GitHub Actions 有延遲可能），**不保證官方當日數據已發布**。
7. 每次更新後檢查網站資料日期及 errors。如果有 API 擋掉 GitHub 雲端 IP，可在自己電腦執行更新並 push JSON。

**重要**：Cloudflare 的實際使用與商業條件、TWSE/TPEx 資料再利用授權及顯示規範，對外收費前務必重新確認。GitHub Pages 不適合作為營運 SaaS 的免費商業主機。

## 測試

`python -m unittest discover -s tests -v`

## 免責與資料準確性

- 市場資料會延遲，節假日可能仍為上一交易日。
- 若取得部分來源，市場覆蓋不完整；檢查 meta.sources。
- 資料可能含證券型 ETF 或非一般公司代號；MVP 尚未完整辨認證券種類。建議加入股票基本資料表後再提供全市場統計。
- 用戶輸入的門檻不構成投資推薦，結果不代表未來報酬。
- 目前只使用同一資料快照中的價量與比率；月營收 YoY 對應的月份未在每筆資料列中顯示，正式公開前應補上營收年月並做資料期間檢驗。
