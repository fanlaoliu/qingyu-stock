# PR #1～#15 整合與私人Vercel發布（2026-11-07）

使用者指示「要將之前pr都部署且新增估值訊號更新」。本次在`feat/all-pr-vercel-20261107`整合所有PR來源；不在GitHub合併原PR、不推main、不改原Sites或Cloudflare網站、不啟用付費服務、不開啟真正AI／交易功能。

## 來源與範圍

以下15個固定head均經`git merge-base --is-ancestor <head> HEAD`檢查包含於整合歷史。PR #3～#6、#8、#10～#13已在main，#9與#15已在部署基礎；本次追加#1、#2、#7、#14。開發規範、插件審查文件與離線工具只保留於Git，不當作網站靜態檔對外提供。

|PR|固定head|內容|整合狀態|
|---|---|---|---|
|#1|8b929caf0bd57bf8a321eb84a28daa206c135214|建立青嶼研究室 AI 開發審核流程|整合來源；本次僅在整合分支保留|
|#2|24beaf370c27300529f15c60d2cb5278ee57203b|chore: introduce reviewed AI agent skills and deployment safeguards|整合來源；本次僅在整合分支保留|
|#3|87f542e17413b017aea27ee00d08a4ba0c78d635|新增 iOS App、策略交集、籌碼分析與熱力圖研究排序|整合來源；原已合併main|
|#4|40893b8d03f9012720187a0252e34ce6f7089ab7|security: protect local secrets and add PR secret scanning|整合來源；原已合併main|
|#5|8564391f71884bcbbf9329b9538879ef4d4b8068|修復網站啟動中斷與股票資料空白|整合來源；原已合併main|
|#6|dab1c58313d2f57f7bd02ead44b328a78103b05a|資料品質、評分來源檢核與策略診斷正式發布|整合來源；原已合併main|
|#7|575ed3a53b4e4cc235c784b4321785680377130e|Architecture: phased product roadmap and explicit release gates|整合來源；本次僅在整合分支保留|
|#8|9b2be3fc9186533f0990f397d329346cb65d2b28|新增策略診斷：資料不足與未達門檻原因|整合來源；原已合併main|
|#9|d4790eba782c25f7052c49c1ab1d9d151b71ea58|第二至第五階段：進階研究、投資帳本、選用AI後端與歷史回測|整合來源；本次僅在整合分支保留|
|#10|904cb5a6813c6af7156e5d123053b566ab9a9e75|feat: 青嶼研究室簡單版／專業版雙模式|整合來源；原已合併main|
|#11|dac5a28e886658d92064d59f39f02a37a86d5c9a|修正雙模式打包遺漏與簡單版控制項可見性|整合來源；原已合併main|
|#12|9a4f2b7fa791001ca205696d98448bfa53696cb1|緊急修復：雙模式切換把整頁轉成文字|整合來源；原已合併main|
|#13|4402a521f166d164eb77082bfa85ea067a8c61ad|簡單版：可展開的進階條件與更清楚的使用說明|整合來源；原已合併main|
|#14|b0b225e6232fbe3520e3b060d8b61eba22d3bfb8|chore: prepare read-only Thermos candidate and verify Cursor plugin sources|整合來源；本次僅在整合分支保留|
|#15|865dd875bfc6c8d9bd647e0fd40a724577e4ff17|[Draft] 雙專家智慧選股 V1：可追溯評分、估值訊號、風控與 PIT 回測|整合來源；本次僅在整合分支保留|

## 衝突處理

- AGENTS.md：保留#1安全／發布核准與決策紀錄，再加入#2技能路由和必要流程；修正已存在Node測試的事實。未放寬私密、安全或不自動合併限制。
- wrangler.jsonc：#7所需previews設定已存在，保留#15既有Worker API與資產binding，沒有回退較新的設定。
- #14為MIT授權的離線審查衍生工具與測試；未安裝／執行第三方插件、MCP、npm安裝腳本或模型，原始上游Cursor執行環境仍未驗證。複製規範檔不代表第三方插件已啟用。

## 網站與估值訊號

保留iPhone/PWA、策略AND交集、排除產業、熱力圖、籌碼、研究比較、投資帳本、TTM／財報匯入、情境估值、規則化雙角色審查與回測核心。估值訊號沿用#15已驗收規則：多法估值、資料日期與來源檢查；偏高須超區間且溢價≥20%，偏低須滿足安全邊際，完整研究資格通過才可研究買入。資料不足、方法差異、來源未核、不同報價版本和未完成產業模型均不硬發買入。詳見[估值訊號規則](../VALUATION_SIGNALS.md)。

首頁文字改為「手動更新僅重新讀取目前已發布的盤後快照」，避免暗示Vercel已每日同步。既有GitHub行情排程未變，但尚未將Vercel接成每日自動部署。正式AI、合法完整長期財務、2015～2025真實歷史回測及iPhone實機等限制維持原標示，不能因整合PR宣稱完成。

## 可重現驗證與發布產物

- `npm test`：104通過；`python -m unittest discover -s tests`：85通過。
- `python -m py_compile scripts/update_data.py scripts/build_vercel.py`及差異檢查通過。
- `python scripts/build_vercel.py`：產生37檔白名單發布產物於忽略的`.local-vercel/site/`；35項網站資產＋deployment.json＋vercel.json。
- 新增2項打包測試，驗證.env／報告／tooling／測試排除、CSP腳本雜湊與frame限制、no-store、來源commit及symlink／缺資產拒絕。
- deployment.json記錄實際source_commit、15個PR固定head與manual-release-snapshot，便於登入後查核版本。
- .vercel/加入忽略，不提交CLI身分與環境快取。
- 網頁互動／390px／桌面估值訊號沿用#15驗收；本次估值及互動程式未改，網站僅改更新頻率提示。未把先前QA當作Vercel登入後端到端驗收。

## 存取與發布界線

發布至既有JackFan團隊的`qingyu-stock`專案。先確認Vercel Authentication涵蓋all，再上傳白名單產物、等待READY、比對37檔摘要並重新確認保護。網址維持 https://qingyu-stock-jack-fan.vercel.app 。不建立分享繞過連結、不公開、不新增外部觀看者；GitHub仍保留Draft供審查。

安全檢查：141個目前非忽略檔案、285個所有可達Git歷史blob之常見私鑰／GitHub／OpenAI／AWS金鑰格式0命中。這是模式檢查，不保證識別所有任意格式機密；疑似外洩仍須停止與輪替，不顯示值。

機密掃描處理：首次Secret scan將JSON清單中15個公開PR提交編號識別為高熵字串。逐筆與GitHub原始PR head核對完全相符後，改以可點閱的完整GitHub commit_url記錄同一來源；完整提交編號仍保留於連結與本文件表格。沒有修改掃描設定、降低閾值、加入忽略規則或跳過檢查。

修正後以CI相同的detect-secrets 1.5.0與預設規則掃描：0筆警示；未調整掃描或基線。
