#!/usr/bin/env python3
"""index.html + worker/logic.js -> dist/worker.js (배포용 단일 모듈)"""
import json, os
t = open('worker/worker.template.js', encoding='utf-8').read()
out = t.replace('__LOGIC__', open('worker/logic.js', encoding='utf-8').read()).replace('__HTML__', json.dumps(open('index.html', encoding='utf-8').read(), ensure_ascii=False))
os.makedirs('dist', exist_ok=True)
open('dist/worker.js', 'w', encoding='utf-8').write(out)
print('dist/worker.js', len(out))
