# AI 開發決策紀錄

## 2026-10-31：導入審核式 AI 開發流程
- 保留既有 Python → JSON → 靜態前端架構。
- 參考 gstack 的 plan / review / QA / ship 階段；不宣稱已安裝 gstack。
- 參考 Matt Pocock Skills 的單一任務技能設計。
- awesome-agent-skills 僅作候選資源清單，逐一審查後才採用。
- gbrain 暫不接入外部儲存服務；先用 Git 版控紀錄。
- 使用 feature branch + Pull Request；不得自動合併 main。
- Cloudflare 部署連線、分支保護、預覽權限須在帳號內另外確認。
- 注意：目前 GitHub repository 為 public；不可在其中儲存秘密。

## 2026-11-07：安裝 pstack 並隔離本機資料故障

- 使用者指定 `michael-denyer/pstack-claude`，已在此 Codex 環境安裝 `0.9.132`。來源、安裝方式與限制見 [pstack 紀錄](../PSTACK_SETUP.md)。
- 從 PR #16 整合版建立修復分支，保留既有估值與研究功能；本次 PR 以該整合分支為基底，避免重複審查。
- 瀏覽器重現匯入財報損壞會誤鎖帳本。財報與帳本應分開載入，保留真正損壞帳本的防覆寫保護。
- 本次不合併或正式部署。網站驗證使用測試瀏覽器的隔離資料，未讀取使用者的私人帳本。
