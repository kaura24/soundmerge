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
