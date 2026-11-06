# 字型

- `BpmfHuninn-subset.woff2`：注音字型「Bpmf Huninn」（ButTaiwan/bpmfvs，以 jf open 粉圓為基礎，SIL Open Font License / Apache 2.0），只保留口訣用到的字。授權說明見 `NOTICE-bpmfvs.txt`。
- 口訣新增了新的國字時，需要重新產生子集字型，否則新字會沒有注音（顯示一般字型）。重新產生的指令：

```
pyftsubset BpmfHuninn-Regular.ttf --text-file=口訣用字.txt --layout-features='*' --flavor=woff2 --output-file=fonts/BpmfHuninn-subset.woff2
```
