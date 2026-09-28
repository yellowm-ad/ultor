# 울토르 데스크톱 실행기 (테스트)

- 온라인 주소 방식: exe 는 https://ultor-web.vercel.app 을 띄운다. 웹을 Vercel 에 배포하면 exe 는 재실행 시 최신.
- 세이브: `%APPDATA%\Ultor` (크롬 세이브와 별개). 인터넷 없으면 연결 안내 화면.
- 단축키: F11 전체화면, F5 새로고침.

```
npm install
npm start        # 개발 실행
npm run dist     # dist/Ultor-<버전>-portable.exe 생성
```

철회: 이 폴더를 지우면 끝(웹 버전과 무관). 정식 배포 때는 내장 파일 방식 + 자동 업데이트 + 파일 세이브로 전환 예정.
