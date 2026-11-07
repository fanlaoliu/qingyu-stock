# 青嶼研究室 AI 開發規範

## 目標
維護台股研究工作台，優先資料正確性、行動裝置可用性、可回復的部署。

## 開發流程（參考 gstack）
1. Plan：先讀 README、相關程式、測試與資料來源；列出驗收條件。
2. Implement：在 feature 分支做最小必要修改，禁止直接修改 main。
3. Review：檢查錯誤處理、安全、資料來源與授權；不可宣稱不存在的即時行情。
4. QA：執行 Python unittest，驗證前端在手機與桌面可用，確認缺值不被偽造成數字。
5. Ship：提交 Pull Request，等待擁有者審核後才合併與發布。

## 資料安全
- 禁止提交 API token、密碼、.env、個人資料。
- 股價、PE、PB、殖利率及營收資料必須標註來源和時間；無資料顯示 —。
- API 失敗不能自動改成假資料；保留錯誤狀態。
- 不擴大 GitHub、Cloudflare、預覽站可見性；公開前取得核准。
- PR 不應自動合併；正式環境部署應經擁有者核准。
- 任何外部 Agent Skills 先審查授權、腳本及網路權限，禁止盲目安裝。

## 記憶（參考 gbrain）
以 docs/ai/decision-log.md 記錄架構決策、資料限制與測試結果。此為版本化專案記憶，不代表已安裝 gbrain 服務。

## 追加相容規範與技能路由（整合PR #2）


本專案為靜態 HTML/CSS/JavaScript + Python 台股盤後資料工作台。目前已有鎖定Node依賴及Node測試；不得假定已使用React或Next.js，也不得為啟用技能而遷移框架。

## 必要流程
1. 在非 main 分支實作，透過 Pull Request 提交；不得自動 merge。
2. 先閱讀 README.md、index.html、scripts/update_data.py、tests 與 .github/workflows/update-data.yml。
3. 修改前確認不會破壞既有每日官方行情更新與 data/stocks.json 格式。
4. 執行 python -m unittest discover -s tests -v 與 python -m py_compile scripts/update_data.py。
5. 對資料載入、缺值、錯誤訊息、手機版、鍵盤操作與瀏覽器主控台做 QA；無法執行的測試須標示未驗證。
6. 發布前檢查 PR 差異、依賴授權、密鑰洩漏、權限與資料來源。
7. 預覽環境僅供驗證；正式部署與任何公開範圍變更都必須另外取得使用者明確批准。
8. 不得自動執行來源不明的第三方腳本、curl | sh、npm postinstall、危險刪除或 force push。
9. 投資資訊不可杜撰行情、PE/PB 或把延遲行情標成即時行情。

## 技能路由
- Code Review: .agents/skills/code-review/SKILL.md
- Browser QA: .agents/skills/browser-qa/SKILL.md
- Frontend Design: .agents/skills/frontend-design/SKILL.md
- React Best Practices: .agents/skills/react-best-practices/SKILL.md（僅當引入 React 後適用）
- Safety Guard: .agents/skills/safety-guard/SKILL.md
- Find Skills: .agents/skills/find-skills/SKILL.md
- Deployment Review: .agents/skills/deployment-review/SKILL.md

以上為專案相容的技能路由/規範，不代表第三方 CLI 已安裝或 Browser QA 已執行。
