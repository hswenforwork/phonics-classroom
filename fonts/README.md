# 字型

孩子會看到的中文都用注音字型「Bpmf Huninn」顯示（每個孩子可在家長專區關掉「顯示注音」）。

| 檔案 | 說明 |
| --- | --- |
| `BpmfHuninn-subset.woff2` | 網站實際載入的字型，只含網站用到的字（含破音字的各讀音）。**部署時自動產生**（`scripts/build_zhuyin.py`），新增文字不用手動處理 |
| `src/BpmfHuninn-Regular.ttf` | 完整注音字型（ButTaiwan/bpmfvs，以 jf open 粉圓為基礎，SIL Open Font License） |
| `src/phonic_table_Z.txt` | 破音字的讀音順序（對應字型的 IVS 編號），出自 bpmfvs |
| `src/poyin_db.txt` | 破音字常見詞語（bpmfvs 讀音選擇工具，依教育部《國語一字多音審訂表》），Apache 2.0 |
| `src/tsi-poly.txt.gz` | 新酷音詞庫（libchewing `tsi.src`）裡含破音字的詞與注音，LGPL-2.1，© Chewing Core Team |

授權說明見 `NOTICE-bpmfvs.txt`。

## 破音字

字型預設顯示最常見的讀音。部署時會依序判斷每個破音字的讀音，在字後面加上 IVS 選字符號：

1. 家長指定：`data/zhuyin-fix.csv`（`char` 字、`pattern` 詞語，`*` 代表這個字、`reading` 注音）
2. 教育部一字多音審訂表的常見詞語
3. 新酷音詞庫（有輕聲變體時用輕聲，例如「兔子」的「子」）
4. 這個字單獨使用時，預設讀音佔 85% 以上（例如「的」）就用預設讀音

都判斷不了的列在家長專區「破音字確認」，選好讀音送出後會寫進 `data/zhuyin-fix.csv`。
