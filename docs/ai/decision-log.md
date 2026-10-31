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
