## 한 일

- Sound Forge Electron MVP를 구현했다.
- 단일 MP3와 단일 JPG/PNG 또는 H.264 MP4 선택, 저장 위치 선택, 전체 오디오 타임라인 미리보기, 반복 영상 동기화, 렌더링, 결과 앱 내 재생, Finder 열기를 구현했다.
- 이미지와 오디오를 1:1로 매핑하여 여러 개의 이미지-오디오 쌍을 순서대로 연결해 하나의 MP4로 합성하는 Multi-Pair (1:1) 모드를 구현했다.
- Multi-Pair는 1개 페어부터 시작하며 추가 페어 수에 고정 상한을 두지 않는다.
- 최근 Studio형 화면을 제거하고 기존 Sound Forge 마스터링 데스크 디자인으로 롤백했으며, Multi-Pair 컨트롤만 기존 디자인 언어에 맞춰 남겼다.
- `Reset session`으로 선택 상태·미리보기·결과 상태를 한 번에 초기화한다.
- MP3에 첨부된 artwork를 원본 그림 스트림 그대로 시각 자료로 쓰는 옵션을 단일 작업과 Multi-Pair에 추가했다.
- FFmpeg 8.1.2와 FFprobe를 LGPL 구성으로 x86_64/arm64 Universal 빌드해 앱에 포함했다.
- YouTube용 1080p30 H.264 High, BT.709, AAC-LC, Fast Start 고정 출력과 오디오 길이 기준 종료를 구현했다.
- 인터넷 원본 MP3 287.998685초, 이미지, 4.633333초·13.333333초·39.7초 영상을 받아 출처와 해시를 기록했다.
- 이미지, 4.633333초 영상, 39.7초 영상으로 각각 288초 산출물을 만들고 규격, 반복, 프레임 무결성, 앱 내 재생을 검증했다.
- macOS Universal 앱을 Drive 밖 빌드 폴더에 패키징하고 Intel Mac에서 실행을 확인했다.
- 우측 상단에 노래 제목 워터마크(Title Badge Overlay)를 실시간 미리보기 및 MP4 렌더링 결과물에 오버레이하는 기능을 단일 및 Multi-Pair 모드에 구현했다.
- Title Badge Overlay 사용 시 실시간 플레이어 미리보기 캔버스 렌더링 누적 및 FFmpeg overlay 크로마 서브샘플링으로 인한 테두리 잔상/노이즈 현상을 해결했다 (`drawPreview` 내 clearRect 적용 및 FFmpeg `overlay=format=auto` 지정).
- 이전 버전과 명확히 구분되도록 Sound Forge UI 테마(Gold/Amber)에 맞춘 5-바 이퀄라이저 웨이브폼 스쿼클 아이콘(assets/icon.png, assets/icon.icns)을 제작하고 앱 및 빌드 설정에 적용했다.
- 원격 저장소를 사용하지 않고 로컬 브랜치(feature/app-icon-update)에 파일 단위로 커밋을 완료했다.

## 해야 할 일

- Apple Silicon Mac에서 arm64 실행과 실제 렌더링을 검증한다.
- 배포 전 Apple Developer ID 서명과 notarization을 적용한다.
- FFmpeg 네이티브 AAC는 384 kbps를 요청하지만 현재 샘플의 실제 평균은 약 265 kbps이므로, 384 kbps 고정이 출시 조건이면 인코더 전략을 확정한다.
- arm64 검증과 서명을 마친 뒤에만 `releases/`로 최종 승격한다.
- 첨부 artwork가 포함된 실제 인터넷 MP3로 GUI 선택 및 최종 렌더링을 추가 검증한다.
