# Playlist Overlay and Render Cancellation Design

## 목표

Auto Pair와 Multi-Pair에서 폴더명을 작업 묶음의 플레이리스트 제목으로 사용하고, Sound Forge가 생성하는 최종 MP4 프레임의 좌측 상단에 표시한다. 기존 곡 제목 배지는 우측 상단에 유지한다. 긴 렌더링 작업은 사용자가 명시적으로 중단할 수 있고, 창을 닫을 때도 실행 중인 인코딩을 정리한다.

## 확정된 영상 프레임 디자인

선택안 A인 `Editorial rail`을 사용한다.

- 좌측 상단: 앰버 세로선, 작은 `PLAYLIST` 라벨, 큰 폴더명
- 우측 상단: 기존 곡 제목 배지와 `NOW PLAYING` 보조 라벨
- 플레이리스트 제목은 영상 이미지 위에서 읽을 수 있도록 어두운 비네트와 그림자를 사용한다.
- 곡 제목 배지와 폰트·앰버 색상·간격 체계는 공유하지만, 좌측 제목은 세로선과 큰 세리프 제목으로 역할을 구분한다.
- 긴 폴더명은 렌더 전에 안전한 표시 문자열로 제한하고, 파일명에는 기존 경로 안전화 규칙을 적용한다.

## 제목 및 출력 파일명 데이터 흐름

1. Auto Pair 폴더 선택 결과에서 `path.basename(folderPath)`를 `playlistTitle`로 만든다.
2. Multi-Pair에서는 첫 번째 페어 오디오 경로의 부모 폴더 basename을 `playlistTitle`로 만든다. 이후 다른 폴더의 페어를 추가해도 첫 제목을 유지한다.
3. Renderer는 `playlistTitle`을 preview canvas의 좌측 상단 오버레이에 전달하고, 각 Auto/Multi 곡의 우측 상단 곡 제목 배지는 기존 방식으로 계속 생성한다.
4. 저장 대화상자의 기본 파일명은 `${playlistTitle}.mp4`로 제안한다. 사용자가 저장 대화상자에서 직접 파일명을 바꾸면 그 선택을 유지한다.
5. Main process 렌더 요청에는 `playlistTitle`을 검증된 문자열로 전달한다. FFmpeg 배지 PNG 생성 단계에서 플레이리스트 오버레이와 곡 제목 배지를 각각 합성하거나, 단일 프레임 합성 시 두 레이어의 위치를 명시적으로 유지한다.

## 렌더 중단 및 창 닫기

- Renderer busy panel에 `Cancel render` 버튼을 추가한다.
- Main process는 현재 렌더 요청과 FFmpeg child process를 추적하는 취소 핸들을 유지한다.
- 취소 IPC가 오면 현재 child process에 종료 신호를 보내고, Multi-Pair의 다음 페어와 concat 단계를 시작하지 않는다.
- `finally`에서 stage directory, badge PNG, temporary output을 정리한다. 최종 output 경로에는 불완전한 파일을 남기지 않는다.
- 창 `close` 이벤트에서 렌더가 진행 중이면 취소를 먼저 요청하고 정리 완료 후 창을 닫는다. 닫기 작업이 멈추지 않도록 중복 close 방지 상태를 둔다.
- 취소는 정상 완료와 구분되는 사용자 취소 오류 코드로 renderer에 전달하며, 완료 카드에는 표시하지 않는다.

## 중복 실행 방지

- Electron 단일 인스턴스 잠금을 유지한다.
- 두 번째 실행은 새 BrowserWindow를 만들지 않고 기존 창을 복원·포커스한다.
- Main process의 `renderActive`와 렌더 취소 핸들은 동시에 둘 이상의 인코딩을 허용하지 않는다.

## 테스트 기준

- Auto Pair 제목이 선택 폴더 basename과 일치하고 기본 출력명이 `${folder}.mp4`인지 확인한다.
- Multi-Pair 제목이 첫 페어 부모 폴더 basename과 일치하고, 다른 폴더의 페어를 추가해도 변하지 않는지 확인한다.
- Canvas preview와 최종 FFmpeg output에서 플레이리스트는 좌측 상단, 곡 제목은 우측 상단에 표시되는지 확인한다.
- 단일 렌더와 Multi-Pair 렌더 중 취소하면 child process가 종료되고 stage/temporary output이 정리되는지 확인한다.
- 렌더 중 창 닫기는 자동 취소 후 종료되는지 확인한다.
- 두 번째 앱 실행이 새 창을 만들지 않고 기존 창을 앞으로 가져오는지 E2E로 확인한다.

## 범위 제외

- Single Pair의 출력 프레임에는 플레이리스트 제목을 추가하지 않는다.
- 사용자가 폴더명을 직접 편집하는 플레이리스트 편집 UI는 이번 범위에 포함하지 않는다.
- 중단 이후 자동 재개나 부분 결과 복구는 제공하지 않는다.
