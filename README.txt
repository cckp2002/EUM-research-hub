이음(E:UM) 학생평가 연구학교 성과 공유 대시보드
==========================================

1. 무엇이 들어 있나요?
- index.html: 자료 모음 첫 화면
- style.css, app.js: 디자인과 전자책 페이지 넘김 기능
- docs/: 원본 PDF 3종
- pages/: PDF를 전자책처럼 읽기 위한 페이지 이미지
- assets/: 표지 이미지와 아이콘

2. 어떻게 실행하나요?
- index.html 파일을 Chrome 또는 Edge로 열면 됩니다.
- 문서의 '전자책 읽기'를 누르면 페이지를 한 장씩 넘길 수 있습니다.
- 'PDF로 보기'를 누르면 원본 PDF가 새 탭에서 열립니다.
- 전자책 페이지에서는 왼쪽/오른쪽 화살표 키, 목차 이동, 페이지 번호 입력을 사용할 수 있습니다.
- 외부 프로그램, 회원가입, 유료 전자책 서비스, API 키가 필요하지 않습니다.
- AI 평가도구와 프롬프트로 연결되는 외부 사이트는 인터넷 연결이 필요합니다.

3. 여러 교사와 공유하려면? (무료 GitHub Pages 예시)
- 별도의 공개 저장소(예: eum-research-hub)를 만듭니다.
- 이 폴더 안의 파일과 폴더를 저장소 최상위 경로에 올립니다.
- Settings > Pages > Build and deployment > Deploy from a branch > main, /(root) 로 설정합니다.
- 배포가 끝나면 https://<사용자명>.github.io/<저장소명>/ 으로 접속할 수 있습니다.
- 기존 EUM-AI-Assessment 또는 eum-prompt-guide 저장소를 수정하지 마세요.
- PDF 원본이 공개용 문서인지 확인한 후 저장소를 공개하세요.

4. 업데이트
- 원본 PDF를 교체할 때에는 docs/의 PDF와 pages/의 페이지 이미지도 함께 갱신해야 합니다.
- 문서 제목, 장별 목차, 페이지 수가 바뀌면 index.html 및 app.js의 설정을 수정해야 합니다.
- 구현은 HTML/CSS/JS만 사용하며 비용이 드는 전자책 서비스는 사용하지 않습니다.

5. 공개 연결 주소
- 이음 평가도구 설계 프로그램: https://cckp2002.github.io/EUM-AI-Assessment/
- 이음 평가 프롬프트: https://cckp2002.github.io/eum-prompt-guide/

웅촌중학교 2026학년도 학생평가 연구학교 성과 공유용
