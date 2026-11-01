# Cursor 插件第二輪導入結果

## 結論
本輪完成來源審查與網站回歸測試，沒有插件達到完整啟用條件。依「失敗停止，不繞過」要求，四個插件均未安裝或啟用，未建立有效 MCP 設定。此 PR 保留 Draft，不能視為導入成功或部署授權。

基準：專案 PR head 1527bafccbb1a9876ac744cc3d8dc6162217d795；上游 cursor/plugins Commit ae5650febf4320793844c12c4adaa937f417f8da。完整非圖片插件檔案與 Git blob SHA 列於 cursor-plugins.lock.json；該檔是審查清單，不是 npm lockfile，也不會控制 Cursor 載入。

## 四個插件
| 插件 | 安裝狀態 | 風險／阻擋 | 恢復條件 |
| --- | --- | --- | --- |
| GitHub | 停止，未啟用 | 高：PAT 授權、遠端服務與工具回應信任邊界 | 使用者另行授權專用最小權限帳號；測試 read-only 工具範圍與 client 相容性 |
| Playwright | 停止，未安裝 | 高：浮動 npm 版本、依賴與瀏覽器未驗證 | 取得精確版本 tarball、來源與 integrity，鎖定完整依賴，在無機密隔離環境測試 |
| Thermos | 停止，未安裝 | 中：可擴大修改範圍；Cursor agent/Task 語法未實測 | 將範圍限制成純審查、禁止自主修復與提交；於 Cursor 實測 |
| Agent Compatibility | 停止，未安裝 | 高：浮動 npm CLI 版本、套件身分與依賴未驗證 | 驗證 CLI 發布來源、精確版本與依賴後才可執行 |

## 原始碼、授權與證據
完整讀取四個目錄內全部非圖片檔案，包括 plugin.json、README、CHANGELOG、LICENSE、所有 Skills/Agents、存在的 MCP 設定。圖片不作執行程式審查。四個 wrapper LICENSE 均為 MIT（2026 Cursor）；這不代表外部 MCP 執行程式或 npm 相依套件也是 MIT。

- third_party/github/.cursor-plugin/plugin.json：minClientVersions.cursor 為 3.13.0；宣告必填 GITHUB_PERSONAL_ACCESS_TOKEN。mcp.json 將其放入 Authorization Bearer，傳送至 https://api.githubcopilot.com/mcp/。沒有 npm、Skills 或 Agents。未發現其他外傳端點；遠端 server implementation 未完整取得、不能靠 wrapper commit 固定。
- third_party/playwright/mcp.json:5：npx -y @playwright/mcp@latest，違反版本固定要求。wrapper 沒有 Skills/Agents，實作位於 microsoft/playwright-mcp。wrapper MIT；實作儲存庫標示 Apache-2.0，必須另查實際 tarball LICENSE。
- agent-compatibility/agents/compatibility-scan-review.md:19：指示執行 npx -y agent-compatibility@latest；README 也有浮動版本命令。該插件不包含 CLI 原始碼或 npm lockfile。其他三個 agents 標記 readonly，但 startup/validation 仍會執行專案命令，標記不等於作業系統隔離。Skill 要求四個子代理，需 Cursor runtime 相容測試。
- thermos/skills/thermo-nuclear-code-quality-review/SKILL.md：Core Prompt 鼓勵大幅重構，不能等同唯讀審查。thermos README/plugin description 提及 optional take-the-wheel/FSD；thermos skill 要求背景子代理，使用 Cursor Task 的 subagent_type/run_in_background 語法。本輪只把這些當待審程式資料，沒有執行其指令。無 MCP、npm、shell entrypoint 或 lifecycle script 於此 wrapper。
- 所讀非圖片 wrapper 檔案未觀察到實際憑證值、curl-to-shell、明確竊取密鑰／覆寫系統指令。但這是人工靜態審查，不能排除提示注入、遠端 tool description 變動或外部依賴惡意程式。未取得的實作不宣稱安全。

## 已知風險
Playwright MCP GHSA-6fg3-hvw7-2fwq / CVE-2025-9611：低於 0.0.40 受 DNS rebinding 影響，0.0.40 為該漏洞修補版。此數字只是已知漏洞門檻，不是本案核准安裝版本，也不是全面安全保證。
來源：https://github.com/advisories/GHSA-6fg3-hvw7-2fwq
Microsoft 說明 MCP 本身不是安全邊界：https://github.com/microsoft/playwright-mcp
其他套件未完成 advisory/依賴完整比對，不宣稱「無已知漏洞」。

## 環境與測試
透過 GitHub 連接器取得固定 commit 的專案文字檔和公開圖示，在暫存副本執行；沒有執行第三方插件、沒有注入正式憑證。這不是已建妥的第三方安裝 sandbox。
npm registry HTTPS 連線測試逾時（curl exit 28）；Git clone 亦未取得可用 checkout，因此使用唯讀連接器取得檔案，沒有繞過網路限制。環境無 docker、chromium/google-chrome、Python playwright；沒有啟動 Cursor client。
- Python unittest：56 passed。
- Node --test tests/*.test.mjs：40 passed。
- Python compileall：passed。
- scripts/build_static.py：22 public assets。
- scripts/audit_coverage.py：執行成功，2172 筆 snapshot，無重複或無效識別碼；不代表資料全部欄位完整。
- 瀏覽器 E2E、插件安裝、MCP initialize/tools/list、提示注入動態攻擊、npm audit、tarball integrity、傳遞依賴、Cursor runtime：未執行／阻擋。
- 完整 Git 歷史及其他分支 secret scan：未完成；沒有把目前檔案審查誤稱全歷史掃描。
- iOS xcodebuild：未於 Linux 執行。

## Actions 與部署
quality-gate.yml 在 pull_request 執行 Python/Node 與 macOS iOS build，permissions contents:read；secret-scan.yml 在 PR 執行 detect-secrets==1.5.0，但其傳遞依賴未完整鎖定。兩者 actions 使用 v4/v5 標籤，仍有供應鏈固定版本改善空間，本輪不改既有工作流程。
update-data.yml 只有 schedule/workflow_dispatch，contents:write；未手動觸發或修改。所讀三個 workflow 無 Cloudflare 部署命令。外部 Cloudflare Build triggers、main 保護未驗證，不能據此推論推分支絕不觸發外部系統。

## 操作說明
不要執行 upstream 的 npx 浮動版本命令，也不要使用 /add-plugin 自動取得未審版本。cursor-plugins.lock.json 中 activation_allowed=false；所有項目 blocked。現有安全規則仍有效，但規則文字並非權限 sandbox。
取得可用 npm 存取與無機密的 Cursor 隔離測試環境後，先驗證套件精確版本、來源 commit、tarball SHA512、所有相依版本與授權，使用 ignore-scripts 安裝並檢查 lifecycle scripts，之後才按個別需求測試。需要帳號時另取得使用者確認，PAT 不得貼入 PR 或對話。
正式啟用前須有測試證據更新本報告與清單；不能只把狀態改成 passed。main、合併與正式部署仍禁止。
