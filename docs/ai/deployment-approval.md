# GitHub 與 Cloudflare 部署審核手冊

## 目前限制
本文件是待設定的操作手冊，不代表 Cloudflare 設定已套用。
目前連接的 GitHub 工具不提供 branch protection/rulesets 修改功能。
Cloudflare Workers 的控制台設定也未由此工作流程修改。

## GitHub（由管理員操作）
1. Repository → Settings → Rules → Rulesets → New branch ruleset。
2. Target branches：main。
3. Require a pull request before merging；Require status checks：AI PR checks / test。
4. 禁止 force push、刪除 main；限制 bypass 權限。
5. 設定後用測試 PR 驗證合併受阻及檢查結果。

## Cloudflare（由管理員操作）
1. Workers & Pages → 找到實際服務 → Settings / Builds。
2. 確認 GitHub repository、production branch 為 main。
3. 啟用非 main 分支的預覽部署；確認預覽網址可供擁有者檢查。
4. 若預覽涉及敏感資料，先設定 Access；不要直接將公開 preview URL 視為私人。
5. 若 Cloudflare 連接 main 即自動發布，PR 核准合併就是發布關卡；若需合併後再手動核准，需另建 GitHub Environments protection + deployment workflow，並停用直接自動發布。
6. 在 Repository → Settings → Secrets and variables → Actions → Variables 可設定 CLOUDFLARE_PREVIEW_URL；注意此欄位只適用固定測試環境，不代表每個 PR 的專屬預覽網址。
7. 正式部署後檢查 / 與 /data/stocks.json，核對資料時間與來源。

## 每日行情更新例外
.github/workflows/update-data.yml 目前在 main 排程更新 data/stocks.json 並 git push。
啟用嚴格 branch ruleset 前，必須決定資料機器人是否可寫入 main：
- 建議方案：資料更新改成建立 PR，通過檢查後合併（不保證無人值守）。
- 替代方案：指定受限 bot 例外，但只允許更新 data/stocks.json；GitHub 規則無法單獨保證路徑限制，需要額外驗證與權限設計。
未完成設計前，不應直接啟用會封鎖行情更新的強制規則。

## 回復
保留上一次成功部署及 Git commit SHA；發現資料錯誤先停用更新工作流程，再回復到已驗證版本。不得以假行情取代。
