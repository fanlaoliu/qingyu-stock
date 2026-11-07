# 青嶼研究室 AI Agent 開發守則

本專案為靜態 HTML/CSS/JavaScript + Python 台股盤後資料工作台。不得假定 React、Next.js 或 Node build 已存在。

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
