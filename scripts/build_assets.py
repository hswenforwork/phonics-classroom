"""列出 audio/、images/ 裡實際存在的檔案，寫成 assets.json（部署時自動執行）。"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files = []
for top in ('audio', 'images'):
    for d, _, names in os.walk(os.path.join(ROOT, top)):
        for n in names:
            if n.lower().endswith(('.mp3', '.m4a', '.wav', '.png', '.jpg', '.jpeg', '.webp', '.svg')):
                files.append(os.path.relpath(os.path.join(d, n), ROOT).replace(os.sep, '/'))
with open(os.path.join(ROOT, 'assets.json'), 'w', encoding='utf-8') as f:
    json.dump({'files': sorted(files)}, f, ensure_ascii=False)
print(len(files), 'files')
