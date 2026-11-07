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

## 2026-11-02：可執行的離線來源驗證
新增 scripts/audit_cursor_sources.py，使用 Python 標準庫，不下載、不安裝、不執行插件。輸入為另外準備的固定來源快照；不要放在 Cursor 自動載入目錄。

操作：
```bash
python scripts/audit_cursor_sources.py /absolute/path/to/inert-cursor-plugins-snapshot
```

輸出為 JSON：檔案數、完整性錯誤、待審規則與行號。exit 0 僅代表清單中的文字檔 Git blob SHA 全部符合且無未審程式檔；exit 1 為完整性失敗；exit 2 為輸入／檔案讀取失敗。所有結果固定 activation_allowed=false，不能拿 exit 0 當安裝或執行授權。

檢查包含：
- 清單 schema、來源網址、Commit 格式、路徑安全、重複項目及必要 manifest/LICENSE。
- 原始位元組的 Git blob SHA，包含換行差異。
- 拒絕符號連結、遺漏檔案、超大文字檔、未列入清單的程式／hooks。
- 只輸出待審檔案、行號與規則，不列出可能含憑證的原文。
- 浮動版本、憑證介面、代理協作及擴大修改範圍提示；屬啟發式提醒，不是惡意程式或提示注入的完整偵測器。

本次從固定上游 Commit 重新取得 28 個非圖片檔案，實際執行工具：28/28 SHA 相符、0 完整性錯誤。提示數：浮動版本 10、憑證介面 5、代理協作 6、修改範圍 2；提示可能來自重複文件，不能當漏洞筆數。

本機回歸：Python 66 項（含 8 項新來源驗證測試）通過；Node 40 項通過；Python 編譯、22 個靜態資產建置通過。前一輪 GitHub CI 已通過 iOS 建置和 Secret Scan；本次提交的 CI 以 PR 最新執行結果為準。
28 個來源檔案只放在暫存審查快照，沒有提交到專案或載入 Cursor。圖片仍不校驗、不渲染；來源 Commit 與 Blob ID 一致性不等於上游作者身分／簽章驗證，SHA-1 也不是獨立的供應鏈信任保證。
npm registry 再次逾時，完整 npm 鎖定、MCP／Cursor 實機及瀏覽器 E2E 未完成。四個插件狀態不變，未啟用。沒有更動 CI 設定、main 或正式環境。

## 2026-11-02：Thermos 唯讀衍生候選插件
已實作 tooling/cursor/thermos-review-only，名稱 qingyu-thermos-review-only，版本 1.0.0-qingyu.1。這是依照固定來源審查概念重寫的獨立衍生插件，不是未修改的上游 Thermos，也不宣稱 Cursor 背書。
包含 plugin.json、兩個 readonly:true Agents、原 MIT LICENSE 與 NOTICE，共 5 個檔案。沒有 MCP、npm、Skills、hooks、shell entrypoint 或自動載入設定。未指定模型以免暗中引入模型選擇或其他付費服務。

代理只讀取父層提供的 diff／檔案摘錄，分別回報正確性／安全性與結構問題；缺少證據時要求摘錄。指令明訂不得編輯、執行專案命令、安裝、存取憑證、發布評論、提交、合併、部署或再啟動代理。此為文字政策與 client metadata，不是 OS 沙箱，也尚未證明能抵抗動態提示注入。

準備封裝：
```bash
python scripts/package_cursor_review.py /absolute/path/to/new-review.zip
```
輸出位置的父目錄須已存在，檔案不得存在。只產生惰性 ZIP，不複製至使用者插件目錄、不建立 symlink、不修改個人 Skills，不連網、不啟動 Cursor。請勿在 Cursor 實機驗證前將其安裝或啟用。

工具核對獨立的 thermos-review-only.integrity.json（SHA-256）；拒絕非預期檔案／hooks、漏檔、symlink、路徑穿越、內容不符及覆寫輸出。ZIP 具有固定條目順序與時間戳，兩次封裝位元組一致。該完整性清單與程式須一起接受程式碼審查；它不是作者簽章或防止整個儲存庫遭竄改的信任根。

已在無第三方安裝／無注入正式憑證的暫存目錄執行封裝，ZIP CRC 檢查成功，5 個檔案；暫存封裝已清除。沒有啟動模型或 Cursor 代理，沒有冒稱動態測試通過。新增 7 項封裝測試，本機 Python 合計 73 項通過，Node 40 項通過；Python 編譯與 22 個公開資產建置通過。

狀態：Thermos 的唯讀衍生版本已備妥並完成靜態／離線封裝驗證；上游插件與衍生版本仍未安裝／啟用，待無機密 Cursor client 實機驗證。GitHub 的帳號授權、Playwright／Agent Compatibility 的精確 npm 版本與依賴驗證仍未完成，未以衍生包代替這些檢查。
