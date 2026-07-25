# Architecture Template

이 문서는 어느 프로젝트 폴더에 복사해도 사용할 수 있는 MD 기반 개발 환경 프레임워크다.

목적은 명확하다.

```text
소스 코드와 관리 문서       → 프로젝트 폴더 안, Git 관리 대상
최종 빌드 앱               → 프로젝트 폴더 안, Google Drive 보관 대상, Git 제외
최종 테스트 결과            → 프로젝트 폴더 안, Google Drive 보관 대상, Git 제외
가상환경/의존성/캐시/빌드장/테스트 실행 환경 → 프로젝트 폴더 밖, 로컬 전용
```

이 문서의 모든 프로젝트 내부 경로는 이 파일이 놓인 폴더를 기준으로 한 상대경로다. 특정 사용자 이름, 특정 PC, 특정 절대경로를 하드코딩하지 않는다.

## Sound Forge 적용 아키텍처

이 저장소는 아래 계약을 사용하는 실제 프로젝트다. 이 섹션은 문서 뒤쪽의 범용 템플릿 예시와 Mac/Windows 동시 릴리즈 규칙보다 우선한다.

```text
FRAMEWORK_MODE       → project
제품 unit            → Electron desktop app 한 개
지원 플랫폼          → macOS Universal (x64 + arm64)
미지원 플랫폼        → Windows, Linux
의존성/캐시          → LOCAL_ROOT 아래
빌드/테스트 작업장   → LOCAL_ROOT 아래
최종 검증 앱         → releases/<version>/macos/에만 승격
```

허용되는 제품 구조:

```text
src/
├── main/        # Electron main process, IPC, 파일/FFmpeg orchestration
├── preload/     # renderer에 노출하는 제한된 bridge
├── renderer/    # GUI, 전체 타임라인 미리보기
└── shared/      # 순수 도메인 로직과 공통 상수

tests/
├── unit/        # 순수 로직과 FFmpeg 명령 구성
├── integration/ # 실제 ffmpeg/ffprobe 및 IPC 경계
└── e2e/         # Electron GUI 사용자 흐름

assets/          # 앱 아이콘 등 사람이 관리하는 정적 리소스
config/          # 공유 가능한 빌드/테스트 설정
releases/        # 검증된 macOS Universal 최종 앱, Git 바이너리 제외
test-results/    # 최종 테스트 요약만 보관, Git 제외
```

`package.json`과 lockfile은 프로젝트 루트의 재현 가능한 소스 설정으로 Git에 남긴다. `node_modules`, Electron 다운로드 캐시, 패키징 작업장, 테스트 raw artifact는 프로젝트 안에 만들지 않는다.

Sound Forge의 릴리즈 세트는 Windows 앱이 아니라 동일 버전의 x64/arm64가 결합된 macOS Universal 앱이다. 두 아키텍처의 Mach-O 포함 여부와 실행 가능성을 검증하기 전에는 최종 릴리즈로 승격하지 않는다.

Sound Forge MVP에서는 `WINDOWS_BUILD_DIR`, `windows_artifact`, `windows_builder_os`가 필수값이 아니다. 완전한 릴리즈 구조와 manifest는 다음을 사용한다.

```text
releases/<version>/
├── manifest.json
├── checksums.txt
└── macos/
    └── Sound-Forge-<version>-universal.app 또는 배포 패키지
```

```text
version
source_commit
created_at
macos_artifact
macos_architectures  # x64, arm64
macos_builder_os
build_commands
checksums_file
known_gaps
```

## 사용 모드

이 프레임워크에는 두 가지 모드가 있다.

| 모드 | 의미 | 실제 폴더 생성 |
| --- | --- | --- |
| 템플릿 원본 모드 | 이 MD 세트를 보관하고 다듬는 곳 | 실제 프로젝트 폴더를 만들지 않음 |
| 프로젝트 적용 모드 | 새 프로젝트에 이 MD 세트를 복사해 적용한 상태 | 사용자가 적용을 요청한 경우에만 표준 빈 폴더 생성 가능 |

명시적 모드 계약:

```text
FRAMEWORK_MODE=template  # 템플릿 원본 모드
FRAMEWORK_MODE=project   # 프로젝트 적용 모드
```

이 문서는 특정 현재 폴더의 상태를 설명하지 않는다. 복사 가능한 템플릿 기준과 프로젝트 적용 시의 기준만 설명한다.

## 기본 포함 파일

템플릿 세트에는 아래 기본 파일과 필요 시 생성되는 허용 작업 폴더가 있다.

```text
AGENTS.md       # AI 에이전트가 따라야 하는 작업 계약
ARCHITECTURE.md # 폴더 구조, 경로 규칙, 빌드/릴리즈 아키텍처
PRD.md          # 앱 개발의 시작점, 템플릿 원본에서는 빈 파일
LESSONS.md      # 어려운 문제를 해결했을 때 남기는 재발 방지 기록
HANDOVER.md     # 다음 AI에게 넘길 한 일 / 해야 할 일
.gitignore      # Git에 올라가면 안 되는 파일 차단
scripts/setup/preflight     # 스택 중립 사전 점검 스크립트 (bash, Mac/Linux/WSL용)
scripts/setup/preflight.ps1 # 스택 중립 사전 점검 스크립트 (PowerShell, Windows용)
local.paths.env # 템플릿 원본에서는 빈/동적 경로 변수 파일, 프로젝트 적용 후 머신별 실제 값 입력
.env.secret     # 템플릿 원본에서는 빈 비밀값 파일, 필요 시 사용자가 환경 변수 직접 입력, Git 제외
RESEARCH/       # 선택 작업 폴더: 명시적 deep research 또는 외부 비교 분석 때만 생성, Git 제외
test-results/   # 선택 결과 폴더: 최종 테스트 결과 요약만 보관, Git 제외
```

`.gitignore`는 Google Drive 동기화를 막지 않는다. 역할은 Git에 올라가면 안 되는 파일을 막는 2차 안전장치다.

## 파일 최소화 원칙

Google Drive 프로젝트 폴더에는 반드시 필요한 파일만 둔다.

```text
유지할 것   → 소스, 고정 운영 문서, Git 관리 설정, 최종 앱 릴리즈 기록, 최종 테스트 결과 요약
로컬로 둘 것 → 가상환경, 의존성, 캐시, 빌드 작업장, 테스트 실행 환경, 로그, 임시 파일
늘리지 말 것 → 임시 문서, 대체 설정 파일, 중간 산출물, 실패 우회 산출물
```

Google Drive 최소화 원칙:

```text
Drive에 남길 것     → 재건 가능한 입력과 최종 산출물
Drive에 남기지 않을 것 → 재생성 가능한 실행 환경과 중간 산출물
```

실행 환경, 테스트 환경, raw artifact, 캐시는 언제든 다시 만들 수 있어야 한다. 이런 재생성 가능한 파일을 Drive에 보관하지 않는 것이 이 프레임워크의 기본 목적이다.

새 파일 생성보다 기존 파일 업데이트를 우선한다. 새 파일은 기존 파일에 섞으면 의미가 깨지고, 이 문서가 허용한 위치와 조건을 만족할 때만 만든다.

예외적으로 `RESEARCH/`는 사용자가 명시적으로 deep research, 외부 비교 분석, 베스트 프랙티스 조사를 요청한 경우에만 만들 수 있다. 스킬이나 MCP 도구가 정상 동작을 위해 특정 작업 폴더, 상태 폴더, 캐시 폴더, 산출물 폴더를 요구하는 경우도 해당 도구 계약에 명시된 경로에 한해 허용한다. 이런 폴더는 운영 구조가 아니라 도구 작업장으로 취급하며 Git에는 올리지 않는다.

## 템플릿 원본 구조

템플릿 원본에는 기본적으로 파일만 둔다.

```text
<template-root>/             # MD 프레임워크 원본
├── AGENTS.md                # AI 실행 정책
├── ARCHITECTURE.md          # 폴더/경로/빌드 아키텍처
├── PRD.md                   # 빈 파일
├── LESSONS.md               # 빈 파일
├── HANDOVER.md              # 빈 파일
├── .gitignore               # 범용 Git 제외 규칙
├── scripts/
│   └── setup/
│       ├── preflight        # 스택 중립 사전 점검 스크립트 (bash)
│       └── preflight.ps1    # 스택 중립 사전 점검 스크립트 (PowerShell)
├── local.paths.env          # 템플릿 원본에서는 빈/동적 경로 변수 파일, Git 제외
└── .env.secret              # 템플릿 원본에서는 빈 비밀값 파일, Git 제외, AI 내용 접근 금지
```

템플릿 원본 모드에서는 `src/`, `tests/`, `apps/`, `services/`, `packages/`, `docs/`, `config/`, `assets/`, `releases/`, `test-results/`, `sandbox/`, `tmp/`를 만들지 않는다. `scripts/`는 이 템플릿이 제공하는 `scripts/setup/preflight`와 `scripts/setup/preflight.ps1`에 한해 허용한다. 그 밖의 스크립트는 프로젝트 적용 모드에서만 만든다. 사용자가 명시적으로 research를 요청했거나 스킬/MCP가 필수 작업 폴더를 요구하는 경우에는 해당 도구 계약 범위 안에서만 만들 수 있다.

## 프로젝트 적용 구조

아래 트리는 실제 생성 명령이 아니라, 프로젝트 적용 시 허용되는 표준 구조다.

```text
<project-root>/                         # 이 템플릿을 복사한 프로젝트 루트
├── AGENTS.md                           # AI 행동 규칙: 생성/설치/빌드 금지선
├── ARCHITECTURE.md                     # 폴더와 빌드 아키텍처의 기준 문서
├── PRD.md                              # 제품 요구사항, 앱 개발 시작점
├── LESSONS.md                          # 해결한 어려운 문제와 재발 방지 기록
├── HANDOVER.md                         # 다음 AI가 볼 한 일 / 해야 할 일
├── README.md                           # 사람을 위한 프로젝트 소개
├── .gitignore                          # Git 제외 규칙
├── local.paths.env                     # LOCAL_ROOT 등 AI 수정 가능 경로 변수 실제 파일
├── .env.secret                         # API 키 등 비밀값 실제 파일, AI 내용 접근 금지
│
├── src/                                # 실제 제품 소스 코드
├── tests/                              # 테스트 코드와 테스트 fixture
│
├── apps/                               # 선택: 멀티스택 앱 단위, 프로젝트 적용 모드에서만 사용
├── services/                           # 선택: API, worker 같은 서비스 단위
├── packages/                           # 선택: 공유 라이브러리와 공통 패키지
│
├── docs/                               # 사람이 읽는 문서
│   ├── decisions/                      # 아키텍처 결정 기록
│   ├── specs/                          # 요구사항, 화면, 기능 사양
│   ├── notes/                          # 미확정 메모, 조사, AI 제안
│   └── references/                     # 참고 자료
│
├── scripts/                            # 반복 가능한 자동화 스크립트
│   ├── setup/                          # 초기 설정/검증 스크립트, preflight 진입점
│   ├── dev/                            # 개발 실행 스크립트
│   └── maintenance/                    # 정리/점검/마이그레이션 보조
│
├── config/                             # 공유 가능한 설정 템플릿
├── assets/                             # 사람이 관리하는 정적 리소스
├── releases/                           # 최종 앱 보관소, Git 바이너리 제외
│   └── <version>/                      # 동일 버전의 Mac/Windows 릴리즈 세트
│       ├── manifest.json               # 버전, 커밋, 빌드 정보
│       ├── checksums.txt               # 최종 앱 체크섬
│       ├── macos/                      # 최종 Mac 앱 패키지
│       └── windows/                    # 최종 Windows 앱 패키지
├── test-results/                       # 최종 테스트 결과 요약만 보관, Git 제외
│
├── sandbox/                            # 실험 파일, 장기 보존 아님
├── tmp/                                # 삭제 가능한 임시 파일
└── RESEARCH/                           # 명시적 research/스킬 작업장, Git 제외
```

## 폴더별 용도

| 경로 | 들어가야 하는 것 | 들어가면 안 되는 것 |
| --- | --- | --- |
| `src/` | 앱 코드, 라이브러리 코드, 컴포넌트, 도메인 로직, 타입 정의 | 실험 초안, 로그, 빌드 결과물, 의존성 |
| `tests/` | 테스트 코드, fixture, helper | 커버리지 결과, 테스트 로그, 임시 DB |
| `apps/` | 멀티스택 프로젝트의 사용자 앱 단위 | 의존성 폴더, 빌드 결과물, 런타임 캐시 |
| `services/` | API, worker, batch 같은 서비스 단위 | 서비스 실행 로그, 임시 DB, 배포 산출물 |
| `packages/` | 여러 unit이 공유하는 라이브러리, 타입, SDK | 빌드된 패키지, publish 산출물, 의존성 |
| `docs/` | 사람이 읽는 문서 | 실행 코드, 비밀값, 빌드 산출물 |
| `docs/decisions/` | `YYYY-MM-DD-topic.md` 형식의 결정 기록 | 단순 메모, 임시 초안 |
| `docs/specs/` | 요구사항, 기능 사양, 데이터 흐름 | 구현 산출물 |
| `docs/notes/` | 조사 메모, AI 제안, 미확정 참고 문서 | 확정된 아키텍처 결정 |
| `docs/references/` | AI가 반복 참고할 자료, 외부 자료 요약, 환경 조사 결과 | 의존성 다운로드 파일 |
| `scripts/setup/` | 초기 설정/검증 자동화 | 실제 의존성 폴더 |
| `scripts/dev/` | 개발 서버/로컬 실행 자동화 | 빌드 산출물 |
| `scripts/maintenance/` | 정리, 검사, 보조 자동화 | 일회성 난잡한 파일 |
| `config/` | 공유 가능한 설정 템플릿 | API 키, 토큰, 실제 비밀값 |
| `config/units.json` | 멀티스택 unit registry | 비밀값, 로컬 절대경로, 사용자별 설정 |
| `assets/` | 원본 이미지, 아이콘, 정적 자료 | 빌드가 생성한 최적화 파일 |
| `releases/` | 검증된 최종 Mac/Windows 앱 세트 | 중간 빌드 폴더, 캐시, 로그, 반쪽 릴리즈 |
| `test-results/` | 최종 테스트 요약, 최종 리포트, 재실행에 필요한 최소 메타데이터 | 테스트 실행 환경, raw 로그, coverage 원자료, trace, video, 임시 DB |
| `sandbox/` | 버려도 되는 실험 | 제품 코드로 쓰이는 파일 |
| `tmp/` | 삭제 가능한 임시 파일 | 보존해야 하는 결과물 |
| `RESEARCH/` | deep research 세션, 출처 목록, 비교 분석 초안, 스킬/MCP 요구 산출물 | 제품 코드, 비밀값, 의존성, 빌드 산출물 |

## Git / Drive / Local 역할

| 위치 | 역할 | 예시 |
| --- | --- | --- |
| Git | 소스와 관리 문서 | `src/`, `tests/`, `docs/`, `AGENTS.md`, `ARCHITECTURE.md` |
| Google Drive | Git 대상 + 최종 앱 보관 + 최종 테스트 결과 + Git 제외 비밀값 파일 | 프로젝트 폴더, `releases/`, `test-results/`, `.env.secret*` |
| 로컬 디스크 | 다시 만들 수 있는 실행 환경 | 가상환경, 의존성, 캐시, 빌드 작업장, 테스트 실행 환경 |

최종 앱은 Google Drive에 남기지만 Git에는 올리지 않는다.

최종 테스트 결과는 Google Drive에 남길 수 있지만 Git에는 올리지 않는다.

## Google Drive 준비 상태

Google Drive 안의 소스 폴더는 허용하지만, Drive를 의존성/빌드 작업장으로 쓰지 않는다.

검증 규칙:

```text
1. 프로젝트 파일은 현재 OS에서 실제로 열리고 읽히는 상태여야 한다.
2. streaming 모드에서는 필요한 소스 파일이 로컬에서 접근 가능해야 한다.
3. sync conflict, duplicate copy, 임시 업로드 파일이 보이면 원인을 확인하기 전까지 빌드/커밋/push를 하지 않는다.
4. Drive가 멈췄거나 동기화 상태를 신뢰할 수 없으면 blocker로 보고한다.
```

## 크로스 플랫폼 실행 규약

이 프레임워크는 Mac, Windows, Windows WSL을 동시에 지원한다. 같은 프로젝트를 다른 OS에서 열 수 있으므로, 셸 스크립트와 경로 규약은 플랫폼별로 대응한다.

| 환경 | 셸 | preflight 진입점 |
| --- | --- | --- |
| Mac | bash/zsh | `./scripts/setup/preflight` |
| Linux/WSL | bash | `./scripts/setup/preflight` |
| Windows | PowerShell | `.\scripts\setup\preflight.ps1` |

preflight 스크립트는 bash 버전과 PowerShell 버전이 동일한 검사를 수행한다. 두 파일의 검사 항목이 달라지면 안 된다.

프로젝트 적용 모드에서 `scripts/dev/`나 `scripts/maintenance/` 아래에 자동화 스크립트를 추가할 때도 같은 규칙을 따른다. bash 전용 스크립트는 Mac/WSL에서만 동작하고, PowerShell 전용 스크립트는 Windows에서만 동작한다. 두 환경 모두에서 필요한 스크립트는 양쪽 버전을 함께 만든다.

경로 구분자:

```text
ARCHITECTURE.md와 AGENTS.md의 경로 표기는 `/`(슬래시)를 기준으로 한다.
실제 실행에서는 OS에 맞게 변환한다.
템플릿 원본의 local.paths.env는 빈값 또는 동적 변수식만 둔다. 프로젝트 적용 후에는 해당 머신의 실제 경로를 쓴다.
```

## 실패 처리 아키텍처

이 프레임워크는 "성공처럼 보이는 결과"보다 "원인을 아는 실패"를 우선한다.

Fallback 옵션은 제공하지 않는다. 실패가 발생하면 원래 작업의 근본 원인을 먼저 확인한다.

```text
실패 발생
→ 에러/로그 확인
→ 실패 영역 분류
→ 경로/환경/정책 위반 여부 확인
→ 근본 원인 설명
→ 같은 정책 안에서 수정 가능하면 재시도
→ 불가능하면 blocker 보고
```

금지되는 처리:

```text
빌드 실패 후 임시 빌드 폴더로 우회
의존성 설치 실패 후 다른 패키지 매니저로 임의 전환
경로 검증 실패 후 프로젝트 내부에 설치
테스트 실패 후 실패 테스트 제외
원인 확인 없이 "다른 방식으로 됨"으로 보고
```

다른 접근은 실패한 작업의 fallback으로 쓰지 않는다. 사용자가 다른 접근을 승인하더라도, 그것은 근본 원인 확인 후 시작하는 별도 새 작업이다. 원래 실패 원인을 먼저 기록하지 않은 상태에서 다른 방식의 성공을 보고하지 않는다.

## 비밀값 관리 아키텍처

이 프레임워크는 비밀값 파일이 Google Drive 프로젝트 폴더 안에 있을 수밖에 없다는 전제를 허용한다. 대신 비밀값이 Git 원격 저장소, Git 이력, 로그, AI 응답, 빌드 산출물로 번지지 않도록 통제한다.

정상 보관:

```text
.env.secret
.env.secret.<profile>
```

규칙:

```text
1. 비밀값은 `.env.secret*` 계열에만 둔다.
2. `.env.secret*`는 Google Drive에 남을 수 있지만 Git에는 절대 올리지 않는다.
3. AI는 파일 존재 여부와 Git 추적 여부만 확인하고 내용에는 접근하지 않는다.
4. 프로젝트별로 권한이 좁은 키를 우선하고, 여러 프로젝트가 하나의 큰 비밀값을 공유하지 않는다.
5. 코드, 문서, 테스트 fixture, 로그, 빌드 산출물에 비밀값을 쓰지 않는다.
```

노출 사고:

```text
비밀값 노출 의심
→ 파일명/위치/Git 추적 여부만 확인
→ 내용 열람 금지
→ Git 인덱스/커밋/원격/로그/빌드 산출물 중 어디까지 번졌는지 분류
→ 사용자에게 폐기/교체 필요 여부 blocker 보고
→ 사용자가 직접 새 키/토큰 처리
→ 이후 재발 방지 규칙 점검
```

AI는 비밀값을 읽지 않으므로, 유출된 값이 무엇인지 판별하거나 대신 회전할 수 없다.

## 원격 Push 게이트

GitHub 같은 원격 저장소로 push할 수 있는 프로젝트는 push 전에 아래 검사를 통과해야 한다.

```text
1. `git add .`와 `git commit -a`를 쓰지 않는다.
2. 파일 단위로 stage한다.
3. `git status --short`로 untracked/staged 상태를 확인한다.
4. `git diff --cached --name-only`로 커밋 대상 파일명을 확인한다.
5. `git ls-files`로 비밀값 후보 파일이 추적 중인지 확인한다.
6. gitleaks 또는 동급 도구가 있으면 Git 이력/인덱스 기준으로 실행하고 redaction 옵션을 사용한다.
7. GitHub 원격 저장소에서는 가능한 경우 secret scanning과 push protection을 사용한다.
8. 탐지 결과가 있으면 push하지 않고 blocker로 보고한다.
```

Drive 안의 `.env.secret*` 내용을 확인하려고 전체 디렉터리 secret scan을 실행하지 않는다. 검사는 Git 이력, staged diff, 추적 파일 중심으로 수행한다.

## MD 파일 아키텍처

루트 MD 파일은 프레임워크/프로젝트 구조화에 직접 필요한 고정 문서로 제한한다. 목적은 모든 프로젝트가 항상 동일한 MD 파일 세트로 운영되게 하는 것이다. AI는 루트에 임의의 새 MD 파일을 만들지 않는다.

```text
AGENTS.md       # AI 작업 계약
ARCHITECTURE.md # 구조/경로/빌드 기준
PRD.md          # 제품 요구사항, 앱 개발 시작점
LESSONS.md      # 프로젝트 적용 후 어려운 문제 해결 기록
HANDOVER.md     # 프로젝트 적용 후 다음 AI 인수인계
README.md       # 사람을 위한 프로젝트 소개
```

`PRD.md`는 템플릿 원본 모드에서는 빈 파일이어야 한다. 프로젝트 적용 모드에서 앱 개발을 시작할 때는 AI가 먼저 읽고, 비어 있으면 구현 전에 PRD 초안 작성 또는 요구사항 정리를 먼저 수행한다.

`README.md`는 프로젝트 적용 모드에서 사용자가 요청했거나 이미 존재하는 경우에만 작성/수정한다. 템플릿 원본 모드에는 없어도 된다.

MD 문서는 새로 만드는 것보다 기존 문서를 업데이트하는 방식을 기본으로 한다.

AI가 참고용 내용을 남겨야 할 때는 먼저 기존 `docs/` 문서를 찾아 업데이트한다.

```text
docs/notes/      # 임시 조사, AI 작업 제안, 미확정 참고 문서
docs/references/ # 반복 참고할 자료, 외부 문서 요약, 환경 조사 결과
```

제한:

```text
docs/decisions/  # 확정된 결정만 기록
docs/specs/      # 사용자가 요구사항/사양 정리를 요청했을 때만 기록
```

AI는 `src/`, `tests/`, `scripts/`, `config/`, `assets/`, `releases/`, `sandbox/`, `tmp/` 아래에 설명용 MD 파일을 임의로 만들지 않는다.

새 MD 파일 생성은 예외다.

```text
허용 조건:
1. 사용자가 명시적으로 새 문서를 요청했다.
2. 기존 문서에 추가하면 의미가 섞이거나 추적이 어려워진다.
3. 프로젝트 적용 모드다.
4. 위치가 docs/notes/ 또는 docs/references/ 아래다.
```

루트에는 허용된 고정 MD 세트 밖의 새 문서를 만들지 않는다.

## 금지 항목

아래 항목은 프로젝트 내부 또는 클라우드 동기화 폴더 안에 만들지 않는다.

예외: `.env.secret*`는 사용자의 현실 제약상 Google Drive 프로젝트 폴더 안에 둘 수 있다. 단, Git 제외 대상이며 AI는 내용에 접근하지 않는다.

```text
.venv/
venv/
env/
node_modules/
vendor/
dist/
build/
.next/
.nuxt/
.turbo/
.cache/
.pytest_cache/
.mypy_cache/
__pycache__/
.ruff_cache/
coverage/
.coverage
htmlcov/
playwright-report/
blob-report/
테스트 실행용 임시 DB
테스트 실행용 브라우저/시뮬레이터 상태
테스트 raw 로그/trace/video/screenshot 원자료
*.log
*.sqlite
*.sqlite3
*.db
.env
.env.*
.env.local
.env.*.local
.envrc
*.pem
*.key
*.p12
*.pfx
*.crt
*.cer
id_rsa
id_ed25519
credentials.json
token.json
service-account*.json
```

아래 항목은 예외적으로 만들 수 있지만 Git에 올리지 않는다.

```text
RESEARCH/
test-results/
스킬/MCP가 명시적으로 요구하는 도구 작업 폴더
```

`RESEARCH/`와 도구 작업 폴더는 운영 구조가 아니라 작업 흔적이다. 채택된 결론은 `AGENTS.md` 또는 `ARCHITECTURE.md` 같은 기존 운영 문서에 반영한다.

`test-results/`는 테스트 실행 환경이 아니다. 외부 `TEST_WORK_DIR`에서 실행한 뒤 복사해도 되는 최종 요약 결과만 담는다.

## 로컬 환경 변수 계약

실제 의존성 설치, 테스트, 빌드는 아래 경로/모드 변수가 있을 때만 허용한다. 이 값들은 `local.paths.env` 또는 실행 환경에서 관리한다.

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

`PROJECT_ROOT`는 이 템플릿이 적용된 프로젝트 루트다.

`CLOUD_SYNC_ROOT`는 Google Drive 같은 클라우드 동기화 루트다.

`LOCAL_ROOT`는 AI가 임의로 만들지 않는다. AI는 기존 로컬 후보를 탐색해서 제안만 할 수 있다. 사용자가 확정하기 전까지 의존성 설치, 테스트, 빌드는 금지한다.

`PROJECT_UNITS`는 멀티스택 프로젝트일 때 루트가 조율해야 할 unit 이름 목록이다. 단일 스택 프로젝트에서는 비워둘 수 있다.

`PRD_FILE`은 앱 개발 요구사항의 기준 파일이다. 프로젝트 적용 모드에서 앱 구현 작업은 이 파일을 먼저 읽고 시작한다.

`UNIT_CONFIG`는 프로젝트 적용 모드에서 멀티스택 unit 계약을 기록하는 공유 설정 파일이다. 템플릿 원본 모드에서는 파일을 만들지 않는다.

`PREFLIGHT_COMMAND`는 프로젝트 적용 모드에서 실제 검사 스크립트가 위치해야 하는 표준 진입점이다. 템플릿 원본 모드에서는 파일을 만들지 않는다.

### LOCAL_ROOT 컨벤션

`LOCAL_ROOT`는 클라우드 동기화가 되지 않는 로컬 디스크 경로다. 모든 머신에서 동일한 규칙을 따른다.

| 환경 | LOCAL_ROOT 기본값 | 예시 |
| --- | --- | --- |
| Windows | `C:\dev\{PROJECT_NAME}` | `C:\dev\my-app` |
| Mac | `~/dev/{PROJECT_NAME}` | `~/dev/my-app` |
| WSL | `~/dev/{PROJECT_NAME}` | `~/dev/my-app` |

`LOCAL_ROOT` 아래 구조:

```text
{LOCAL_ROOT}/
├── envs/{PROJECT_NAME}/     # 가상환경 (.venv)
├── caches/{PROJECT_NAME}/   # 패키지 캐시 (pip, npm, cargo 등)
├── builds/{PROJECT_NAME}/   # 빌드 작업장
│   ├── macos/
│   └── windows/
└── tests/{PROJECT_NAME}/    # 테스트 실행 환경
```

규칙:

```text
1. LOCAL_ROOT는 Google Drive, OneDrive, Dropbox 등 클라우드 동기화 경로 밖이어야 한다.
2. 같은 프로젝트를 여러 머신에서 사용할 때, LOCAL_ROOT의 절대경로는 머신마다 다를 수 있다.
3. 공용 템플릿 원본의 local.paths.env는 빈값 또는 동적 변수식만 둔다.
4. 프로젝트 적용 후 각 머신 복사본의 local.paths.env에 해당 머신의 실제 LOCAL_ROOT를 기록한다.
5. Git 제외는 원격 Git 유출과 커밋 충돌을 막는 장치다. Google Drive 동기화 충돌이 생기는 환경에서는 이 파일을 빈 템플릿값으로 되돌리거나 머신별 복사본에서만 실제 값을 유지한다.
6. LOCAL_ROOT 아래 폴더는 언제든 삭제하고 다시 만들 수 있어야 한다.
```

`local.paths.env` 작성 예시 (Windows):

```text
FRAMEWORK_MODE=project
PROJECT_NAME=my-app
PROJECT_ROOT=D:\Google Drive\projects\my-app
CLOUD_SYNC_ROOT=D:\Google Drive
LOCAL_ROOT=C:\dev\my-app
ENV_DIR=C:\dev\my-app\envs\my-app
CACHE_DIR=C:\dev\my-app\caches\my-app
BUILD_DIR=C:\dev\my-app\builds\my-app
TEST_WORK_DIR=C:\dev\my-app\tests\my-app
```

`local.paths.env` 작성 예시 (Mac):

```text
FRAMEWORK_MODE=project
PROJECT_NAME=my-app
PROJECT_ROOT=/Users/me/Google Drive/projects/my-app
CLOUD_SYNC_ROOT=/Users/me/Google Drive
LOCAL_ROOT=/Users/me/dev/my-app
ENV_DIR=/Users/me/dev/my-app/envs/my-app
CACHE_DIR=/Users/me/dev/my-app/caches/my-app
BUILD_DIR=/Users/me/dev/my-app/builds/my-app
TEST_WORK_DIR=/Users/me/dev/my-app/tests/my-app
```

## 환경 파일 분리 정책

환경 파일은 두 종류로 나눈다.

```text
local.paths.env          # 템플릿 원본에서는 빈/동적 값, 프로젝트 적용 후 머신별 실제 경로
.env.secret              # 템플릿 원본에서는 빈 파일, 필요 시 사용자가 비밀 환경 변수 직접 입력
```

`local.paths.env`에는 비밀이 아닌 경로/모드 값만 둔다.

```text
FRAMEWORK_MODE=
PROJECT_NAME=
PROJECT_UNITS=
PRD_FILE=
PROJECT_ROOT=
CLOUD_SYNC_ROOT=
LOCAL_ROOT=
ENV_DIR=
CACHE_DIR=
BUILD_DIR=
TEST_WORK_DIR=
MACOS_BUILD_DIR=
WINDOWS_BUILD_DIR=
RELEASE_DIR=
TEST_RESULTS_DIR=
UNIT_CONFIG=
PREFLIGHT_COMMAND=
```

`.env.secret`에는 필요 시 API 키, 토큰, 비밀번호, 인증값 같은 비밀 환경 변수를 둔다. 템플릿 원본에서는 빈 파일로 유지한다. AI는 `.env.secret` 파일의 존재 여부만 확인할 수 있고, 내용에는 접근하지 않는다.

파일 복사 기준:

```text
local.paths.env와 .env.secret은 개인 사용을 위한 실제 복사 파일이다.
공용 템플릿 원본에서는 local.paths.env를 빈값 또는 동적 변수식으로 유지하고, .env.secret은 빈 파일로 유지한다.
프로젝트 적용 후 각 머신에서는 local.paths.env 값을 해당 머신에 맞게 채운다.
두 파일은 Git 제외 대상이므로, Git 저장소로 템플릿을 관리할 때는 누락될 수 있다.
개인 프레임워크는 파일 복사 방식으로 운영한다.
```

검증 규칙:

```text
LOCAL_ROOT는 PROJECT_ROOT 하위가 아니어야 한다.
LOCAL_ROOT는 CLOUD_SYNC_ROOT 하위가 아니어야 한다.
PRD_FILE은 PROJECT_ROOT 하위의 ./PRD.md여야 한다.
ENV_DIR, CACHE_DIR, BUILD_DIR은 LOCAL_ROOT 하위여야 한다.
TEST_WORK_DIR은 LOCAL_ROOT 하위여야 한다.
MACOS_BUILD_DIR과 WINDOWS_BUILD_DIR은 BUILD_DIR 하위여야 한다.
RELEASE_DIR은 PROJECT_ROOT 하위의 ./releases여야 한다.
TEST_RESULTS_DIR은 PROJECT_ROOT 하위의 ./test-results여야 한다.
UNIT_CONFIG가 있으면 PROJECT_ROOT 하위의 ./config 안에 있어야 한다.
PREFLIGHT_COMMAND가 있으면 PROJECT_ROOT 하위의 ./scripts/setup 안에 있어야 한다.
```

## 멀티스택 Unit 계약

하나의 프로젝트가 여러 기술 스택을 동시에 사용할 수 있다. 이 경우 루트는 실제 구현 스택을 직접 가정하지 않고, unit 목록과 lifecycle만 조율한다.

단일 스택 프로젝트:

```text
src/
tests/
```

멀티스택 프로젝트:

```text
apps/<unit-name>/
services/<unit-name>/
packages/<unit-name>/
```

프로젝트 적용 모드에서 멀티스택을 쓰면 `PROJECT_UNITS`와 `UNIT_CONFIG`를 사용한다. `UNIT_CONFIG`는 Git 대상이며, 재건 가능한 설정만 담는다.

`UNIT_CONFIG` 최소 항목:

```text
name
kind                  # app | service | package | tool
path                  # apps/web, services/api 같은 프로젝트 상대경로
stack                 # python, typescript, swift, rust 등 설명용 값
package_manager
depends_on            # 먼저 준비/빌드해야 하는 unit 이름 목록
dev_command
test_command
lint_command
typecheck_command
build_command
env_requirements      # 필요한 변수 이름만, 값 금지
outputs               # 최종 산출물 상대경로 또는 LOCAL_ROOT 산출물 설명
```

Unit 규칙:

1. 각 unit은 자신의 manifest와 lockfile을 가진다.
2. 각 unit의 의존성, 캐시, 빌드 작업장, 테스트 실행 환경은 `LOCAL_ROOT` 아래로만 보낸다.
3. 루트 lifecycle은 unit 명령을 순서대로 호출하는 오케스트레이션만 담당한다.
4. unit 사이의 순서는 `depends_on`으로 명시한다.
5. 공유 코드는 `packages/`에 두고, 빌드 산출물은 Git과 Drive에 남기지 않는다.
6. unit 설정에는 비밀값, 로컬 절대경로, 사용자별 인증 파일 경로를 쓰지 않는다.
7. 여러 unit이 같은 산출물 경로를 쓰면 blocker로 본다.

표준 lifecycle 이름:

```text
setup
preflight
run
test
lint
typecheck
build
release-check
```

특정 스택 명령은 이 문서에 하드코딩하지 않는다. 실제 명령은 프로젝트 적용 모드에서 `UNIT_CONFIG` 또는 `scripts/`의 표준 진입점에 연결한다.

## Preflight 자동 점검 계약

프로젝트 적용 모드에서 의존성 설치, 테스트, 빌드, 릴리즈, 원격 push 전에는 `PREFLIGHT_COMMAND`를 통과해야 한다.

템플릿 원본 모드에는 스택 중립 `scripts/setup/preflight`와 Windows용 `scripts/setup/preflight.ps1`만 둔다. 프로젝트 적용 모드에서는 이 진입점을 프로젝트 상황에 맞게 확장할 수 있다.

Preflight 최소 검사:

```text
운영 파일 존재 여부: AGENTS.md, ARCHITECTURE.md, .gitignore
PRD 게이트: 앱 구현 작업 전에 PRD.md 존재 여부와 프로젝트 적용 모드에서의 내용 여부
모드/경로 변수: FRAMEWORK_MODE, PROJECT_NAME, PROJECT_ROOT, CLOUD_SYNC_ROOT, LOCAL_ROOT
외부 루트: LOCAL_ROOT가 PROJECT_ROOT와 CLOUD_SYNC_ROOT 밖인지
작업장 경로: ENV_DIR, CACHE_DIR, BUILD_DIR, TEST_WORK_DIR가 LOCAL_ROOT 아래인지
결과 경로: RELEASE_DIR과 TEST_RESULTS_DIR가 PROJECT_ROOT 아래 허용 위치인지
Git 상태: Git 저장소 여부, staged 파일, ignored 파일 규칙
비밀값 추적: .env*, *.key, *.pem, credentials.json, token.json 추적 여부
금지 폴더: node_modules, .venv, dist, build, coverage, raw test artifact가 PROJECT_ROOT 안에 없는지
테스트 결과: test-results에는 최종 요약만 있는지
멀티스택: PROJECT_UNITS와 UNIT_CONFIG의 unit 목록/경로/depends_on이 일치하는지
재현성: unit별 manifest와 lockfile 존재 여부
```

Preflight 출력:

```text
통과       → 다음 단계 실행 가능
실패       → 실패 항목과 근본 원인 후보를 보고하고 중단
알 수 없음 → blocker로 보고하고 설치/테스트/빌드/push 금지
```

Preflight 결과는 긴 raw 로그로 Drive에 남기지 않는다. 최종 요약이 필요한 경우에만 `TEST_RESULTS_DIR` 또는 릴리즈 manifest에 최소 결과를 남긴다.

## 의존성 설치 정책

의존성 자동 설치는 허용한다. 단, 설치 위치가 반드시 `LOCAL_ROOT` 아래로 통제되어야 한다.

의존성 재현성:

```text
Git에 남길 것   → manifest와 lockfile
Git에서 뺄 것   → 실제 설치된 의존성 폴더
Drive에서 뺄 것 → 실제 설치된 의존성 폴더와 캐시
```

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

manifest/lockfile 변경은 의존성 변경으로 보고, 작업 보고에 이유를 포함한다.

허용:

```text
외부 가상환경에 설치 가능한 Python 의존성
캐시/빌드/설치 위치를 LOCAL_ROOT 아래로 지정할 수 있는 도구
```

금지:

```text
프로젝트 내부에만 설치되는 의존성
Google Drive 동기화 폴더 안에 생성되는 의존성
설치 위치를 확인할 수 없는 도구
```

내부 설치만 가능한 도구라면 AI는 실행하지 않는다. 대신 blocker로 보고한다. 프로젝트 적용 모드에서는 `HANDOVER.md`의 `해야 할 일`에도 남긴다. 템플릿 원본 모드에서는 `HANDOVER.md`를 수정하지 않는다.

패키지 매니저별 주의:

```text
npm 로컬 설치는 기본적으로 현재 패키지 루트의 node_modules에 설치된다.
Google Drive 프로젝트 폴더에서 npm install/npm ci는 기본적으로 금지한다.
npm cache만 LOCAL_ROOT로 옮기는 것은 충분하지 않다.
node_modules가 프로젝트 내부에 생기면 정책 위반이다.
```

## 테스트 정책

테스트 코드는 프로젝트 내부에 둔다. 테스트 실행 환경과 중간 산출물은 프로젝트 밖에 둔다.

```text
테스트 코드/fixture/helper        → ./tests 또는 각 unit의 tests
테스트 실행 환경/임시 DB/raw 로그 → ${TEST_WORK_DIR}
최종 테스트 결과 요약             → ${TEST_RESULTS_DIR}
```

규칙:

1. 테스트 실행은 `TEST_WORK_DIR` 또는 그 하위 작업장에서 수행한다.
2. 테스트용 가상환경, 브라우저 상태, 시뮬레이터 상태, 임시 DB, raw 로그, trace, video, coverage 원자료는 `PROJECT_ROOT`와 `CLOUD_SYNC_ROOT` 안에 만들지 않는다.
3. `TEST_RESULTS_DIR`에는 최종 요약 리포트, 최종 상태 JSON, 재실행 명령, source commit, 실행 시간, known failures 같은 최소 결과만 둔다.
4. `TEST_RESULTS_DIR`는 Google Drive에 남길 수 있지만 Git에는 올리지 않는다.
5. 실패 테스트의 raw artifact가 필요하면 먼저 `TEST_WORK_DIR`에 보관하고, 최종 판단에 필요한 요약만 `TEST_RESULTS_DIR`로 복사한다.
6. 테스트 결과에 비밀값, 토큰, 사용자 개인 데이터, raw 환경 변수를 포함하지 않는다.
7. 테스트 환경을 재현하는 정보는 Git의 manifest, lockfile, 테스트 코드, 설정 템플릿으로 남기고, 실제 실행 환경 자체는 Git이나 Drive에 복사하지 않는다.

`TEST_RESULTS_DIR`의 권장 최소 항목:

```text
summary.json
summary.txt
failed-tests.txt
commands.txt
environment.txt
```

`environment.txt`에는 OS, 런타임 버전, 패키지 매니저, 주요 명령만 기록한다. 로컬 절대경로, 비밀값, 인증 파일 경로는 기록하지 않는다.

## 빌드 정책

빌드 작업장은 항상 로컬 디스크의 고정 경로를 사용한다.

```text
Mac 빌드 작업장     → ${MACOS_BUILD_DIR}
Windows 빌드 작업장 → ${WINDOWS_BUILD_DIR}
공통 캐시           → ${CACHE_DIR}
최종 앱 보관소      → ${RELEASE_DIR}
```

빌드 규칙은 완전 범용 경로 계약만 제공한다. 특정 스택의 빌드 명령은 이 문서에 넣지 않는다.

## Mac / Windows 릴리즈 규칙

Mac 앱과 Windows 앱은 항상 같은 버전의 한 세트로 관리한다.

```text
releases/<version>/
├── manifest.json
├── checksums.txt
├── macos/
└── windows/
```

규칙:

1. Mac 빌드는 `${MACOS_BUILD_DIR}`에서 수행한다.
2. Windows 빌드는 `${WINDOWS_BUILD_DIR}`에서 수행한다.
3. 둘 다 성공하기 전에는 `releases/<version>/`을 최종 릴리즈로 보지 않는다.
4. 한쪽만 성공한 결과는 로컬 빌드 작업장에만 남긴다.
5. 최종 앱만 `releases/<version>/macos/`와 `releases/<version>/windows/`에 복사한다.
6. 앱 바이너리는 Git에는 올리지 않는다.
7. Git에는 `manifest.json`, `checksums.txt` 같은 기록 파일만 올릴 수 있다.

`manifest.json` 최소 항목:

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

`known_gaps`가 비어 있지 않으면 최종 릴리즈로 보지 않는다.

반쪽 릴리즈 처리:

```text
Mac 또는 Windows 중 한쪽만 성공:
→ releases/<version>/을 최종 릴리즈로 만들지 않음
→ 성공 산출물은 LOCAL_ROOT 아래 빌드 작업장에만 유지
→ 프로젝트 적용 모드에서는 HANDOVER.md의 "해야 할 일"에 남은 플랫폼 빌드 기록
```

## LESSONS.md 규칙

템플릿 원본 모드에서는 빈 파일이어야 한다.

어려운 벽을 해결했을 때만 기록한다.

```text
## YYYY-MM-DD - 짧은 제목

- 문제:
- 원인:
- 해결:
- 다음에 피할 것:
```

## HANDOVER.md 규칙

템플릿 원본 모드에서는 빈 파일이어야 한다.

다음 AI가 이어받기 위한 파일이다. 반드시 아래 두 섹션만 둔다.

```text
## 한 일

## 해야 할 일
```

배경 설명, 감상, 긴 분석은 넣지 않는다.

## AI 작업 전 점검

AI는 작업 전에 다음을 확인한다.

1. 지금 위치가 템플릿 원본 모드인지 프로젝트 적용 모드인지 확인한다.
2. 실제 폴더 생성이 필요한지 사용자의 요청을 확인한다.
3. 의존성 설치 전 `LOCAL_ROOT`가 확정되어 있는지 확인한다.
4. 빌드 전 `BUILD_DIR`, `MACOS_BUILD_DIR`, `WINDOWS_BUILD_DIR`가 확정되어 있는지 확인한다.
5. 내부 설치만 가능한 도구라면 실행하지 않고 blocker로 보고한다.
6. 여러 tool call을 실행하기 전에는 무엇을 확인/수정할지 짧게 보고한다.
7. 원격 push 전에는 원격 Push 게이트를 통과한다.

## 환경 부트스트랩 워크플로

템플릿을 복사한 후 새 머신에서 개발 환경을 세팅하는 표준 절차다. 이 절차는 프로젝트 적용 모드에서 사용한다.

### Python 프로젝트 (uv 기준)

uv는 Python 프로젝트의 권장 패키지 매니저다. `UV_PROJECT_ENVIRONMENT` 환경변수를 사용하면 가상환경이 프로젝트 내부가 아닌 `ENV_DIR`에 생성된다.

```text
1. uv가 설치되어 있는지 확인한다.
   uv --version

2. local.paths.env의 LOCAL_ROOT, ENV_DIR를 채운다.

3. ENV_DIR 경로에 가상환경을 만든다.

   # Mac/WSL
   export UV_PROJECT_ENVIRONMENT="${ENV_DIR}"
   cd <PROJECT_ROOT>
   uv sync

   # Windows PowerShell
   $env:UV_PROJECT_ENVIRONMENT = "${ENV_DIR}"
   cd <PROJECT_ROOT>
   uv sync

4. 가상환경 활성화:
   # Mac/WSL
   source ${ENV_DIR}/bin/activate

   # Windows PowerShell
   & ${ENV_DIR}\Scripts\Activate.ps1

5. 이후 uv add/uv remove로 의존성을 변경하면
   pyproject.toml과 uv.lock이 프로젝트 폴더(Drive)에 업데이트되고,
   실제 패키지는 ENV_DIR(로컬)에만 설치된다.
```

### Node/Tauri 프로젝트

npm/pnpm은 기본적으로 `node_modules`를 프로젝트 내부에 만든다. 이것은 Google Drive 동기화 대상이 되므로, Node 의존 프로젝트는 추가 전략이 필요하다.

```text
전략 1: LOCAL_ROOT에 프로젝트 미러를 만들고 거기서 설치/실행
  1. LOCAL_ROOT 아래에 프로젝트 작업 폴더를 만든다.
  2. 소스 파일은 Drive에서 읽고, node_modules는 LOCAL_ROOT에만 둔다.
  3. symlink 또는 junction으로 소스를 연결하거나, 빌드 시에만 LOCAL_ROOT에 복사한다.

전략 2: pnpm의 가상 저장소 기능 활용
  pnpm은 --store-dir로 패키지 저장소를 외부로 보낼 수 있다.
  단, node_modules/.pnpm은 여전히 프로젝트 내부에 생기므로 완전한 해결은 아니다.

전략 3: Tauri 전용
  Tauri 프로젝트는 src-tauri/를 Rust(cargo) 기반으로 빌드한다.
  cargo의 CARGO_TARGET_DIR를 BUILD_DIR로 지정하면 빌드 산출물을 외부로 보낼 수 있다.
  export CARGO_TARGET_DIR=${BUILD_DIR}/cargo-target
```

npm/pnpm 캐시 분리:

```text
npm config set cache ${CACHE_DIR}/npm-cache
pnpm config set store-dir ${CACHE_DIR}/pnpm-store
```

### 부트스트랩 검증

환경 부트스트랩 후 preflight를 실행하여 설정이 올바른지 확인한다.

```text
# Mac/WSL
./scripts/setup/preflight

# Windows PowerShell
.\scripts\setup\preflight.ps1
```

## 템플릿 복사 후 체크리스트

이 템플릿을 새 프로젝트 폴더로 복사한 후 수행할 작업이다.

```text
1. [ ] FRAMEWORK_MODE=project로 변경 (local.paths.env)
2. [ ] PROJECT_NAME 설정
3. [ ] PROJECT_ROOT를 현재 프로젝트 폴더의 절대경로로 설정
4. [ ] CLOUD_SYNC_ROOT를 Google Drive 루트 경로로 설정
5. [ ] LOCAL_ROOT를 로컬 디스크 경로로 설정 (컨벤션: Windows C:\dev\{name}, Mac ~/dev/{name})
6. [ ] ENV_DIR, CACHE_DIR, BUILD_DIR, TEST_WORK_DIR를 LOCAL_ROOT 기준으로 설정
7. [ ] LOCAL_ROOT 폴더 구조 생성 (mkdir)
8. [ ] PRD.md에 프로젝트 요구사항 작성
9. [ ] preflight 실행하여 설정 검증
10. [ ] 환경 부트스트랩 실행 (uv sync 등)
11. [ ] .env.secret에 필요한 비밀값 직접 입력 (AI 개입 불가)
```

다른 머신에서 같은 프로젝트를 처음 여는 경우:

```text
1. [ ] Google Drive 동기화로 프로젝트 폴더가 접근 가능한지 확인
2. [ ] local.paths.env를 해당 머신에 맞게 작성 (공용 템플릿 원본은 빈/동적 값 유지)
3. [ ] LOCAL_ROOT 폴더 구조 생성
4. [ ] 환경 부트스트랩 실행
5. [ ] preflight 실행하여 설정 검증
```
