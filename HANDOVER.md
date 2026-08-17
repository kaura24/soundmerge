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
- Electron package 진입점에서 앱 수명주기를 직접 시작하도록 수정하고, E2E smoke가 실제 production 창과 renderer 내용을 검사하게 해 빈 창 회귀를 차단했다.
- Multi-Pair 엔진을 곡별 순차 MP4 렌더 후 stream copy concat 방식으로 교체해 입력 수 증가 시 단일 FFmpeg 프로세스가 비대해지는 문제를 제거했다.
- Multi-Pair와 Auto Pair에 곡별 누적 진행률, 현재 곡 번호, 최종 결합 단계 표시를 추가했다.
- 폴더를 선택하면 바로 아래 MP3 파일명 시작 숫자를 곡 순번으로 읽어 숫자 오름차순으로 배치하고, 번호 없는 파일은 뒤에서 자연 정렬하며, 각 파일의 내장 artwork를 자동 사용하는 Auto Pair 보드를 추가했다.
- 실제 MP3 세 곡을 곡별 렌더하고 하나의 681.755646초 MP4로 결합해 H.264 High 1080p30 BT.709, AAC-LC 48 kHz stereo, Fast Start, 길이 오차 0.05초 이내를 확인했다.
- 최신 macOS Universal 앱을 다시 패키징해 앱 본체·FFmpeg·FFprobe의 x86_64/arm64 포함과 패키지 내부 Auto Pair·진행률·배지 선합성·concat 코드를 확인했다. 구형 바탕화면 앱은 로컬 빌드 보관소로 이동하고 새 `Sound Forge.app`을 바탕화면에 배치했으며, 실제 실행 후 프로세스 유지와 최신 UI를 확인했다.
- Auto Pair 제목 배지는 전역 토글로 전체 곡에 함께 적용하거나 함께 제외하며, ID3 제목을 우선 사용한다.
- 정지 artwork와 제목 배지를 곡마다 PNG 한 장으로 사전 합성한 뒤 영상화하도록 최적화했다. 배지 포함 세 곡의 개별 렌더와 최종 concat 전체를 155.77초에 완료하고 경계 시점의 배지와 최종 규격을 확인했다.
- 카드·입력 박스·컨트롤 랙의 배경 명도와 테두리 대비를 높이고 앱·화면·배지 마크를 골드 5-바 디자인으로 통일했다.
- 2026-08-17 현재 변경분을 `9dcc8bc`로 커밋했고, Auto/Multi 플레이리스트 제목·폴더명 기반 마스터 파일명·렌더 중단·창 닫기 자동 중단·중복 실행 방지 요구사항을 PRD에 기록했다. 세 가지 플레이리스트 제목 시안은 로컬 브레인스토밍 화면에서 제공했다.

## 해야 할 일

- Apple Silicon Mac에서 arm64 실행과 실제 렌더링을 검증한다.
- 배포 전 Apple Developer ID 서명과 notarization을 적용한다.
- FFmpeg 네이티브 AAC는 384 kbps를 요청하지만 현재 샘플의 실제 평균은 약 265 kbps이므로, 384 kbps 고정이 출시 조건이면 인코더 전략을 확정한다.
- arm64 검증과 서명을 마친 뒤에만 `releases/`로 최종 승격한다.
- 첨부 artwork가 포함된 실제 인터넷 MP3로 GUI 선택 및 최종 렌더링을 추가 검증한다.
- Auto/Multi 좌측 상단 플레이리스트 제목과 폴더명 기반 기본 마스터 파일명을 구현한다.
- 렌더링 중 `Cancel render`, 창 닫기 시 FFmpeg 자동 중단과 임시 출력 정리를 구현하고 검증한다.
- `origin`을 `https://github.com/kaura24/soundmerge.git`로 등록했지만, GitHub HTTPS 인증 자격 증명이 없어 `6129820`과 `9dcc8bc`를 push하지 못했다. GitHub 인증 후 `git push origin main`을 실행한다.
