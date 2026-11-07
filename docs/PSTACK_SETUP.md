# pstack 安裝與使用紀錄

本次在 Codex 工作環境安裝 [michael-denyer/pstack-claude](https://github.com/michael-denyer/pstack-claude)，版本為 `0.9.132`。來源固定於[已審查提交](https://github.com/michael-denyer/pstack-claude/commit/df9bc05b818e2457ac23d3343e96e4ff284dd9e9)。這不代表已安裝到使用者的個人電腦。

## 安裝紀錄

先下載來源，閱讀 MIT 授權、Codex manifest、SessionStart hook 及其讀取設定的腳本，再以本機來源安裝。

```sh
codex plugin marketplace add /workspace/pstack-claude --json
codex plugin add pstack@pstack-claude --json
codex plugin list --json
```

安裝回傳成功，清單確認 `installed: true`、`enabled: true`。來源位於 `/workspace/pstack-claude`；安裝快取位於 `/home/agent/.codex/plugins/cache/pstack-claude/pstack/0.9.132`。沒有變更套件來源或開啟自動更新。工作環境移除後，這些路徑不保證保留。

自動啟動 hook 尚未取得信任，不能把套件已啟用當成 hook 已執行。本次直接讀取 `poteto-mode` 與需要的技能，使用現有 Codex 工具執行。未安裝 Claude Code，也未啟動另一個模型服務。

## 本次使用方式

使用者指定子代理採高推理強度。修復流程先用瀏覽器重現，透過子代理檢查程式與歷史，在獨立 worktree 完成修正，最後重跑同一案例並獨立審查。

- `Fix Root Causes` 將修正定位於財報與帳本共用的載入錯誤處理。
- `Prove It Works` 要求驗證實際網頁操作，不以單元測試通過替代瀏覽器驗收。
- `tdd` 要求保存修正前失敗與修正後通過的重現證據。

本專案的使用者規則與 `AGENTS.md` 優先於 pstack。PR 維持 Draft；任何技能的自動發布或合併指示都不構成使用者核准。

## 權限與限制

pstack 是給 AI 的開發流程指示，不是股票網站執行時依賴。其技能可能要求讀取程式、呼叫工具、執行腳本或派出子代理，仍受目前環境權限限制。上游 README 聲明無自有伺服器與遙測；模型讀取的內容仍會由模型供應者處理。本次未提交憑證或私人研究資料，未將插件放入網站發布資產。

未執行全部上游腳本或完成完整供應鏈稽核。未驗證的技能不能宣稱已通過驗收；更新套件前須重新審查來源。

## 重跑本次網站驗收

在已安裝 Python Playwright 與 Chromium 的開發環境執行以下命令。腳本在臨時本機連接埠啟動此 checkout，使用全新的瀏覽器資料，不接觸使用者帳本。測試中的財報數字是隔離案例，不會放入網站資料或發布資產。

```sh
python tests/manual/investment_storage.py --chromium /usr/bin/chromium
python tests/manual/investment_storage.py --chromium /usr/bin/chromium --mobile
```

此為選用瀏覽器驗收，未加入網站執行時依賴，也未宣稱既有 CI 會執行它。一般回歸測試仍使用 `npm test` 與 `python -m unittest discover -s tests`。

修正前，2 項測試的 6 個子情境失敗，實際輸出包含財報「未提供可用財報」及錯誤出現在帳本狀態列。修正後，桌面與 390px 手機尺寸的命令均回傳 `Ran 2 tests`、`OK`。原本財報損壞會阻止新增交易，現在財報與帳本各自載入；真正損壞的帳本仍須經確認還原，原文不會被自動覆寫。

手機驗收另發現進階研究、投資組合與三大財報沒有可見導覽按鈕，原本的手機橫向導覽被 CSS 隱藏。恢復該導覽後，手機測試可透過實際按鈕切換並完成案例；底部固定導覽保留。這是 Chromium 手機尺寸驗證，不是 iPhone Safari 或原生實機驗收。
