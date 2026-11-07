# 選用Cloudflare AI研究後端

狀態：程式與隔離測試已實作；未啟用帳戶綁定、未實際推論、未正式部署。此文件不是已完成AI生產驗收證明。

## 設計

`research-worker.mjs`處理`POST /api/research`；其他一般路徑交由ASSETS，未知API回404。網站靜態資產由原本Cloudflare Assets提供，`/api/*`先執行Worker。後端檔案、套件、文件、交易帳本與測試檔不在公開資產白名單內。

API僅接受`{code,question}`，不接受客戶端持股、成本、筆記或財報。伺服器自己從ASSETS讀取官方快照，限制行情7日內。前端按鈕明確說明代號與問題會送至Cloudflare AI；未按下時不發送推論請求。不要在問題填入個資或機密。

固定模型為`@cf/meta/llama-3.3-70b-instruct-fp8-fast`，以Cloudflare AI binding呼叫，不需要把供應商API金鑰放進瀏覽器。模型上限800輸出tokens，輸入問題500字／請求8192bytes。`[S1]`、`[S2]`、`[S3]`為伺服器指定的行情、估值、營收來源；缺少或未知來源ID會拒絕回覆。**僅驗證來源ID，不保證逐句陳述受來源支持，仍須人工閱讀。**不執行工具、不抓取模型產生的網址，模型輸出以純文字顯示。

## 啟用所需設定（本批未設定）

1. 預覽環境先建立Cloudflare Access應用與允許名單，取得該應用audience與team domain。靜態Assets情境不依賴`ctx.access`，而以jose驗證`Cf-Access-Jwt-Assertion`的RS256簽章、issuer、audience、exp、iat與sub。不可改成只檢查header存在。
2. 配置`AI`模型binding與`RESEARCH_RATE_LIMITER`速率限制binding；帳戶命名空間須獨立選擇，避免與其他服務混用。模型條款、配額與費用須先確認。
3. 設定`ACCESS_TEAM_DOMAIN`（精確HTTPS team domain）、`ACCESS_AUD`、`RESEARCH_ORIGIN`（精確HTTPS網站origin，不含路徑）。預覽與正式環境各自設定，不共用正式身分範圍。
4. 最後才設定`AI_ENABLED=true`。缺任何一項，API回503且不呼叫模型。現有wrangler沒有AI binding或啟用旗標，預設關閉。
5. 前端問題與代號通過同源、Access身分及速率檢查後才送模型。無CORS許可，不接受跨origin或無Origin推論請求。身份驗證或上游錯誤不回傳原始例外或token，不記錄問題／帳本。

binding設定形狀（需合併到選定環境；不是可直接採用的帳戶配置）：

```json
{
  "ai": {"binding": "AI"},
  "ratelimits": [{
    "name": "RESEARCH_RATE_LIMITER",
    "namespace_id": "選定帳戶內獨立的正整數字串",
    "simple": {"limit": 5, "period": 60}
  }]
}
```

速率限制是每Cloudflare位置的近似限制，不是全帳戶費用硬上限。啟用前應建立帳戶用量警示與關閉開關；本批未驗證帳戶費用政策。推論逾時不代表供應商一定取消計費。後端沒有修改網站原本的公開／私人範圍；新增API獨立要求有效Access token。網站是否應整站保護另需查核。

## 驗證

隔離測試使用即時產生的RSA簽章與模擬JWKS，檢查真簽章、偽造內容、錯誤issuer／audience、過期與未來iat。另測試預設關閉、偽造header、跨origin、速率拒絕、請求格式／大小、僅伺服器資料、過期快照、來源標記、上游錯誤遮蔽及靜態路徑。沒有將測試token、私鑰或實際帳戶識別寫入檔案。

待驗證：Cloudflare預覽實際binding、Access登入、模型可用性、授權與費用、繁體中文品質、引用正確率、拒答與提示注入評估、真實iPhone使用流程。全部通過後再審核正式發布。

## 官方介面依據（2026-11-01查閱）

- [Workers AI binding](https://developers.cloudflare.com/workers-ai/configuration/bindings/)
- [模型輸入與輸出](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/)
- [Access JWT驗證](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Assets與ctx.access限制](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
- [速率限制binding與精確度](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
