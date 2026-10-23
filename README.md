# Billiard Simulator · Cue Lab

실제 Base UI 기반 shadcn/ui와 Rapier 3D를 사용하는 물리 실험 웹앱입니다.

## 실행

Node.js 22 이상:

```sh
npm ci
npm run prepare:engine
npm run build
npm start
# http://localhost:8787
```

빌드 결과는 `dist/` 및 `standalone.html`입니다. 실제 React·Base UI·물리엔진이 함께 번들되어 실행 시 CDN 연결이 필요하지 않습니다. `dist/`를 정적 호스팅할 수 있습니다.

## GitHub Pages

저장소 **Settings → Pages → Build and deployment → Source = GitHub Actions**를 한 번 선택해야 합니다. 이후 `main` 푸시는 `.github/workflows/pages.yml`을 통해 빌드·회귀·실제 브라우저 E2E를 통과한 경우에만 배포됩니다. 설정 전에는 공개 사이트가 활성화된 상태가 아닙니다.

검색 기준 주소: https://dangoo.hananakick.cc/

`public/CNAME`과 canonical·Open Graph·JSON-LD·사이트맵은 이 주소를 사용합니다. 도메인을 변경할 때 함께 수정해야 합니다. DNS 연결 및 HTTPS 인증서 발급은 호스팅 설정에서 별도로 확인해야 합니다.

설정을 변경한 뒤 Actions의 **Test and deploy GitHub Pages → Run workflow**로 실행할 수 있습니다. PR에서는 테스트만 수행하고 배포하지 않습니다. 실패한 검사의 스크린샷·trace 및 브라우저 보고서는 `browser-evidence`, 빌드 결과는 `compiled-app` artifact에 보관됩니다.

## 화면과 조작

`타격 / 경로 / 전체 설정`은 같은 패널의 내용을 바꾸는 공식 Base UI Tabs입니다. 탭을 바꿔도 물리 월드, 공 위치, 타격 설정과 계산 결과를 유지합니다. 모바일에서도 당구대와 탭을 유지하고 패널 내부를 스크롤합니다.

- 타격: 수구·타점·세기·조준·경사. 큐 뒤쪽은 조준, 공 가까운 손잡이는 당기기입니다.
- 경로: 두 공 직접 맞히기, 방법별 3쿠션 탐색, 후보 적용. 계산/적용만으로 발사하지 않습니다.
- 전체 설정: 표시·재생, 공 배치·추가·삭제, 재질·중력, 접촉 기록.

모바일은 조준 패드·미세 조준·두 손가락 확대를 지원합니다. 당기는 중 두 번째 손가락을 올리면 타격을 취소합니다. 공이 움직이는 동안 큐는 숨겨집니다.

## 한국어 검색과 에이전트 탐색

당구 연습·3구(삼구)·4구(사구)·3쿠션(쓰리쿠션·스리쿠션) 검색에 맞춰 한국어 제목·설명, 공유 메타데이터와 WebApplication JSON-LD를 제공합니다. 종목별 공식 경기 모드나 채점을 지원한다는 의미는 아닙니다.

`public/guide.html`은 JavaScript 없이 읽는 사용법·모델 한계 안내이며, `public/llms.txt`는 AI 에이전트용 기능·용어·문서 링크입니다. `llms.txt`는 탐색 보조 문서이지 검색 노출 보장이나 크롤러 접근 제어 표준이 아닙니다. `robots.txt`와 `sitemap.xml`도 함께 배포합니다. `public/` 파일은 빌드 시 `dist/`로 복사됩니다. 안내 문서는 정적 배포 디렉터리에서 제공되며, `standalone.html` 단일 파일에는 포함되지 않습니다.

## 검증

```sh
npm test
npm run test:provenance
npx playwright install chromium
npm run test:e2e
```

E2E는 별도 모형 UI가 아닌 실제 배포 빌드에서 실행합니다. 세 탭과 상태 유지, 모든 설정의 접근·값 반영, 9개 재질 슬라이더의 실제 표시·키보드 입력, 5개 화면 크기, 터치·핀치 취소, 3쿠션 검색·적용·타격, 전체화면 팝업, CDN 미사용을 검사합니다.

`BROWSER_EXECUTABLE`로 설치된 Chromium 경로를 지정할 수 있습니다. `APP_URL`은 이미 실행 중인 정적 서버의 주소입니다. 네트워크 탐색이 제한된 환경에서는 `LOCAL_HTML=/절대경로/standalone.html`로 동일 HTML을 브라우저에 직접 로드해 시험할 수 있습니다. CI에서는 실제 HTTP 서버를 사용합니다.

## UI 출처와 모델 한계

`src/components/ui/`는 공식 shadcn/ui Base UI 컴포넌트입니다. 16개 원본의 출처·해시는 `vendor/shadcn/`에 있고, Tabs는 공식 CLI로 설치했습니다. 앱 고유 타점·큐·캔버스 조작만 별도로 구현합니다. 자체 Slider/Select/Switch 대체 구현을 사용하지 않습니다.

공·큐의 운동은 3D 강체 및 접촉 재질 모델의 결과입니다. 예측은 동일 물리 월드의 복제 실행이며, 경로 탐색은 유한 후보 중 최선을 찾습니다. 실제 당구대 실측 보정·전역 최적해·실물 명중을 보장하지 않습니다. 과거 문서는 `docs/`에 보존하며 현재 사용 방법은 이 README를 기준으로 합니다.
