# 拼音家園 字庫資料說明

網站所有內容都來自這個資料夾的 CSV 檔。用 Excel、Numbers 或 Google 試算表打開編輯後，存回 CSV（UTF-8）上傳到 GitHub 即可，網站會讀取最新版本。

## 檔案一覽

| 檔案 | 內容 | 筆數 |
| --- | --- | --- |
| words.csv | 單字字庫（八個地點） | 181 |
| vowels.csv | 母音沙谷的卡片（一張卡一個母音，欄位見根目錄 README） | 21 |
| emoji.json | 自動產生單字時建議圖示用的「英文關鍵字 → emoji」對照表（可自行增修） | 約 1900 |
| sentences.csv | 讀句子練習 | 32 |
| stories.csv | 每個地點的小故事（一列一頁） | 37 |
| pairs.csv | 最小對比聽辨（ship／sheep 等） | 16 |
| sounds.csv | 共用單音音檔對照表 | 47 |
| rules.csv | 規則與口訣（實作時由規則清單文件轉出） | — |

## words.csv 欄位

> 最簡單的方式：家長專區 →「新增或修改單字」只輸入英文單字，按「自動產生」，下面的欄位會依自然發音規則自動填好（地點依這個字用到的最難規則判斷：例外字或不發音字母、弱讀 → 8；字首字尾 → 7；多音節 → 6；magic e、軟 c/g、y 當母音 → 5；子音群 → 4；母音組合、r 控制 → 3；二合字母 → 2；其他 → 1）。黃色欄位請確認後再送出。

| 欄位 | 範例 | 說明 |
| --- | --- | --- |
| id | S6-01 | 地點＋序號，不要改 |
| word | rabbit | 單字 |
| stage | 6 | 地點編號 1–8 |
| place | 地道迷宮 | 地點名稱（給人看的） |
| emoji | 🐰 | 圖示；空白就顯示文字卡 |
| meaning_zh | 兔子 | 中文意思（字義提示，預設關閉） |
| syllables | rab/bit | 音節，用 `/` 分隔，必須跟 IPA 的音節對齊 |
| sounds | r-a-b/b-i-t | 音格，用 `-` 分格、`/` 分音節（寫法見下方） |
| ipa | /ˈræb.ɪt/ | 英式音標 |
| types | C/C | 每個音節的類型（代碼見下方） |
| stress | 1 | 重音在第幾個音節 |
| tricky | ai | 例外字裡「調皮」的字母，會畫愛心 |
| suffix | swim+ing\|雙寫 | 字根＋字尾\|規則，第 4 步「字尾」使用 |
| source | Starters | 劍橋 YLE 字表級別；「補充」表示字表沒有、為教學需要加入 |
| boss | Y | 隊長挑戰字（每個地點一個） |
| checked | Y | 你確認過填 Y，沒填 Y 的字不會出現在網站 |

### sounds 的寫法

| 寫法 | 意思 | 例子 |
| --- | --- | --- |
| `-` | 分格（一個音一格） | `c-a-t` |
| `/` | 分音節 | `r-a-b/b-i-t` |
| `字母=音` | 這一格不照預設讀音 | `b-oo=ʊ-k`（book 的 oo 讀短音）、`s-i-x=ks` |
| `(e)` | magic e：不佔格，跟前面的母音連線 | `c-a-k(e)` |
| `[字母]` | 不發音字母：淡灰色、不佔格 | `[k]n-ee`、`l-a-m[b]` |

預設讀音對照在 sounds.csv 的 graphemes 欄，例如 `ow` 預設 /əʊ/（snow），cow 要寫成 `c-ow=aʊ`。

### types 代碼

| 代碼 | 類型 |
| --- | --- |
| C | 閉音節 |
| O | 開音節 |
| E | 魔法 e |
| T | 母音組合 |
| R | r 控制 |
| D | 雙母音 |
| L | 子音＋le |
| W | 例外（星空營地） |
| S | 尾巴零件（tion、ture、sion 整塊念） |

## 圖示與音檔：用檔名對應，不用改 CSV

把同名檔案上傳到對應資料夾，網站就會自動改用它；沒有檔案時用預設（emoji、AI 語音）。

| 素材 | 放在 | 檔名 | 例子 |
| --- | --- | --- | --- |
| 單字圖片 | images/ | 單字.png | images/rabbit.png |
| 整字音檔 | audio/words/ | 單字.mp3 | audio/words/rabbit.mp3 |
| 音節音檔 | audio/syllables/ | 音節.mp3 | audio/syllables/rab.mp3 |
| 單音音檔 | audio/sounds/ | sound_id.mp3（見 sounds.csv） | audio/sounds/a_short.mp3 |
| 口訣語音 | audio/rules/ | 規則編號.mp3 | audio/rules/L6-13.mp3 |
| 句子與故事 | audio/sentences/、audio/stories/ | 編號.mp3 | audio/sentences/T6-01.mp3 |

## 其他檔案欄位

- **sentences.csv**：id、stage、place、text（英文句子）、meaning_zh、checked
- **stories.csv**：stage、place、title_zh、page（頁碼）、text、meaning_zh、checked
- **pairs.csv**：rule（對應規則清單 P-01 等）、word_a、word_b、sound_a、sound_b、stage
- **sounds.csv**：sound_id（也是音檔檔名）、ipa、graphemes（哪些拼法預設讀這個音）、examples、audio_file
