# 蒙蒙的拼音家園｜Phonics Burrow

給國小中低年級孩子自己操作的自然拼音與音節拆分學習網站。發音為英式，字庫依劍橋 YLE（Starters、Movers、Flyers）與 Kid's Box 整理。

## 第一次開啟網站

1. 到 repo 的 **Settings → Pages**，把 **Source** 改成 **GitHub Actions**。
2. 到 **Actions** 頁面，選「部署網站」→「Run workflow」。
3. 約 1～2 分鐘後，網站在 `https://hswenforwork.github.io/phonics-classroom/`。
4. 到 **Settings → Secrets and variables → Actions** → **New repository secret**，名稱填 `GOOGLE_TTS_API_KEY`，值填 phonics-kids 用的同一把 Google Cloud Text-to-Speech 金鑰。之後新增的字會自動產生英式語音。

之後每次修改都會自動重新部署。

## 網站有什麼

| 功能 | 說明 |
| --- | --- |
| 八個探險地點 | 地洞入口（CVC）→ 沙丘（二合字母）→ 金合歡樹（長母音組合）→ 岩石瞭望台（子音群）→ 綠洲水塘（magic e）→ 地道迷宮（音節拆分）→ 大草原（字尾）→ 星空營地（弱讀與例外字），全部開放 |
| 九步驟 | 聽音（放石頭）→ 看字 → 例外字 → 字尾 → 圈母音 → 標子音 → 切音節 → 判斷類型 → 拼讀（音格＋重音石頭）；不適用的步驟自動跳過 |
| 「?」提示視窗 | 上層是孩子看的口訣（附注音，點一下蒙蒙唸），下層「更多」是家長說明 |
| 出發探險 | 一趟 5～10 分鐘：巡邏暖身 3 個舊字（快速模式）＋ 2～3 個新字 |
| 每個地點 | 單字、我來拼、讀句子、小故事（探險越多解鎖越多頁）、聽聽看（最小對比） |
| 探險手冊 | 地道網（學會的規則點亮、一起用過的規則挖通）、深淺房間（間隔複習）、收集冊 |
| 我的地洞 | 用腳印章買家具佈置地洞 |
| 家長專區 | 設定、學習狀況、新增或修改單字（送到 GitHub）、管理孩子 |

進度只存在使用的那台裝置上，可以建立多個孩子。

## 自己維護內容

所有內容都在 `data/` 的 CSV 檔，欄位說明見 [data/README.md](data/README.md)。

- **新增或修改單字**：家長專區 →「新增或修改單字」→ 輸入一個英文單字 → 按「自動產生」→ 確認欄位 → 送出到 GitHub → 按 Submit。
  - 工具會查線上字典（優先英式音標；只有美式就自動轉成英式；查不到就依規則推測），再用自然發音規則填好地點、音節、音格、音節類型、重音、調皮字母、字首字尾，圖示和中文意思也會自動建議。
  - **黃色欄位**是工具沒把握的地方，下方有一行原因，請確認或修改；改過的欄位黃色會消失。
  - 已經在字庫裡的字會直接帶出目前內容，並顯示「這個字已經在第 N 站」；想讓工具重新判斷可按「重新自動產生」。
  - 「🔊 試聽」用瀏覽器語音先聽整個字和每個音節。
  - 送出後自動流程會檢查寫法並寫進 `data/words.csv`，結果留言在申請單上；接著「產生語音」流程會用 Google 英式語音（en-GB-Neural2-C）照音標產生整字和每個音節的音檔，約 3～5 分鐘後網站就有新語音。
- **直接改 CSV**：用 Excel 開啟後「另存新檔 → CSV UTF-8」，上傳覆蓋。
- **換圖片、換音檔**：把同檔名檔案上傳到對應資料夾，不用改 CSV：

| 素材 | 放在 | 例子 |
| --- | --- | --- |
| 單字圖片 | `images/words/` | `rabbit.png` |
| 嘴型示範圖 | `images/mouth/` | `æ.png`（檔名是 IPA） |
| 整字音檔 | `audio/words/` | `rabbit.mp3` |
| 音節音檔 | `audio/syllables/` | `rabbit-0.mp3`（第幾節，從 0 開始）或 `rab.mp3` |
| 單音音檔 | `audio/sounds/` | `a_short.mp3`（檔名見 `data/sounds.csv`） |
| 口訣語音 | `audio/rules/` | `L6-13.mp3`（檔名是規則編號） |
| 句子語音 | `audio/sentences/` | `T6-01.mp3` |

## 聲音從哪裡來

1. 本站的音檔（上表，包含自動產生的語音）
2. phonics-kids 的共用音檔（單音用你在 phonics-kids 設定的 Oxford 錄音，整字、音節用已產生的英式 AI 語音）
3. 瀏覽器內建語音（英文用英式、口訣用中文）

「產生語音」流程（`scripts/build_audio.py`）會替 phonics-kids 沒有音檔的字自動產生整字和音節語音；家長改了某個字的音標，也會重新產生。產生紀錄在 `audio/generated.json`。想手動重跑：Actions →「產生語音」→ Run workflow。

## 檔案結構

```
index.html, css/, js/        網站程式（js/autogen.js：自動產生單字欄位；js/vendor/pk-phonics.js：phonics-kids 的自然發音分析引擎）
data/                        字庫、句子、故事、對比、規則與口訣（CSV）
images/, audio/              你上傳的圖片與音檔
fonts/                       注音字型（口訣用）
scripts/                     自動流程用的小程式
.github/workflows/           部署網站、處理單字申請單、產生語音
```
