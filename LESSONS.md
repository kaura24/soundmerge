## 2026-07-25 - VideoToolbox 입력은 NV12로 고정

- 문제: FFmpeg 메타데이터 검사는 통과했지만 Universal 빌드의 VideoToolbox 산출물 일부에 자홍색·초록색 줄무늬가 생겼다.
- 원인: 커스텀 FFmpeg의 planar YUV 필터 결과를 VideoToolbox가 받는 경로에서 색상 평면이 손상됐고, 블러 필터는 NV12의 색상 평면에서도 손상을 만들었다.
- 해결: 필터 입구와 두 합성 분기를 NV12로 고정하고, 실제 디코딩 RGB 프레임의 상세도와 비정상 색상 비율을 검사하는 통합 테스트를 추가했다.
- 다음에 피할 것: 코덱·해상도·픽셀 포맷 메타데이터만으로 영상 산출물의 시각적 정상 여부를 판정하지 않는다.

## 2026-07-25 - Electron 다운로드 캐시는 명시적으로 외부화

- 문제: Drive 밖 빌드 작업장을 사용해도 electron-builder가 기본 사용자 캐시 경로에 쓰면서 제한된 실행 환경에서 패키징이 실패했다.
- 원인: 빌드 출력과 npm 캐시만 외부화했고 Electron 바이너리 다운로드 캐시는 별도 경로 계약을 사용했다.
- 해결: electron-builder 설정과 실행 환경에서 Electron 및 builder 캐시를 `LOCAL_ROOT` 아래로 지정했다.
- 다음에 피할 것: Electron 패키징 전 출력, npm, Electron 다운로드, builder 캐시를 각각 확인하지 않은 채 빌드를 시작하지 않는다.

## 2026-07-25 - Title Badge Overlay 노이즈 제거

- 문제: 워터마크 오버레이(Title Badge Overlay) 사용 시 렌더링된 MP4 및 실시간 미리보기에서 반투명 테두리와 섀도 주변에 잔상/크로마 노이즈가 발생함.
- 원인: FFmpeg `overlay` 필터가 RGBA 오버레이를 YUV420P 공간에서 직접 합성하여 크로마 서브샘플링 노이즈가 발생하고, 캔버스 미리보기에서는 매 프레임마다 이전 프레임을 `clearRect` 없이 재묘화하여 알파(반투명) 값이 누적 쌓임.
- 해결: FFmpeg `overlay` 필터에 `format=auto` 옵션을 지정하여 알파 합성 정밀도를 높이고, `drawPreview` 시작 시 `canvasContext.clearRect(0, 0, width, height)`를 호출해 프레임을 초기화함.
- 다음에 피할 것: 반투명 오버레이 처리 시 FFmpeg overlay 기본 포맷 합성에 의존하거나 캔버스 연속 프레임 렌더링 시 이전 알파 버퍼 clearing을 누락하지 않는다.

## 2026-07-25 - Electron package 진입점은 직접 시작

- 문제: 앱을 실행하면 UI 대신 빈 macOS 복원 창만 보이고 renderer target이 생성되지 않았다.
- 원인: Electron이 `package.json`의 main 파일을 내부 bootstrap에서 불러오므로 `require.main === module`이 거짓이 되어 앱 수명주기가 시작되지 않았다.
- 해결: package 진입점에서 `startApplication()`을 직접 호출하고, E2E smoke가 별도 창을 만들지 않고 실제 production 창의 생성과 renderer 로드를 검사하도록 변경했다.
- 다음에 피할 것: Electron 진입점을 일반 Node 실행 조건으로 감싸거나, 제품 bootstrap을 우회하는 테스트용 `BrowserWindow`만 검사하지 않는다.
## 2026-07-26 - Multi-Pair는 곡별 렌더 후 결합

- 문제: 여러 곡을 하나의 FFmpeg `filter_complex`에서 동시에 렌더링하면 입력 수에 따라 디코더와 필터 상태가 누적되어 앱이 멈추거나 종료될 수 있었다.
- 원인: 기존 Multi-Pair 엔진이 모든 이미지·오디오·배지 입력을 단일 프로세스에 동시에 연결했다.
- 해결: 각 페어를 동일 규격 MP4로 순차 렌더링하고, 완료된 구간을 concat demuxer와 `-c copy`로 최종 조립하는 단계형 엔진으로 교체했다. 폴더 기반 Auto Pair도 같은 엔진을 사용한다.
- 다음에 피할 것: 입력 수에 상한이 없는 기능을 단일 대형 필터 그래프로 구성하지 않는다.
## 2026-07-26 - 정지 artwork 배지는 프레임 전에 합성

- 문제: 정지 artwork 기반 Auto Pair에서도 제목 배지를 모든 30fps 프레임에 overlay해 렌더 시간이 크게 늘었다.
- 원인: 변하지 않는 artwork와 배지를 영상 인코딩 필터 안에서 프레임마다 반복 합성했다.
- 해결: 곡마다 artwork와 배지를 1920×1080 PNG 한 장으로 먼저 합성하고, 완성 이미지를 음악 길이만큼 영상화했다. 세 곡 681.72초의 개별 렌더와 최종 concat 전체가 155.77초에 완료됐다.
- 다음에 피할 것: 시간에 따라 변하지 않는 그래픽을 영상의 모든 프레임에서 다시 계산하지 않는다.
