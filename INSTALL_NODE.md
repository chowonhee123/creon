# Node.js 설치 가이드

## 방법 1: Homebrew 사용 (권장)

### 1단계: Homebrew 설치
터미널에서 다음 명령어를 실행하세요:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Homebrew 설치 중 비밀번호 입력이 요구됩니다.

### 2단계: Node.js 설치
```bash
brew install node
```

### 3단계: 설치 확인
```bash
node --version
npm --version
```

---

## 방법 2: 공식 웹사이트에서 직접 설치

1. https://nodejs.org 접속
2. "LTS (Long Term Support)" 버전 다운로드
3. `.pkg` 파일을 실행하여 설치
4. 설치 완료 후 터미널에서 확인:
```bash
node --version
npm --version
```

---

## 방법 3: NVM (Node Version Manager) 사용

### 1단계: Xcode Command Line Tools 설치
터미널에서 실행:
```bash
xcode-select --install
```

설치 중 팝업이 뜨면 "설치" 버튼 클릭

### 2단계: NVM 설치
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
```

### 3단계: 터미널 재시작 또는 설정 적용
```bash
source ~/.zshrc
```

### 4단계: Node.js 설치
```bash
nvm install --lts
nvm use --lts
```

### 5단계: 설치 확인
```bash
node --version
npm --version
```

---

## 설치 완료 후

Node.js 설치가 완료되면, 프로젝트를 실행하세요:

```bash
# 프로젝트 디렉토리로 이동
cd "/Users/wonhee.cho/Documents/contents-builder---1023(final)"

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

그 후 http://localhost:3000 에서 접속하세요!

