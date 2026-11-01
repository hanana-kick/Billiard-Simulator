# 화면 조작 기반 타격 회귀 테스트

일반 Rapier WASM CPU 경로의 실제 화면 조작을 검증하는 독립 테스트입니다. canonical WebGPU 검증용이 아닙니다. 기본 앱·테스트 설정을 변경하지 않습니다.

검사 항목: 3구·4구 연속 타격, 물리 정지와 접촉 이벤트 기반 점수·턴, 세기·기울기·타점 설정, undo/redo 상태 복원, 화면에서 검색한 경로 적용 후 실제 득점. 스크린샷 전에 기존 Pretendard 한국어 렌더링 검사를 수행합니다.

## 실행

원본 저장소의 잠긴 Playwright 의존성(@playwright/test 1.56.1)을 설치하고 앱을 빌드·실행한 뒤, 본인이 제어하는 Chromium의 정상적인 보호 설정을 유지한 상태에서 loopback CDP endpoint를 준비합니다. 이 테스트는 브라우저를 새로 실행하거나 보안 설정을 변경하지 않습니다. fixture는 인증정보가 없는 127.0.0.1 endpoint만 받습니다.

저장소 루트에서 실행합니다. 아래 포트는 본인의 앱·브라우저 포트로 바꿉니다.

```sh
APP_URL=http://127.0.0.1:8787 \
BILLIARD_CDP_ENDPOINT=http://127.0.0.1:9222 \
node node_modules/playwright/cli.js test \
  --config experiments/visible-shot-tests/playwright.config.cjs \
  --grep '^3구: two visible real strikes reach rest and exact undo/redo$'
```

각 케이스는 새 브라우저 프로필에서 따로 실행합니다. 같은 명령의 grep을 4구 연속 타격 또는 `3구: real visible search candidate scores through actual strike`, `4구: real visible search candidate scores through actual strike`에 맞춰 바꿉니다. 외부 실행자가 브라우저·서버를 정리하며, CDP fixture는 연결만 끊습니다.

브라우저 연결 실패·폰트 실패·물리 결과 불일치는 실패로 처리합니다. CPU 결과를 WebGPU 성공으로 표시하거나 검사를 mock으로 대체하지 않습니다. 결과 보고서·스크린샷·환경 정보는 이 소스 백업에 포함하지 않습니다.

`visible-shot-verification.spec.cjs` SHA-256:
`3100008ede3cdeb8b89379415a7e61e95133620d40a5ec056851f1257d063cdf`
