# HUFS Reading Marathon

한국외국어대학교 글로벌캠퍼스 도서관의 독서마라톤 운영을 위한 웹서비스입니다.

Google Forms, e-Class, Excel, 도서관 홈페이지로 분산되어 있던 참가 신청, 독서 기록, 집계, 대회 현황 공개 과정을 하나의 서비스에서 관리할 수 있도록 개발하고 있습니다.

현재 사용자 및 관리자 화면 구현을 완료했으며, 백엔드 API 연동을 진행하고 있습니다.

## 주요 기능

### 사용자

- 독서마라톤 참가 신청 및 로그인
- 독서일지 작성
- 읽은 페이지 수에 따른 거리 자동 계산
- 누적 독서량과 코스 달성률 확인
- 날짜별 독서 기록 조회
- 코스별 대회 현황 확인

### 관리자

- 관리자 대시보드
- 행사 및 코스 설정
- 참가 신청자 관리
- 독서일지 검토 및 승인·반려
- 코스별 참가자 및 완주자 현황 확인
- 누적 페이지와 거리 집계

## 거리 환산 기준

독서한 책의 **1쪽을 5m**로 환산합니다.

| 코스 | 목표 거리 | 목표 페이지 |
| --- | ---: | ---: |
| 단축코스 | 10,000m | 2,000쪽 |
| 하프코스 | 21,100m | 4,220쪽 |
| 풀코스 | 42,195m | 8,439쪽 |

## 기술 스택

### Frontend

- React
- TypeScript
- Vite
- React Router
- CSS

### Deployment

- Docker
- AWS

### Collaboration

- Git
- GitHub
- Swagger

## 실행 방법

```bash
git clone https://github.com/HUFS-Reading-Marathon/pagepace-fe.git
cd pagepace-fe

npm install
npm run dev
````

## 개발 상태

* 사용자 화면 구현
* 관리자 화면 구현
* 반응형 UI 구현
* 백엔드 API 연동 진행 중
* 배포 환경 구성 진행 중

## 팀 구성

| 역할       | 인원 |
| -------- | -: |
| Frontend | 1명 |
| Backend  | 1명 |
