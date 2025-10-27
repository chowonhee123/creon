# Home Tab Images Guide

Home 탭에 표시될 이미지와 비디오를 관리하는 방법입니다.

## 폴더 구조

```
public/images/home/  ← 이 폴더에 이미지/비디오를 추가하세요
```

## 이미지 추가 방법

### 1. 이미지/비디오 파일을 폴더에 추가

`public/images/home/` 폴더에 이미지 또는 비디오 파일을 넣습니다.

예시:
- `public/images/home/showcase-1.png`
- `public/images/home/demo-video.mp4`

### 2. JSON 파일 재생성

터미널에서 다음 명령어를 실행하세요:

```bash
node generate_home_images.cjs
```

이 명령어가 `public/images/home/` 폴더의 모든 이미지/비디오를 스캔하여 `public/home_images.json` 파일을 생성합니다.

### 3. 브라우저 새로고침

브라우저를 새로고침하면 추가한 이미지가 Home 탭에 자동으로 표시됩니다.

## 지원하는 파일 형식

- **이미지**: `.png`, `.jpg`, `.jpeg`, `.webp`
- **비디오**: `.mp4`, `.webm`

## 참고사항

- Home 탭은 `public/home_images.json` 파일을 읽어서 이미지를 표시합니다.
- 파일을 추가하거나 삭제한 후에는 반드시 `node generate_home_images.cjs` 명령어를 실행해야 합니다.
- 현재 **82개의 이미지/비디오**가 설정되어 있습니다.

## 자동 생성된 JSON 구조

```json
[
  {
    "id": "home_1",
    "name": "filename.png",
    "type": "image/png",
    "dataUrl": "/images/home/filename.png",
    "timestamp": 1761529684080
  }
]
```

- `id`: 고유 식별자
- `name`: 파일 이름
- `type`: MIME 타입
- `dataUrl`: 파일 경로
- `timestamp`: 생성 시간 (밀리초)

