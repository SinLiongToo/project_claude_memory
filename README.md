# Memory Notes · 記憶體知識地圖

記憶體（SRAM / DRAM / NAND / 新興記憶體）的教學網站：從元件、設計、應用、製程、封測到可靠度，並附互動實驗室與規格設計器。純靜態 HTML/CSS/JS，不需要建置工具。

## 頁面

| 檔案 | 內容 |
|---|---|
| `index.html` | 首頁：知識流程、章節卡片、學習路線 |
| `device.html` | 1. 元件：階層、SRAM 6T、DRAM 1T1C、Flash、3D NAND、MRAM/ReRAM/PCM/FeRAM |
| `design.html` | 2. 設計：陣列組織、SA、時序、介面、refresh、ECC、修補、SRAM assist、NAND ISPP |
| `application.html` | 3. 應用：DDR5/LPDDR5X/GDDR7/HBM、AI 記憶體牆、SSD/FTL、車用、CXL |
| `process.html` | 4. 製程：DRAM 流程與電容、EUV、4F²/3D DRAM、3D NAND、良率 |
| `test.html` | 5. 封測：測試流程、故障模型、March、失效位元圖、KGD、封裝、HBM 堆疊 |
| `reliability.html` | 6. 可靠度：保存、row hammer、耐寫、軟錯誤、驗證、加速模型 |
| `lab.html` | 互動實驗室：DRAM 讀取、SRAM SNM、NAND Vt/RBER、Retention/Refresh、Row hammer、March 測試、Shmoo、晶圓良率、HBM 堆疊良率、每 Gb 成本 |
| `designer.html` | 規格設計器：DRAM / 3D NAND SSD / SRAM 巨集 |
| `lessons.html` | 業界案例與常見問題：公開案例（現象 → 根因 → 對策 → 教訓）與製程 / 測試 / 設計常見問題表 |
| `roles.html` | 職務地圖：記憶體公司各職位的必讀章節、工具與面試題 |
| `quiz.html` | 測驗：57 題，附解析與複習連結 |

`assets/`：`style.css`（共用樣式，深淺色）、`site.js`（導覽、搜尋、目錄）、`plot.js`（SVG 繪圖）、`lab.js`、`lab-fab.js`、`designer.js`、`quiz.js`、`search-index.js`（自動產生）。

## 中英文版

中文頁面在根目錄，英文頁面在 `en/`，檔名與段落 id 一一對應；頂部的 EN / 中 按鈕會切換到對應頁面的同一段落。
JS 介面文字用 `t('中文', 'English')` 依 `<html lang>` 切換；測驗題庫的英文版在 `assets/quiz.js` 的 `QEN`（順序與 `Q` 相同）。
修改中文頁面時，記得同步修改 `en/` 的對應頁面。

## 修改內容後

章節頁的 `<h2 id>`、`<h3 id>` 與名詞解釋會被收進全站搜尋（Ctrl+K）。改完頁面後重新產生中英文兩份索引：

```
python tools/build_index.py
```

## 本機預覽

直接用瀏覽器開 `index.html` 即可。

## 部署到 GitHub Pages

```
git init
git add .
git commit -m "Memory Notes"
git branch -M main
git remote add origin https://github.com/<帳號>/<repo>.git
git push -u origin main
```

接著在 GitHub repo 的 **Settings → Pages** 選 `main` 分支、`/ (root)`，網址會是 `https://<帳號>.github.io/<repo>/`。
