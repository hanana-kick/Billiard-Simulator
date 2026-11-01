# 릴리즈 통합 소스 백업

이 디렉터리는 소스 백업입니다. main 반영·운영 배포·릴리즈를 실행하지 않습니다. 실제 브라우저 WebGPU 타격 검증을 완료하기 전에는 배포하면 안 됩니다. 일반 Rapier CPU 타격 테스트는 그 검증을 대신하지 않습니다.

## 복구와 빌드

1. Billiard-Simulator 저장소의 `ee1c1cfca7a930eaa8d376a009da6f0aad2c08e6` 커밋을 별도 디렉터리에 준비합니다.
2. `overlay/` 내용을 해당 디렉터리에 상대 경로 그대로 복사합니다. `source-manifest.json`과 분할 소스 목록의 SHA-256을 확인합니다.
3. 원본 package-lock 의존성을 준비한 뒤 `npm run prepare:engine`, `npm run build:release`를 실행합니다. 자세한 절차는 overlay/COMPILED-RELEASE.md에 있습니다.

컴파일러 소스·런타임 소스·빌드 도구·테스트만 포함합니다. 생성된 CSS/UI 메타데이터는 빌드에서 재생성하며, scheduler WASM은 원본 커밋의 기존 검증된 파일에서 복원합니다. 이 백업에는 dist·바이너리·node_modules·실행 로그·상세 환경 보고서·스크린샷·개인 경로 설정을 포함하지 않습니다.
