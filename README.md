# 유태현 축의금 장부 (gift-ledger)
가족 전용 앱. Cloudflare Worker가 앱 화면을 제공하고, 명단·입금 데이터는 PIN으로 보호되는 KV에 저장합니다.

- 주소: https://gift-ledger.yjjn2005.workers.dev
- 저장소에는 명단 데이터와 PIN이 없습니다 (코드만).
- 구성: `index.html`(앱) · `worker/`(API 로직, 앱과 동일한 검증 코드) · `build.py`(dist/worker.js 생성)
- 재배포: `python3 build.py` 후 Cloudflare Workers에 dist/worker.js 업로드 (KV 바인딩 GIFT_KV, 시크릿 PIN)
- 전체 백업: 앱 > 보관·설정 > JSON 전체백업 (CSV는 조회용)
