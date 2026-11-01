# 당구 시뮬레이터 v3 소스 체크포인트

수정 소스·테스트·빌드 도구만 보존한 백업입니다. 운영 배포나 macOS Chrome 문제 해결 완료본이 아닙니다. 상세 실행 환경·자원 측정 보고서는 이 공개 체크포인트에 포함하지 않았습니다.

## 구성

- divide: 탐색용 컴파일러 소스
- selected-divide: 선택 타격용 컴파일러 소스
- app-integration: 앱 연결 소스
- app-candidate: 경로 지정형 재빌드 도구 및 UI 테스트

각 디렉터리의 source-inventory.json 또는 portable-source-inventory.json으로 소스 해시를 확인할 수 있습니다. 바이너리·생성된 계산 artifact·node_modules·실행 로그는 포함하지 않습니다.

## 복구

원본 저장소의 ee1c1cfca7a930eaa8d376a009da6f0aad2c08e6 커밋을 별도 original 디렉터리에 준비하고, 원본 package-lock 의존성을 준비합니다. app-candidate/REPRODUCING.md에 따라 각 소스 디렉터리와 출력 경로를 지정해 9단계를 순서대로 실행합니다. 해시 불일치는 실패이며 기대 해시를 바꿔 통과시켜서는 안 됩니다.

이 체크포인트의 소스 복구 및 재빌드 절차는 별도로 실행해 확인했습니다. 실제 브라우저 화면의 전체 GPU 흐름과 macOS Chrome/Metal 호환성은 여전히 미검증입니다. 공개 백업 저장과 운영 배포는 별개입니다.
