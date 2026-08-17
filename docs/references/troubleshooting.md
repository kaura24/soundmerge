# Sound Forge Troubleshooting

이 문서는 Sound Forge 개발·테스트·빌드 중 실제로 재현된 문제와 확인된 해결 방법을 기록한다. 증상이 같더라도 원인 확인 없이 다른 인코더나 임시 경로로 우회하지 않는다.

## 빠른 진단표

| 증상 | 확인된 원인 | 조치 |
| --- | --- | --- |
| Electron CLI가 `SIGABRT`로 즉시 종료 | Codex 셸 샌드박스에서 AppKit 앱 등록 실패 | macOS GUI 컨텍스트에서 `open`으로 실행 |
| FFmpeg `Cannot create compression session: -12903` | 셸 샌드박스에서 VideoToolbox 세션이 무효 | Electron GUI 컨텍스트의 자식 프로세스로 FFmpeg 실행 |
| Renderer에서 `require is not defined` | 브라우저에서 CommonJS 전용 공유 스크립트 로드 | 공유 스크립트를 IIFE/UMD 형태로 유지하고 Node `require` 금지 |
| Renderer에서 `Identifier ... has already been declared` | 공유 스크립트와 renderer가 같은 전역 `const` 이름 사용 | 공유 스크립트의 모든 내부 선언을 IIFE 안에 격리 |
| `electron: command not found` | 프로젝트 내부 `node_modules`를 만들지 않는 정책 | 외부 `ENV_DIR/node_modules/.bin`을 PATH에 연결 |
| FFmpeg가 TEST_WORK_DIR에 쓰지 못함 | 외부 작업 폴더 권한 미승인 | 정확한 TEST_WORK_DIR 쓰기 권한 요청 후 같은 명령 재실행 |
| 빌드 후 프로젝트에 `node_modules`·리터럴 캐시 폴더 생성 | electron-builder를 Drive 프로젝트 루트에서 직접 실행 | `npm run package:mac` 외부 작업공간 스크립트 사용 |

## Electron이 셸에서 `SIGABRT`로 종료

### 증상

```text
Electron exited with signal SIGABRT
```

`Electron --version`만 실행해도 종료 코드 134가 발생했다. 앱 코드와 무관하게 재현됐다.

### 확인된 원인

macOS 충돌 보고서의 faulting thread가 다음 경로에서 `abort()`를 호출했다.

```text
_RegisterApplication
GetCurrentProcess
_NSInitializeAppContext
[NSApplication init]
```

이는 Electron 소스나 Sound Forge 아이콘 문제가 아니라, Codex 셸 샌드박스가 macOS GUI 세션에 AppKit 앱을 등록하지 못한 것이다. 동일 Electron 앱을 LaunchServices의 `open`으로 실행하면 새 충돌 보고서 없이 정상 실행됐다.

### 실행 방법

```bash
open -W -n -g \
  -o /tmp/sound-forge-smoke.out \
  --stderr /tmp/sound-forge-smoke.err \
  /path/to/Electron.app \
  --args /absolute/path/to/tests/e2e/smoke.js
```

검증 결과는 지정한 stdout/stderr 파일에서 읽는다. 개발용 Electron을 이렇게 실행하면 Dock 아이콘은 Electron 기본 아이콘이다. 최종 Sound Forge 아이콘 검증은 패키징된 앱에서만 한다.

## VideoToolbox 오류 `-12903`

### 증상

```text
h264_videotoolbox: Cannot create compression session: -12903
```

### 확인된 의미

macOS SDK의 `VideoToolbox.framework/Headers/VTErrors.h` 기준 `-12903`은 `kVTInvalidSessionErr`이다. `kVTVideoEncoderNotAvailableNowErr`는 `-12915`이므로 둘을 혼동하지 않는다.

### 진단 결과

- 번들 FFmpeg와 시스템 FFmpeg가 Codex 셸에서 모두 같은 `-12903`으로 실패했다.
- 640×360과 1920×1080 모두 실패해 해상도·픽셀 포맷 문제가 아니었다.
- 시스템 FFmpeg의 `libx264`는 성공했지만, GPL 인코더라서 프로젝트의 LGPL 번들 정책을 대체하는 근거로 사용하지 않았다.
- Electron을 `open`으로 실행하고 그 GUI 프로세스가 번들 FFmpeg를 자식으로 실행하면 `h264_videotoolbox`가 종료 코드 0으로 성공했다.

### 해결 방법

렌더 검증과 실제 앱 실행은 macOS GUI 컨텍스트에서 수행한다. 셸 샌드박스에서 실패했다는 이유로 `libx264` fallback을 추가하거나 FFmpeg 라이선스 구성을 바꾸지 않는다.

## 브라우저 공유 스크립트 로드 실패

### 증상

```text
Uncaught ReferenceError: require is not defined
Uncaught SyntaxError: Identifier 'playlistDomain' has already been declared
```

### 원인

`src/shared/playlist-domain.js`가 브라우저에서도 로드되는데 Node의 `require('node:path')`를 호출했다. 또한 공유 스크립트의 전역 `const playlistDomain`과 `src/renderer/renderer.js`의 동일 이름 선언이 충돌했다.

### 해결

- 공유 도메인 파일은 IIFE 안에서 모든 변수를 선언한다.
- Node와 브라우저가 함께 쓰는 파일은 `typeof module !== 'undefined'`일 때만 `module.exports`를 설정한다.
- 브라우저 경로 계산은 순수 문자열 함수로 처리한다.
- 회귀 테스트는 다음 명령으로 실행한다.

```bash
node --test tests/unit/browser-shared-scripts.test.js
```

## 외부 의존성과 작업 경로

프로젝트가 Google Drive 안에 있으므로 프로젝트 루트에 `node_modules`, 빌드 폴더, 테스트 raw artifact를 만들지 않는다.

```bash
set -a
. ./local.paths.env
set +a
PATH="$ENV_DIR/node_modules/.bin:$PATH" npm run test:smoke
```

단, 위 smoke 명령이 AppKit 등록에서 SIGABRT로 종료되면 PATH 문제가 아니다. 앞의 `open` GUI 실행 방법을 사용한다.

## macOS 패키징이 프로젝트를 오염시키는 경우

electron-builder를 Drive 프로젝트 루트에서 직접 실행하면 의존성 확인 과정에서 `node_modules`가 생성될 수 있다. `${env.ELECTRON_CACHE_DIR}`를 config 값으로 사용하면 변수 치환 없이 같은 이름의 캐시 폴더가 프로젝트에 만들어질 수도 있다.

직접 electron-builder를 실행하지 않고 다음 명령을 사용한다.

```bash
npm run package:mac
```

`scripts/maintenance/package-macos`는 preflight를 먼저 실행하고, `ENV_DIR/package-work.*` 임시 작업공간에 소스와 번들 media-tools를 복사한다. Electron 캐시와 npm 캐시도 `CACHE_DIR` 아래에 둔다. 빌드가 끝나면 임시 작업공간을 제거하고 Universal 앱만 `MACOS_BUILD_DIR`에 남긴다.

## 완료 전 확인

- 동일 실패 명령을 수정 후 다시 실행했는가?
- 임시 `[DEBUG-...]` 로그를 제거했는가?
- 프로젝트 루트에 테스트·빌드 부산물이 남지 않았는가?
- 인코더나 라이선스 정책을 임의로 바꾸지 않았는가?
- 실제 3곡 렌더와 `ffprobe` 결과를 최종 테스트 요약에 남겼는가?

## 2026-08-17 해결 검증

- 브라우저 공유 스크립트 회귀 테스트 6개가 통과했다.
- Electron GUI smoke가 `hasCancelBridge`, `hasCancelButton`, A/B/E 템플릿, 3초/5초 컨트롤을 포함해 통과했다.
- Electron GUI 컨텍스트의 번들 FFmpeg VideoToolbox 1초 인코딩이 종료 코드 0으로 성공했다.
- `List1` 실제 MP3 3곡 렌더가 100% 완료됐다.
- 최종 출력은 H.264 High, 1920×1080, 30fps, yuv420p, AAC-LC 48kHz stereo였다.
- 원본 합계 681.720937초와 출력 681.755646초의 차이는 0.034709초로 허용치 0.05초 이내였다.
- MP4의 `moov` atom이 offset 36에 있고 `mdat`보다 앞에 있어 Fast Start를 확인했다.
- 새 `package:mac` 외부 작업공간 빌드 후 프로젝트 루트에 `node_modules`나 Electron 캐시가 남지 않았고 preflight가 다시 통과했다.
