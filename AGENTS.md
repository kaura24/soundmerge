# Agent Operating Contract

이 파일은 어느 프로젝트 폴더에 복사해도 동작하는 AI 작업 계약서다.

`AGENTS.md`는 AI가 어떻게 일할지를 정하고, `ARCHITECTURE.md`는 폴더 구조와 경로 정책을 정한다. AI는 작업을 시작할 때 이 파일과 `ARCHITECTURE.md`를 함께 읽고, 더 보수적인 규칙을 따른다.

이 문서의 모든 프로젝트 내부 경로는 이 `AGENTS.md`가 놓인 폴더를 기준으로 한 상대경로다. 사용자 홈 폴더, Google Drive의 실제 절대경로, 특정 PC 경로를 이 문서에 하드코딩하지 않는다.

## Sound Forge 프로젝트 오버라이드

이 저장소는 템플릿 원본이 아니라 `FRAMEWORK_MODE=project`인 Sound Forge 실제 프로젝트다. 이 섹션은 아래의 범용 템플릿 규칙보다 우선한다.

```text
필수 플랫폼 세트       → macOS Universal (x64 + arm64)
MVP 제외 플랫폼        → Windows, Linux
최종 릴리즈 조건       → x64/arm64 패키징 검증을 통과한 동일 macOS Universal 앱
Windows 릴리즈 조건    → 이 프로젝트의 MVP에는 적용하지 않음
```

아래 문서의 “Mac/Windows 모두 성공” 또는 “반쪽 릴리즈” 규칙은 PRD가 두 플랫폼을 요구하는 프로젝트에만 적용한다. Sound Forge에서는 Intel Mac과 Apple Silicon Mac 검증이 그 플랫폼 세트 조건을 대신한다.

프로젝트 적용 모드이므로 `PRD.md`와 `ARCHITECTURE.md`가 허용한 `src/`, `tests/`, `config/`, `assets/`, `releases/`, `test-results/`를 실제 앱 구현에 사용할 수 있다.

## 운영 파일

AI는 작업 전에 아래 파일과 허용된 작업 폴더를 역할에 맞게 확인한다.

```text
./AGENTS.md       # AI의 실행 정책, 금지 행동, 강제 절차
./ARCHITECTURE.md # 폴더 아키텍처, 경로 계약, 빌드/릴리즈 규칙
./PRD.md          # 앱 개발 시작점, 템플릿 원본에서는 빈 파일
./LESSONS.md      # 실제 프로젝트에서 어려운 문제를 해결한 기록
./HANDOVER.md     # 실제 프로젝트에서 다음 AI에게 넘길 한 일 / 해야 할 일
./.gitignore      # Git에 올라가면 안 되는 파일 차단
./scripts/setup/preflight     # 스택 중립 사전 점검 스크립트 (bash, Mac/Linux/WSL용)
./scripts/setup/preflight.ps1 # 스택 중립 사전 점검 스크립트 (PowerShell, Windows용)
./local.paths.env # 템플릿 원본에서는 빈/동적 경로 변수 파일, 프로젝트 적용 후 머신별 실제 값 입력
./.env.secret     # 템플릿 원본에서는 빈 비밀값 파일, 필요 시 사용자가 환경 변수 직접 입력, Git 제외, 내용 접근 금지
./RESEARCH/       # 명시적 deep research 요청 때만 생성하는 연구 작업장, Git 제외
./test-results/   # 프로젝트 적용 모드에서 최종 테스트 결과 요약만 보관, Git 제외
```

`PRD.md`, `LESSONS.md`, `HANDOVER.md`는 템플릿 원본에서는 빈 파일이어야 한다. 실제 프로젝트에 복사되어 적용된 뒤에만 내용을 채운다.

## 파일 최소화 원칙

Google Drive 프로젝트 폴더에는 반드시 필요한 파일만 둔다. AI는 편의를 이유로 보조 파일, 임시 문서, 중간 산출물, 대체 설정 파일을 늘리지 않는다.

Drive에 남겨야 하는 것은 재건 가능한 소스/설정과 최종 산출물뿐이다. 실행 환경, 테스트 환경, 캐시, raw 로그, trace, coverage 원자료처럼 다시 만들 수 있는 파일은 Drive 밖의 `LOCAL_ROOT` 아래에 둔다.

기본값은 새 파일 생성이 아니라 기존 파일 수정이다. 새 파일은 기존 파일 업데이트로 해결할 수 없고, 이 문서와 `ARCHITECTURE.md`가 허용하는 위치와 조건을 모두 만족할 때만 만든다.

`RESEARCH/`는 예외적으로 허용되는 작업장이다. 단, 사용자가 명시적으로 deep research, 외부 비교 분석, 베스트 프랙티스 조사를 요청한 경우에만 만들 수 있고, 연구 결과 중 실제 운영 규칙으로 채택할 내용은 반드시 `AGENTS.md` 또는 `ARCHITECTURE.md`에 반영한다. `RESEARCH/` 자체는 Git에 올리지 않는다.

스킬이나 MCP 도구가 정상 동작을 위해 특정 작업 폴더, 상태 폴더, 캐시 폴더, 산출물 폴더를 요구하는 경우도 예외적으로 허용한다. 단, 도구 문서나 스킬 지침에 명시된 경로만 사용하고, 임의 이름의 대체 폴더를 만들지 않는다. 이런 도구 산출물은 기본적으로 Git 제외 대상이며, 운영 규칙으로 채택할 내용만 기존 MD 문서에 반영한다.

## Google Drive 준비 상태

소스가 Google Drive 안에 있는 것은 허용한다. 단, AI는 Drive를 로컬 실행 환경처럼 취급하지 않는다.

작업 전 확인:

```text
1. 프로젝트 파일이 Finder/Explorer에서 실제로 접근 가능한 상태인지 확인한다.
2. Drive가 streaming 모드라면 필요한 소스 파일이 로컬에서 열릴 수 있어야 한다.
3. 동기화 충돌 파일, 중복 사본, 임시 업로드 파일이 보이면 원인을 확인하기 전까지 빌드/커밋/push를 하지 않는다.
4. 의존성, 캐시, 빌드 작업장, 테스트 실행 환경은 Drive 안에 만들지 않는다.
5. 테스트 최종 결과 요약만 `test-results/`에 둘 수 있고, Git에는 올리지 않는다.
```

## 작업 모드 판별

AI는 먼저 현재 위치가 어떤 모드인지 판단한다.

```text
템플릿 원본 모드
→ MD 프레임워크 자체를 다듬는 상태
→ 실제 프로젝트 폴더를 만들지 않음
→ LESSONS.md / HANDOVER.md는 비워둠

프로젝트 적용 모드
→ 이 템플릿이 실제 앱 프로젝트에 복사된 상태
→ 앱 개발은 PRD.md를 먼저 읽고 시작
→ 사용자가 요청한 경우 표준 빈 폴더 생성 가능
→ 실제 문제 해결 기록과 인수인계 작성 가능
```

명시적 모드 계약:

```text
FRAMEWORK_MODE=template  # 템플릿 원본 모드
FRAMEWORK_MODE=project   # 프로젝트 적용 모드
```

판별 우선순위:

1. `FRAMEWORK_MODE`가 있으면 그 값을 따른다.
2. `FRAMEWORK_MODE`가 없고 사용자가 "템플릿", "프레임워크", "원본"을 다듬는다고 말하면 템플릿 원본 모드로 본다.
3. `FRAMEWORK_MODE`가 없고 사용자가 실제 앱/서비스/프로젝트 구현을 요청하면 프로젝트 적용 모드 후보로 본다.
4. 그래도 애매하면 실제 폴더 생성, 의존성 설치, 빌드를 하지 않는다. 먼저 blocker로 보고한다.

템플릿 원본 모드에서는 `./src/`, `./tests/`, `./apps/`, `./services/`, `./packages/`, `./docs/`, `./config/`, `./assets/`, `./releases/`, `./test-results/` 같은 실제 프로젝트 폴더를 만들지 않는다. `./scripts/`는 이 템플릿이 제공하는 `./scripts/setup/preflight`와 `./scripts/setup/preflight.ps1`에 한해 허용한다. 다만 사용자가 명시적으로 deep research를 요청한 경우 `./RESEARCH/`를 만들 수 있고, 스킬/MCP가 필수로 요구하는 작업 폴더가 있으면 해당 도구 계약 범위 안에서만 만들 수 있다. 프로젝트 적용 모드에서만 사용자가 요청한 경우 표준 빈 폴더를 만들 수 있다.

## Architecture 이행 정책

`ARCHITECTURE.md`는 폴더와 빌드 경로의 기준 문서다. AI는 다음 순서로 이행한다.

1. `ARCHITECTURE.md`의 폴더 아키텍처를 읽는다.
2. 앱 개발이나 프로젝트 구현이면 `PRD.md`를 먼저 읽는다.
3. 프로젝트 적용 모드에서 `PRD.md`가 비어 있으면 구현 전에 PRD 초안 작성 또는 요구사항 정리를 먼저 수행한다.
4. 새 파일이 어느 위치에 들어가야 하는지 판단한다.
5. 허용된 위치가 없으면 새 루트 폴더를 만들지 않는다.
6. 구조 변경이 필요하면 현재 모드에 따라 처리한다.
7. 템플릿 원본 모드에서는 파일/폴더를 만들지 않고 답변으로만 제안한다.
8. 프로젝트 적용 모드에서는 기존 `./docs/notes/` 또는 `./docs/references/` 문서 업데이트를 우선하고, 새 제안 문서는 예외 조건을 만족할 때만 작성할 수 있다.
9. 명시적 deep research 요청에서는 `./RESEARCH/` 아래에만 연구 세션 파일을 만들고, 일반 문서나 루트 MD를 늘리지 않는다.
10. 스킬/MCP가 요구하는 작업 폴더는 해당 도구 계약에 명시된 범위에서만 만들고, 가능하면 `.gitignore`에 포함한다.
11. 멀티스택 프로젝트는 `ARCHITECTURE.md`가 허용한 `apps/`, `services/`, `packages/`와 unit 계약 안에서만 구성한다.
12. 사용자가 구조 변경을 명시적으로 승인한 경우에만 `ARCHITECTURE.md`를 수정한다.
13. 구조 변경 후 `.gitignore`, `local.paths.env`, `.env.secret`도 함께 검토한다.

`ARCHITECTURE.md`와 이 파일이 충돌하면 더 안전한 규칙을 따른다. 예를 들어 한 문서가 허용하고 다른 문서가 금지하면 금지를 따른다.

## 실패 처리 원칙

AI는 실패를 숨기거나 우회 성공으로 덮지 않는다. 실패가 발생하면 먼저 근본 원인을 확인한다.

금지:

```text
실패한 명령을 설명 없이 다른 방법으로 우회
테스트 실패를 무시하고 성공한 일부 결과만 보고
설치 실패 후 다른 패키지/도구로 임의 대체
빌드 실패 후 산출물만 억지로 생성
경로 정책 실패 후 임시 폴더나 fallback 경로 사용
원인 확인 없이 "다른 방식으로 해결"했다고 보고
```

필수 절차:

```text
1. 실패한 작업과 명령을 확인한다.
2. 에러 메시지와 관련 로그를 읽는다.
3. 실패 지점이 환경, 경로, 의존성, 권한, 코드, 설정 중 어디인지 분류한다.
4. ARCHITECTURE.md의 정책 위반인지 확인한다.
5. 근본 원인을 설명한다.
6. 같은 정책 안에서 수정 가능한 경우에만 재시도한다.
7. 근본 원인이 불명확하거나 정책 위반 없이는 진행할 수 없으면 blocker로 보고한다.
```

Fallback 옵션은 제공하지 않는다. 사용자가 명시적으로 다른 접근을 승인하더라도, 그것은 실패한 작업의 fallback이 아니라 근본 원인 확인 후 시작하는 별도 새 작업으로 취급한다. 이 경우에도 원래 방법이 왜 실패했는지 먼저 설명해야 한다.

## 비밀값 관리와 사고 처리

이 프레임워크는 비밀값 파일이 Google Drive 프로젝트 폴더 안에 있을 수밖에 없다는 전제를 허용한다. 보호 목표는 "Drive 안에 비밀값이 없음"이 아니라 "비밀값이 Git 원격 저장소, 커밋 이력, 로그, AI 응답, 빌드 산출물로 번지지 않음"이다.

비밀값 보관 규칙:

```text
1. 비밀값은 `.env.secret` 또는 `.env.secret.<profile>` 계열에만 모은다.
2. 코드, 문서, 테스트 fixture, 설정 템플릿, 로그, 빌드 산출물에 비밀값을 쓰지 않는다.
3. AI는 비밀값 파일의 존재 여부와 Git 추적 여부만 확인한다.
4. AI는 비밀값 파일의 내용을 읽거나, 복사하거나, 요약하거나, 스캔 결과에서 값을 재출력하지 않는다.
5. `.env.secret*`는 Google Drive에 남을 수 있지만 Git에는 절대 올라가지 않는다.
6. 가능하면 프로젝트별로 권한이 좁은 키를 쓰고, 여러 프로젝트가 하나의 큰 비밀값을 공유하지 않는다.
```

비밀값이 Git 또는 원격 저장소로 번진 정황이 있으면, AI는 삭제만으로 해결했다고 보지 않는다.

필수 처리:

```text
1. 비밀값 파일명, 노출 위치, Git 추적 여부를 내용 열람 없이 확인한다.
2. Git 인덱스, 커밋, 원격 저장소, 로그, 빌드 산출물 중 어디까지 번졌는지 분류한다.
3. 사용자에게 해당 키/토큰/인증값을 폐기하거나 교체해야 하는지 blocker로 보고한다.
4. AI는 비밀값 내용을 읽거나 복사하거나 요약하지 않는다.
5. 단순 삭제, git history rewrite, 캐시 삭제를 성공으로 보고하지 않는다.
6. 사용자가 새 비밀값을 입력해야 하는 작업은 사용자가 직접 처리한다.
```

## 원격 Push 게이트

내부 커밋만 하는 경우에도 아래 확인은 권장한다. GitHub 같은 원격 저장소로 push할 가능성이 있으면 필수다.

```text
1. `git add .`와 `git commit -a`를 쓰지 않는다.
2. 파일 단위로 stage한다.
3. `git status --short`로 untracked/staged 상태를 확인한다.
4. `git diff --cached --name-only`로 커밋 대상 파일명을 확인한다.
5. `git ls-files` 기준으로 `.env*`, `*.key`, `*.pem`, `*.p12`, `*.pfx`, `credentials.json`, `token.json`, `service-account*.json` 같은 비밀값 후보가 추적 중인지 확인한다.
6. gitleaks 또는 동급 도구가 있으면 Git 이력/인덱스 기준으로 실행하고, 출력은 redaction 옵션을 사용한다.
7. GitHub 원격 저장소를 쓴다면 가능한 경우 secret scanning과 push protection을 켠다.
8. 스캐너가 비밀값을 발견하면 push하지 않고 blocker로 보고한다.
```

AI는 Drive 안의 실제 `.env.secret*` 내용을 검사하기 위해 디렉터리 전체 스캔을 실행하지 않는다. `gitleaks dir .`처럼 무시된 비밀값 파일까지 읽을 수 있는 방식은 사용하지 않는다. 원격 유출 방지는 Git 이력, staged diff, 추적 파일 중심으로 검사한다.

스캐너 출력에 실제 비밀값이 표시되면 AI는 그 값을 답변에 옮기지 않는다. 파일명, 줄 번호, 탐지 규칙, 조치만 보고한다.

## 강제 방법

AI는 아래 방식으로 규칙을 강제한다.

1. **PRD 게이트**: 앱 개발이나 프로젝트 구현 전 `PRD.md`를 읽고, 프로젝트 적용 모드에서 비어 있으면 구현을 시작하지 않는다.
2. **사전 분류**: 파일 생성 전 `src`, `tests`, `apps`, `services`, `packages`, `docs`, `scripts`, `config`, `assets`, `releases`, `test-results`, `sandbox`, `tmp`, `RESEARCH`, 도구 전용 작업 폴더 중 어디에 속하는지 정한다.
3. **경로 검증**: 생성/수정 대상 경로가 프로젝트 내부 허용 경로인지 확인한다.
4. **금지 항목 검사**: `.venv`, `node_modules`, `dist`, `build`, `.next`, `target`, 캐시, 로그, DB, 비밀값 파일, 테스트 실행 환경을 프로젝트 내부에 만들지 않는다.
5. **환경 변수 검사**: 의존성 설치, 테스트, 빌드 전에 `FRAMEWORK_MODE`, `PROJECT_NAME`, `PROJECT_ROOT`, `CLOUD_SYNC_ROOT`, `LOCAL_ROOT`, `ENV_DIR`, `CACHE_DIR`, `BUILD_DIR`, `TEST_WORK_DIR`, `PREFLIGHT_COMMAND`를 확인한다.
6. **외부 루트 검사**: `LOCAL_ROOT`가 `PROJECT_ROOT` 또는 `CLOUD_SYNC_ROOT` 하위이면 설치/테스트/빌드를 중단한다.
7. **Preflight 검사**: 프로젝트 적용 모드에서 의존성 설치, 테스트, 빌드, 릴리즈, 원격 push 전에는 `PREFLIGHT_COMMAND`를 통과한다.
8. **Unit 계약 검사**: `PROJECT_UNITS`가 있으면 `UNIT_CONFIG`의 unit 목록, 경로, 의존 순서, 명령 계약을 확인한다.
9. **플랫폼 빌드 검사**: Mac/Windows 빌드는 각각 `MACOS_BUILD_DIR`, `WINDOWS_BUILD_DIR`로 분리한다.
10. **릴리즈 검사**: 최종 앱만 `RELEASE_DIR`로 승격하고, 중간 산출물은 넣지 않는다.
11. **테스트 결과 검사**: 테스트 raw artifact는 `TEST_WORK_DIR`에만 두고, 최종 요약 결과만 `TEST_RESULTS_DIR`에 둔다.
12. **Git 제외 검사**: Git에 올라가면 안 되는 파일은 `.gitignore`에 포함되어 있는지 확인한다.
13. **완료 전 점검**: 작업 후 프로젝트 루트에 실행 부산물이 남지 않았는지 확인한다.
14. **환경 파일 분리**: 경로/모드 값은 `local.paths.env` 계열에만 두고, API 키/토큰은 `.env.secret` 계열에만 둔다.
15. **MD 파일 통제**: MD 문서는 새로 만들기보다 기존 문서를 업데이트한다. 루트 MD 파일은 허용 목록만 사용하고, AI 참고용 MD도 프로젝트 적용 모드에서 기존 `./docs/notes/` 또는 `./docs/references/` 문서 업데이트를 우선한다.
16. **실패 원인 확인**: 실패가 발생하면 다른 접근을 검토하기 전에 근본 원인을 확인하고 보고한다.
17. **파일 최소화**: 새 파일 생성보다 기존 파일 수정을 우선한다.
18. **원격 Push 검사**: 원격 push 전에는 staged 파일, 추적 중인 비밀값 후보, redacted secret scan 결과를 확인한다.
19. **재현성 검사**: 의존성 폴더가 아니라 manifest/lockfile이 Git 대상인지 확인한다.

여러 tool call을 한 번에 실행해야 할 때는 실행 전에 무엇을 확인하거나 수정할지 짧게 보고한다.

## 해야 할 일

AI는 다음을 해야 한다.

1. 작업 시작 전에 `AGENTS.md`와 `ARCHITECTURE.md`를 기준으로 범위를 정한다.
2. 앱 개발이나 프로젝트 구현이면 `PRD.md`를 먼저 읽는다.
3. 프로젝트 적용 모드에서 `PRD.md`가 비어 있으면 구현 전에 PRD 초안 작성 또는 요구사항 정리를 먼저 수행한다.
4. 파일을 만들 때 상대경로를 사용한다.
5. 프로젝트 내부 파일은 `ARCHITECTURE.md`의 폴더 역할에 맞게 배치한다.
6. 실제 프로젝트 적용 모드에서 어려운 문제를 해결하면 `LESSONS.md`에 기록한다.
7. 실제 프로젝트 적용 모드에서 작업을 마치면 `HANDOVER.md`에 한 일과 해야 할 일만 기록한다.
8. 의존성 설치가 필요하면 먼저 `LOCAL_ROOT` 후보를 탐색하고, 사용자가 확정했는지 확인한다.
9. 외부 설치가 가능한 도구는 `LOCAL_ROOT` 아래로만 설치한다.
10. 내부 설치만 가능한 도구는 실행하지 않고 blocker로 보고한다.
11. 프로젝트 적용 모드에서 설치, 테스트, 빌드, 릴리즈, 원격 push 전에는 preflight를 실행한다.
12. 멀티스택 프로젝트라면 `PROJECT_UNITS`와 `UNIT_CONFIG`를 기준으로 unit별 명령과 의존 순서를 확인한다.
13. 테스트가 필요하면 `TEST_WORK_DIR`가 `LOCAL_ROOT` 아래인지 확인하고, 최종 요약만 `TEST_RESULTS_DIR`에 둔다.
14. 빌드가 필요하면 `BUILD_DIR`, `MACOS_BUILD_DIR`, `WINDOWS_BUILD_DIR`를 확인한다.
15. 최종 앱은 Mac/Windows가 같은 버전 세트일 때만 `RELEASE_DIR`로 승격한다.
16. 변경 후 `.gitignore`가 위험 파일과 실행 부산물을 막는지 확인한다.
17. AI가 수정 가능한 로컬 경로 값은 `local.paths.env`에만 둔다.
18. 실제 프로젝트 적용 모드에서 필요한 참고 내용은 먼저 기존 `./docs/notes/` 또는 `./docs/references/` 문서에 추가한다.
19. 명시적 deep research 요청에서는 연구 원자료와 중간 산출물을 `./RESEARCH/` 아래에만 둔다.
20. 스킬/MCP가 요구하는 폴더는 도구 지침에 근거가 있을 때만 만들고, 작업 후 Git 제외 여부를 확인한다.
21. 원격 push 전에는 원격 Push 게이트를 통과한다.
22. 의존성 manifest와 lockfile은 소스의 일부로 취급하고 Git 대상에 남긴다.
23. 실패한 작업은 근본 원인을 확인한 뒤 같은 정책 안에서만 재시도한다.

## 하지 말아야 할 일

AI는 다음을 하지 않는다.

1. 새 최상위 폴더를 임의로 만들지 않는다.
2. 템플릿 원본 모드에서 실제 프로젝트 구조를 만들지 않는다.
3. 템플릿 원본 모드에서 `scripts/setup/preflight`와 `scripts/setup/preflight.ps1` 밖의 새 스크립트를 만들지 않는다.
4. 템플릿 원본 모드에서 `PRD.md`, `LESSONS.md`, `HANDOVER.md`에 내용을 채우지 않는다.
5. 프로젝트 적용 모드에서 빈 `PRD.md` 상태로 구현을 시작하지 않는다.
6. 프로젝트 내부에 `.venv`, `venv`, `env`, `node_modules`, `dist`, `build`, `.next`, `target`, 캐시 폴더를 만들지 않는다.
7. 클라우드 동기화 폴더 내부에 의존성, 캐시, 빌드 작업장, 테스트 실행 환경을 만들지 않는다.
8. `LOCAL_ROOT`가 미정인 상태에서 의존성 설치, 테스트, 빌드를 하지 않는다.
9. 프로젝트 적용 모드에서 preflight 실패 또는 미실행 상태로 설치, 테스트, 빌드, 릴리즈, 원격 push를 진행하지 않는다.
10. `PROJECT_UNITS`에 없는 unit을 임의로 빌드/테스트 대상에 끼워 넣지 않는다.
11. 설치 위치를 통제할 수 없는 도구를 자동 실행하지 않는다.
12. Mac만 또는 Windows만 성공한 산출물을 최종 릴리즈로 보지 않는다.
13. 최종 앱 바이너리를 Git에 올리지 않는다.
14. 실제 API 키, 토큰, 인증 파일을 저장하거나 수정하지 않는다.
15. `ARCHITECTURE.md`를 우회해서 임시 구조를 만들지 않는다.
16. `.env`, `.env.local`, `.env.secret` 같은 비밀값 파일은 존재 여부만 확인하고 내용에 접근하거나 수정하지 않는다.
17. 루트에 임의의 `.md` 파일을 만들지 않는다.
18. `src`, `tests`, `scripts`, `config`, `assets`, `releases`, `sandbox`, `tmp` 아래에 설명용 `.md` 파일을 임의로 만들지 않는다.
19. `test-results/`에 테스트 실행 환경, raw 로그, coverage 원자료, trace, video, 임시 DB를 넣지 않는다.
20. `RESEARCH/`를 일반 작업 메모, 빌드 산출물, 의존성 저장소, 비밀값 보관소로 쓰지 않는다.
21. 스킬/MCP가 요구하지 않은 도구 폴더를 임의로 만들지 않는다.
22. 원격 push 가능성이 있는 작업에서 `git add .` 또는 `git commit -a`로 한 번에 넣지 않는다.
23. secret scanner 출력의 실제 비밀값을 답변, 로그, 문서에 옮기지 않는다.
24. 실패를 fallback 경로, 임시 도구, 임의 패키지 변경으로 덮지 않는다.
25. 원래 실패 원인을 확인하기 전에 "성공하는 다른 방법"을 우선하지 않는다.

## MD 파일 수정 정책

루트에 둘 수 있는 MD 파일은 구조화에 필요한 고정 문서로 제한한다. 목적은 모든 프로젝트가 항상 동일한 MD 파일 세트로 운영되게 하는 것이다. AI는 아래 목록 밖의 루트 MD 파일을 만들지 않는다.

```text
./AGENTS.md
./ARCHITECTURE.md
./PRD.md
./LESSONS.md
./HANDOVER.md
./README.md
```

`PRD.md`는 앱 개발의 시작점이다. 템플릿 원본 모드에서는 빈 파일로 두고, 프로젝트 적용 모드에서 앱 구현 전에 내용을 채운다.

`README.md`는 프로젝트 적용 모드에서 사용자가 요청했거나 이미 존재하는 경우에만 작성/수정한다. 템플릿 원본 모드에서는 임의로 만들지 않는다.

템플릿 원본 모드:

```text
새 MD 파일을 만들지 않는다.
PRD.md, LESSONS.md, HANDOVER.md는 빈 파일로 둔다.
필요한 제안은 답변으로만 보고한다.
```

프로젝트 적용 모드:

```text
AI 참고용 문서 수정 허용 위치:
./docs/notes/
./docs/references/
```

명시적 deep research 모드:

```text
연구 세션 파일 허용 위치:
./RESEARCH/
```

`RESEARCH/`는 외부 자료 수집, 출처 목록, 비교 분석 초안, 품질 검토 기록을 담는 임시 연구 작업장이다. 이 폴더의 내용은 운영 규칙이 아니며, 채택된 결론만 `AGENTS.md` 또는 `ARCHITECTURE.md`에 반영한다.

용도:

```text
./docs/notes/      # 조사 메모, AI 작업 제안, 미확정 참고 문서
./docs/references/ # 반복 참고할 수 있는 외부 자료 요약, 환경 조사 결과, 작업 기준 자료
```

제한:

```text
./docs/decisions/  # 확정된 아키텍처 결정만 기록, 임의 생성 금지
./docs/specs/      # 사용자가 요구사항/사양 정리를 요청했을 때만 작성
```

원칙:

```text
1. 새 MD 파일 생성보다 기존 MD 파일 업데이트를 우선한다.
2. 새 MD 파일은 사용자가 명시적으로 요청했거나, 기존 문서에 섞으면 의미가 깨지는 경우에만 만든다.
3. 새 MD 파일을 만들 때는 왜 기존 문서 업데이트로 충분하지 않은지 먼저 판단한다.
4. 새 MD 파일 생성이 필요하면 프로젝트 적용 모드에서만 `./docs/notes/` 또는 `./docs/references/` 아래에 만든다.
5. 루트 MD 파일은 허용 목록 밖으로 추가하지 않는다.
```

AI가 예외적으로 참고용 MD를 만들 때는 파일명을 `lower-kebab-case.md`로 쓴다. 날짜가 필요한 기록은 `YYYY-MM-DD-topic.md` 형식을 쓴다.

## 의존성 재현성 정책

의존성 폴더는 Git에 올리지 않는다. 대신 의존성 manifest와 lockfile은 소스의 일부로 보고 Git 관리 대상에 둔다.

Git 대상 예:

```text
pyproject.toml
requirements*.txt
uv.lock
poetry.lock
Pipfile.lock
package.json
package-lock.json
pnpm-lock.yaml
yarn.lock
Cargo.toml
Cargo.lock
go.mod
go.sum
```

금지:

```text
lockfile 없이 로컬 환경만 맞춰서 "내 컴퓨터에서는 됨"으로 처리
의존성 폴더를 복사해서 재현성 대신 사용
Google Drive 안의 설치 폴더를 다른 OS에서 재사용
```

manifest/lockfile 변경은 의존성 변경으로 보고, 왜 바뀌었는지 작업 보고에 포함한다.

## 의존성 설치 정책

의존성 자동 설치는 허용한다. 단, 설치 위치가 `LOCAL_ROOT` 아래로 통제되는 경우만 허용한다.

허용 예:

```text
Python 가상환경을 ${ENV_DIR}/.venv에 만들고 그 안에 설치
캐시/빌드/설치 경로를 ${LOCAL_ROOT} 아래로 지정할 수 있는 도구
```

금지 예:

```text
프로젝트 내부에만 node_modules를 만드는 설치
설치 위치를 확인할 수 없는 설치
클라우드 동기화 폴더 안에 생성되는 설치
```

내부 설치만 가능한 경우 처리:

```text
1. 명령 실행을 중단한다.
2. 사용자에게 blocker로 보고한다.
3. 프로젝트 적용 모드라면 HANDOVER.md의 해야 할 일에 남긴다.
4. 템플릿 원본 모드라면 HANDOVER.md를 수정하지 않는다.
```

패키지 매니저별 주의:

```text
npm 로컬 설치는 기본적으로 현재 패키지 루트의 ./node_modules에 설치된다.
따라서 Google Drive 프로젝트 폴더에서 npm install/npm ci는 기본적으로 내부 설치로 간주하고 실행하지 않는다.
cache 위치만 LOCAL_ROOT로 바꾸는 것은 충분하지 않다. node_modules가 프로젝트 내부에 생기면 정책 위반이다.
```

## 빌드 정책

빌드는 완전 범용 경로 계약만 따른다. 특정 기술 스택의 빌드 명령은 이 템플릿에 하드코딩하지 않는다.

필수 변수:

```text
FRAMEWORK_MODE=project
PROJECT_NAME=<project-name>
PROJECT_UNITS=<comma-separated-unit-names>
PRD_FILE=./PRD.md
PROJECT_ROOT=<project-root>
CLOUD_SYNC_ROOT=<cloud-sync-root>
LOCAL_ROOT=<path-outside-cloud-sync>
ENV_DIR=${LOCAL_ROOT}/envs/${PROJECT_NAME}
CACHE_DIR=${LOCAL_ROOT}/caches/${PROJECT_NAME}
BUILD_DIR=${LOCAL_ROOT}/builds/${PROJECT_NAME}
TEST_WORK_DIR=${LOCAL_ROOT}/tests/${PROJECT_NAME}
MACOS_BUILD_DIR=${BUILD_DIR}/macos
WINDOWS_BUILD_DIR=${BUILD_DIR}/windows
RELEASE_DIR=./releases
TEST_RESULTS_DIR=./test-results
UNIT_CONFIG=./config/units.json
PREFLIGHT_COMMAND=./scripts/setup/preflight
```

이 값들은 `local.paths.env` 또는 실행 환경에서 관리한다. 템플릿 원본에서는 `local.paths.env`를 빈값 또는 동적 변수식으로 유지한다. AI는 프로젝트 적용 모드에서 `local.paths.env`를 생성/수정할 수 있다. 단, `LOCAL_ROOT` 후보를 새로 만들 수는 없고 기존 후보를 기록하거나 사용자가 확정한 값을 반영하는 것만 허용된다.

환경 파일 분리:

```text
local.paths.env          # 템플릿 원본에서는 빈/동적 값, 프로젝트 적용 후 머신별 실제 경로
.env.secret             # 템플릿 원본에서는 빈 파일, AI 내용 접근 금지: API 키, 토큰, 인증값
```

`local.paths.env`에는 API 키, 토큰, 비밀번호, 인증 파일 경로를 넣지 않는다. `.env.secret`에는 필요 시 비밀 환경 변수만 두며, 템플릿 원본에서는 빈 파일로 유지한다. AI는 파일 존재 여부만 확인할 수 있고 내용에는 접근하지 않는다.

빌드 실행 조건:

1. `FRAMEWORK_MODE=project`여야 한다.
2. `PROJECT_ROOT`, `CLOUD_SYNC_ROOT`, `LOCAL_ROOT`가 확정되어 있어야 한다.
3. `LOCAL_ROOT`는 `PROJECT_ROOT`와 `CLOUD_SYNC_ROOT` 밖이어야 한다.
4. 프로젝트 적용 모드에서 preflight가 통과해야 한다.
5. 멀티스택 프로젝트라면 `PROJECT_UNITS`와 `UNIT_CONFIG`의 unit 계약이 일치해야 한다.
6. 테스트 실행은 `TEST_WORK_DIR`를 사용해야 한다.
7. 테스트 최종 요약만 `TEST_RESULTS_DIR`로 복사해야 한다.
8. Mac 빌드는 `MACOS_BUILD_DIR`를 사용해야 한다.
9. Windows 빌드는 `WINDOWS_BUILD_DIR`를 사용해야 한다.
10. 프로젝트 루트에 중간 테스트/빌드 산출물을 남기지 않아야 한다.
11. 최종 앱만 `RELEASE_DIR`로 복사해야 한다.
12. Mac/Windows 둘 다 성공하기 전에는 최종 릴리즈로 승격하지 않는다.

릴리즈 manifest 최소 항목:

```text
version
source_commit
created_at
macos_artifact
windows_artifact
macos_builder_os
windows_builder_os
build_commands
checksums_file
known_gaps
```

`known_gaps`가 비어 있지 않으면 최종 릴리즈로 보고하지 않는다.

## LESSONS.md 정책

템플릿 원본 모드:

```text
LESSONS.md는 빈 파일로 둔다.
```

프로젝트 적용 모드:

어려운 벽을 해결했을 때만 기록한다.

```text
## YYYY-MM-DD - 짧은 제목

- 문제:
- 원인:
- 해결:
- 다음에 피할 것:
```

단순 진행 상황, 감상, 일반 설명은 `LESSONS.md`에 적지 않는다.

## HANDOVER.md 정책

템플릿 원본 모드:

```text
HANDOVER.md는 빈 파일로 둔다.
```

프로젝트 적용 모드:

작업 종료 시 다음 AI가 바로 이어받을 수 있도록 아래 두 섹션만 사용한다.

```text
## 한 일

## 해야 할 일
```

`HANDOVER.md`에는 배경 설명, 긴 분석, 감상, 설계 철학을 쓰지 않는다. 완료된 작업과 남은 작업만 적는다.

반쪽 릴리즈 처리:

```text
Mac 빌드만 성공하거나 Windows 빌드만 성공한 경우:
1. releases/<version>/을 최종 릴리즈로 만들지 않는다.
2. 성공한 산출물은 LOCAL_ROOT 아래 빌드 작업장에만 둔다.
3. HANDOVER.md의 "해야 할 일"에 남은 플랫폼 빌드와 검증을 기록한다.
```

## Blocker 보고 정책

AI는 아래 상황에서 작업을 멈추고 blocker로 보고한다.

1. 현재 모드가 템플릿 원본인지 프로젝트 적용인지 불명확하다.
2. `PROJECT_ROOT`, `CLOUD_SYNC_ROOT`, `LOCAL_ROOT`가 없거나 서로의 포함 관계를 검증할 수 없다.
3. `LOCAL_ROOT`가 `PROJECT_ROOT` 또는 `CLOUD_SYNC_ROOT` 내부다.
4. 설치 도구가 프로젝트 내부 설치만 지원한다.
5. 빌드 경로가 `BUILD_DIR` 밖으로 나간다.
6. 테스트 실행 경로가 `TEST_WORK_DIR` 밖으로 나가거나 Drive 안에 raw artifact를 만들 수밖에 없다.
7. 프로젝트 적용 모드에서 preflight가 없거나 실패했는데 설치, 테스트, 빌드, 릴리즈, 원격 push가 필요하다.
8. `PROJECT_UNITS`와 `UNIT_CONFIG`가 서로 다르거나 unit 의존 순서를 결정할 수 없다.
9. Mac/Windows 릴리즈 세트 중 한쪽만 생성된다.
10. 사용자가 요청하지 않은 새 루트 폴더가 필요하다.
11. 비밀값 저장이나 비밀값 파일 수정이 필요하다.
12. 실패의 근본 원인을 확인할 수 없는데 다른 접근 없이는 진행할 수 없다.
13. 다른 접근을 쓰지 않으면 성공할 수 없지만 원래 실패의 근본 원인을 아직 확인하지 못했다.

프로젝트 적용 모드에서는 blocker를 `HANDOVER.md`의 `해야 할 일`에도 남긴다. 템플릿 원본 모드에서는 파일을 수정하지 않고 답변으로만 보고한다.

## 완료 전 체크리스트

작업 완료 전에 확인한다.

```text
ARCHITECTURE.md 규칙을 우회하지 않았는가?
새 최상위 폴더를 임의로 만들지 않았는가?
새 MD 파일을 만들기 전에 기존 문서 업데이트가 불가능한지 확인했는가?
새 MD 파일이 예외적으로 허용된 위치에만 생성되었는가?
실패한 작업이 있다면 근본 원인을 확인했는가?
우회 없이 같은 정책 안에서 처리했는가?
프로젝트 내부에 의존성/캐시/빌드 산출물이 생기지 않았는가?
프로젝트 내부에 테스트 실행 환경/raw artifact가 생기지 않았는가?
LOCAL_ROOT 없이 설치/테스트/빌드를 실행하지 않았는가?
프로젝트 적용 모드에서 preflight를 통과했는가?
멀티스택 프로젝트라면 PROJECT_UNITS와 UNIT_CONFIG가 일치하는가?
최종 앱 바이너리가 Git 대상이 되지 않도록 .gitignore가 막는가?
템플릿 원본 모드에서 LESSONS.md/HANDOVER.md를 채우지 않았는가?
```
