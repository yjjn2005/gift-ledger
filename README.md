# gift-ledger — 유태현 축의금 장부
가족(3명) 전용 축의금 기록 앱. GitHub Pages(화면) + Cloudflare Worker(gift-ledger-api, KV GIFT_LEDGER_SYNC) PIN 동기화 구조.

- 앱: https://yjjn2005.github.io/gift-ledger/
- API: https://gift-ledger-api.yjjn2005.workers.dev (PIN 헤더 필요)
- 저장소에는 명단 데이터와 PIN이 없습니다. 명단은 KV에만 있고, PIN은 Worker 시크릿(초기값) 또는 앱의 'PIN 변경'으로 KV에 저장됩니다.
- `index.html` 화면 / `worker/worker.js` API (KV 바인딩 GIFT_KV, 시크릿 PIN)
- 전체 백업: 앱 > 보관·설정 > JSON 전체백업 (CSV는 조회용)
