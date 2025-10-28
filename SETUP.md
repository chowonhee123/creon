# Contents Builder - 설정 가이드

## 요구사항
- Node.js (v18 이상)
- npm 또는 yarn

## 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
`.env` 파일이 이미 생성되어 있습니다. API 키가 설정되어 있는지 확인하세요:
```bash
cat .env
```

### 3. 개발 서버 실행
```bash
npm run dev
```

서버가 시작되면 http://localhost:3000 에서 접근 가능합니다.

## 로컬 도메인 설정 (선택사항)

개발 환경에서 더 편한 도메인을 사용하고 싶다면 `/etc/hosts` 파일을 수정하세요:

```bash
sudo bash -c 'echo "127.0.0.1 local.contents-builder" >> /etc/hosts'
```

그 후 http://local.contents-builder:3000 으로 접근할 수 있습니다.

## 접근 주소

- 기본: http://localhost:3000
- 로컬 도메인 (설정 시): http://local.contents-builder:3000

## 환경 변수

프로젝트는 다음 환경 변수를 사용합니다:
- `GEMINI_API_KEY`: Gemini API 키

`.env` 파일에서 관리되며, Git에 커밋되지 않습니다 (`.gitignore`에 포함됨)



