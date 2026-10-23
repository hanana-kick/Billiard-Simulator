# Billiard Simulator · Cue Lab

Rapier 3D 강체 물리엔진에 공·큐·테이블을 배치한 웹앱입니다. 타점으로 공의 진행·회전을 직접 지정하지 않고, 접촉 힘과 마찰로 계산합니다.

## 실행

```sh
npm ci
npm run prepare:engine
npm run build
npm start
```

`http://localhost:8787`에서 실행합니다. Node.js 22 이상이 필요합니다. 기본 서버는 `0.0.0.0:8787`이며 로컬 전용 실행은 `HOST=127.0.0.1 npm start`입니다.

## UI

실제 `@base-ui/react` 기반 shadcn/ui 컴포넌트를 사용합니다. **타격 / 경로 / 전체 설정**은 하나의 설정 패널을 전환하는 탭이며, 당구대·물리 월드·입력값·검색 결과는 탭을 바꿔도 유지됩니다. 별도 전체 설정 버튼이나 설정 페이지는 없습니다.

- 타격: 공 선택, 타점, 큐 세기, 조준·경사 0.01° 조절.
- 경로: 두 공 직접 맞히기와 방법별 3쿠션 검색, 목표·순서·검색량 설정, 경로 적용.
- 전체 설정: 표시·재생, 공/블록 배치·추가·삭제, 9개 물리 재질, 접촉 기록.

큐 뒤쪽은 조준, 공 가까운 쪽은 당기기입니다. 타격 후에는 공이 멈출 때까지 큐를 숨깁니다. 터치 조준 패드·미세 조준·두 손가락 확대를 지원합니다.

## 빌드와 GitHub Pages

배포판에는 React·Base UI·Rapier까지 번들합니다. 방문자의 브라우저가 CDN에서 UI 의존성을 내려받지 않습니다. `dist/index.html`, `dist/icon.svg`, `.nojekyll`을 Pages에 올립니다. 경로는 상대경로를 사용해 저장소 하위 주소에서도 실행됩니다.

GitHub **Settings → Pages → Build and deployment → Source: GitHub Actions**를 한 번 선택해야 합니다. `main`에 푸시하면 물리/소스 검사와 실제 전체 UI 브라우저 테스트를 수행하고, 모두 통과한 빌드만 배포합니다. PR에서는 검사만 실행합니다. Actions의 `Build, test and deploy Pages`에서 수동 재실행할 수도 있습니다.

예정 주소: `https://hanana-kick.github.io/Billiard-Simulator/`. 실제 공개 여부는 Actions 배포 결과를 확인하세요.

## 테스트

```sh
npm run build
npm test
npm run test:provenance
npx playwright install chromium
npm run test:e2e
```

전체 UI 검사는 실제 번들된 앱에서 탭 전환, 상태 유지, 설정 값 반영, 좁은 화면 스크롤, 터치, 3쿠션 경로 적용을 수행합니다. 테스트용 대체 UI를 사용하지 않습니다. 실패 시 CI가 스크린샷과 trace를 보관합니다.

## 물리·탐색 한계

실제 장비에 맞춰 보정되지 않은 강체·접촉 근사 모델입니다. 예측과 재실행의 일치는 같은 모델의 일관성이지 실물 정확도 보장이 아닙니다. 경로 검색은 유한한 후보 중 성공 경로를 찾으며 전역 최적성이나 모든 배치에서의 성공을 보장하지 않습니다. 샷 이름은 `src/route-rules.js`의 명시적 접촉 조건으로 판정합니다.

공식 컴포넌트 원본·라이선스·출처는 `vendor/shadcn/`과 `THIRD_PARTY_NOTICES.txt`에 보존합니다.
