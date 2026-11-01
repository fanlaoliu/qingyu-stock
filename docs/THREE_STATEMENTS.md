# 三大財報工作台

新增「三大財報」入口。2026-11-01實抓一般業官方原始資料166筆：上市損益／資產負債各46筆、上櫃各37筆。保留來源、期末、出表日期、擷取時間及原始欄位。單一接口失敗保留其舊資料，全部失敗不覆寫。金額單位與損益累計口徑尚未逐份核對，官方原始值不參與估值、TTM或回測。頁面時間採台灣時區。

完整三表匯入格式可從頁面下載：kind=three-statements、version=1、records陣列，每筆含code、periodStart、periodEnd、publishedAt、unit=TWD、scope=consolidated、durationBasis=explicit-range、sources三表來源及income／balance／cashFlow。所有欄位必須存在，缺值填null；現金流capex為正的現金資本支出。cashStart、cashEnd須為與現金流量表一致口徑的現金及約當現金。範本無假數值。

匯入時檢查日期與公告先後、HTTPS來源、單位、重複期間版本、資產=負債+權益、期末現金=期初現金+營業+投資+籌資+匯率影響（允許1TWD或百萬分之一的四捨五入誤差）。有缺值的等式不當作已勾稽。數值核對不等於查核原始報告真實性。

本機三表可依查詢日排除當時尚未公告資料；計算毛利率、營益率、淨利率、負債比、流動比率、營業現金流／淨利、自由現金流。年增只比較前一年完全相同起迄期間，前期非正值不算百分比；不以期末權益冒充平均權益計算ROE。官方原始資料另外顯示擷取時間，不能視為查詢日已知資料。

本機資料可獨立匯出，匯入會取代本機三表，請保留原始檔。與原有TTM匯入／App備份分開，不自動混用兩種資料口徑。本批未建立自動現金流、金融業、公司公告時間歷史、四季TTM組合；不宣稱已完成全市場完整財報。

驗證：Node 65項、Python 66項通過，27個公開資產建置成功。新增測試涵蓋三表勾稽、公告日篩選、同期比較、缺值、來源與單位拒絕、官方欄位與來源失敗保護。未合併或正式部署。

來源核對：
- https://data.gov.tw/dataset/91998 （上市一般業綜合損益表）
- https://data.gov.tw/dataset/94831 （上市一般業資產負債表）
- https://openapi.twse.com.tw/v1/swagger.json
- https://www.tpex.org.tw/openapi/swagger.json
- 實際四個接口列於scripts/update_statements.py，官方資料授權：https://data.gov.tw/license
