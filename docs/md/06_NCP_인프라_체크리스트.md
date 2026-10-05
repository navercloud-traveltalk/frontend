# 여행말 NCP 인프라 체크리스트

| 항목 | 내용 |
| --- | --- |
| 문서명 | NCP 인프라 체크리스트와 팀 노트 정리법 |
| 기준 문서 | 01 아키텍처 구상도 · 03 데이터 테이블 설계서 · 04 API 기능명세서 8장(환경 변수) |
| 백엔드 | Spring Boot 3.5 / Java 21 / JPA (저장소: `yeohaengmal-backend`) |

> **먼저 읽기.** 콘솔 메뉴 이름·화면은 NCP가 바꿀 수 있고, 이 문서는 콘솔을 직접 열어 확인하지 않고 쓴 것이다. 확신이 낮은 항목은 **▲**로 표시했다. 메뉴가 다르면 가까운 항목을 찾아 진행하고, 달라진 점을 팀 노트의 "작업 로그"에 적어 둔다. 요금은 이 문서에 쓰지 않았다(콘솔의 요금 안내로 확인).

## 0. 진행 순서 한눈에

| 단계 | 내용 | 시점 | 막히면 영향 받는 사람 |
| --- | --- | --- | --- |
| 0 | 계정·결제·팀 권한 | 지금 | 전원 |
| 1 | 개발 최소: Object Storage + API 인증키 | 지금 | A(E05), B·C·E(저장소 사용) |
| 2 | AI 키: CLOVA Studio, CSR·Voice·Maps Application | 지금(승인 대기가 있을 수 있음) | B, C, D, E |
| 3 | 배포 인프라: VPC → 서버 → DB → NAT → LB | 코드가 로컬에서 돌아간 뒤 | 전원(시연) |
| 4 | 서버 설정: Nginx, Java, ffmpeg, 환경 변수 | 3 이후 | 전원(시연) |
| 5 | 종료·비용 관리 | 상시 | 전원 |

개발 중에는 **로컬 Docker(MySQL + S3Mock)로 먼저 개발**하고(백엔드 README), 3~4단계는 시연 준비 시점에 한다. 과금 리소스를 오래 켜 두지 않는다.

---

## 1. 단계 0 — 계정·권한

- [ ] NCP 계정 상태 확인(가입 완료, 결제수단, 크레딧 여부) — 담당: **계정 주인**
- [ ] 누구 계정으로 켤지 팀에서 정한다(개인 계정이면 과금이 개인에게 나간다)
- [ ] 팀 공용 계정이면 팀원별 **서브 계정(Sub Account) 또는 권한**을 만들어 준다 ▲(메뉴: Management > Sub Account)
- [ ] 리전 선택: **한국(KR)**. 이후 모든 리소스를 같은 리전·VPC에 둔다
- [ ] 모든 리소스 이름 규칙 합의: `yhm-<환경>-<종류>` (예: `yhm-dev-vpc`, `yhm-dev-app`)

## 2. 단계 1 — 개발 최소 (A 담당 착수)

### 2.1 API 인증키 (Object Storage용)

- [ ] 우측 상단 계정 메뉴 → **마이페이지 → 인증키 관리 → 신규 API 인증키 생성** ▲
- [ ] **Access Key ID / Secret Key**를 비밀번호 관리 도구에 저장(Secret은 다시 못 볼 수 있다)
- [ ] 키는 `.env`에만 둔다. 채팅·노트·깃에 붙여 넣지 않는다

### 2.2 Object Storage 버킷

- [ ] Object Storage 이용 신청(처음이면 약관 동의) ▲ (메뉴: Services > Storage > Object Storage)
- [ ] 버킷 생성: 이름 `yeohaengmal-dev-<이니셜>` (소문자·숫자·하이픈, 전역 유일)
- [ ] 공개 설정은 **비공개**(기본값)
- [ ] 엔드포인트·리전명을 메모(기대값: `https://kr.object.ncloudstorage.com`, 리전 `kr-standard` ▲ — 콘솔 값을 따른다)
- [ ] **CORS 설정**: 허용 출처 `http://localhost:5173`(+ 배포 도메인), 메서드 `PUT, GET, HEAD`, 헤더 `*`
  - 콘솔에 CORS 메뉴가 있으면 콘솔에서. 없으면 `CORS_ORIGINS="…" ./scripts/storage-cors.sh` (백엔드 저장소) ▲ NCP에서 아직 시험 전
- [ ] **서명 URL 시험(가장 중요)**: `.env`의 `S3_*`를 NCP 값으로 바꾸고 `./scripts/storage-check.sh`
  - `[성공]` 4개 → E05는 사전 서명 URL 방식 확정
  - 실패 → 오류 문구를 팀에 공유하고 E05를 서버 경유 업로드(04 문서 E05 대안 A)로 변경

`.env` 예(NCP):

```
S3_ENDPOINT=https://kr.object.ncloudstorage.com
S3_REGION=kr-standard
S3_BUCKET=yeohaengmal-dev-<이니셜>
S3_ACCESS_KEY=<비밀>
S3_SECRET_KEY=<비밀>
S3_PATH_STYLE=true   # NCP가 가상호스트 방식만 받으면 false ▲
```

### 2.3 알려 줄 것 / 알려 주면 안 되는 것

| 노트·채팅에 적어도 되는 것 | 적으면 안 되는 것 |
| --- | --- |
| 엔드포인트 URL, 리전명, 버킷 이름 | Access/Secret Key, DB 비밀번호, 각종 API 키·Client Secret |
| 서명 URL 시험 결과(성공/실패, 오류 문구) | `.pem` 로그인 키 파일 |
| 리소스 이름·ID·IP(공인 IP 포함 시 주의) | 키가 보이는 화면 캡처(가리고 공유) |

---

## 3. 단계 2 — AI 서비스 키 (B·C·D·E 담당)

| 서비스 | 용도 | 발급 | 환경 변수 | 담당 |
| --- | --- | --- | --- | --- |
| CLOVA Studio | 질문·챕터·제목·문체 생성, 사진 설명(HCX-005) | 콘솔에서 이용 신청 후 API 키 발급 ▲ | `CLOVA_STUDIO_API_KEY` | B, C, D, E (각자 개발용 + 배포용 1개) |
| CLOVA Speech Recognition (CSR) | 답변 전사 | **Application 등록**(AI·NAVER API)에서 선택 ▲ | `NCP_APIGW_KEY_ID` / `NCP_APIGW_KEY` | C |
| CLOVA Voice (TTS Premium) | 질문 음성 | 같은 Application에서 선택 | 위와 동일 | C |
| Maps (Reverse Geocoding) | 사진 GPS → 주소 | 같은 Application에서 선택 | 위와 동일 | B |
| CLOVA OCR (General) | 간판·메뉴 읽기(선택) | 도메인 생성 → Invoke URL + Secret | `CLOVA_OCR_URL` / `CLOVA_OCR_SECRET` | B(선택) |

- [ ] **Application 하나에 CSR·Voice·Maps를 모두 체크**하면 키 한 쌍으로 쓸 수 있다(B와 C가 공유)
- [ ] CLOVA Studio는 **HCX-005가 실제로 호출되는지(이미지 입력)** 먼저 시험 — B
- [ ] 승인·신청이 필요한 서비스는 **오늘 신청**한다(대기 시간이 일정을 잡아먹는다)
- [ ] 호출 한도·무료 사용량 확인 후 팀에 공유 ▲
- [ ] 개발용 키는 각자, **배포용 키는 대표 계정 1세트**로 통일 ▲(한도가 계정 단위인지 확인)

---

## 4. 단계 3 — 배포 인프라 (구상도 기준)

### 4.1 담당 제안

| 담당 | 맡을 것 |
| --- | --- |
| A | VPC·서브넷, Cloud DB for MySQL, Object Storage |
| E | Server(Web·App), ACG, NAT Gateway, Load Balancer, 인증서·도메인, Nginx 설정 |

(팀 사정에 맞게 바꿔도 된다. 한 명이 전부 하지 않는 편이 낫고, 만든 사람이 4.8 "리소스 대장"(팀 노트에도 동일하게)에 기록한다.)

### 4.2 VPC · 서브넷

- [ ] VPC 생성: 이름 `yhm-dev-vpc`, IP 대역 예) `10.0.0.0/16`
- [ ] 서브넷 생성(같은 Zone 하나로 시작해도 된다):

| 서브넷 | 예시 CIDR | 종류 | 쓰임 |
| --- | --- | --- | --- |
| yhm-sub-lb | 10.0.0.0/24 | Public, 용도 Load Balancer ▲ | Public Load Balancer |
| yhm-sub-nat | 10.0.1.0/24 | Public, 용도 NAT Gateway ▲ | NAT Gateway |
| yhm-sub-web | 10.0.10.0/24 | Private | Nginx 서버 |
| yhm-sub-app | 10.0.20.0/24 | Private | WAS 서버 |
| yhm-sub-db | 10.0.30.0/24 | Private | Cloud DB for MySQL |

- [ ] 서브넷 종류·용도 요건(LB 전용·NAT 전용 서브넷 필요 여부)은 공식 문서로 확인 ▲
- [ ] Route Table: Private 서브넷의 `0.0.0.0/0` → NAT Gateway
- [ ] Network ACL은 기본값으로 시작

### 4.3 ACG(방화벽) 규칙

| ACG | 인바운드 | 비고 |
| --- | --- | --- |
| yhm-acg-lb | 443(HTTPS), 80(리다이렉트용) ← 0.0.0.0/0 | 로드밸런서 |
| yhm-acg-web | 80 ← LB 서브넷, 22 ← 내 IP | Nginx |
| yhm-acg-app | 8080 ← web ACG, 22 ← 내 IP | WAS |
| yhm-acg-db | 3306 ← app ACG | Cloud DB |

- [ ] 아웃바운드는 기본(전체 허용)
- [ ] SSH(22)는 **내 IP로 한정**(0.0.0.0/0 금지)

### 4.4 서버(Web · App)

- [ ] 서버 2대 생성: 이미지 Ubuntu 22.04 ▲, 처음엔 작은 사양, Private Subnet, 해당 ACG
- [ ] **로그인 키(.pem)**: 별도 메뉴가 없고 **서버 생성 마법사의 "인증키 설정" 단계에서 "신규 인증키 생성"**(이름 `yhm-dev-key`)으로 만든다. `.pem`은 **한 번만 내려받아지므로** 바로 `~/.ssh/`로 옮기고 `chmod 400` 한 뒤 비밀번호 관리 도구에도 보관(깃·노트 금지). 서버 접속 비밀번호는 서버 생성 후 콘솔의 "관리자 비밀번호 확인"에 `.pem`을 올려 조회한다 ▲ 화면 확인 필요
- [ ] 서버 사양은 **메모리(GB)를 확인**하고 정한다. Micro(g3)는 "결제 정보 등록 시 1년 무료"로 표시되지만 Java 21 + Nginx에는 메모리가 빠듯할 수 있다 ▲
- [ ] 접속 경로: Private 서버는 외부에서 직접 못 들어간다. (a) 임시로 공인 IP를 붙이거나 (b) 점프 서버(bastion) 하나를 둔다 ▲ — 시연 후 공인 IP 반납
- [ ] 시간대 확인(서버는 UTC, 앱은 `Asia/Seoul` 기준으로 오늘 일차를 계산하므로 별도 설정 불필요)

### 4.5 Cloud DB for MySQL

- [ ] Cloud DB for MySQL 생성: 버전 **8.0**, Private Subnet(`yhm-sub-db`), 문자셋 `utf8mb4`
- [ ] DB 이름 `yeohaengmal`, 사용자 `yhm`, **비밀번호는 비밀 관리**
- [ ] DB ACG에서 3306을 WAS(app ACG)에서만 허용
- [ ] 접속해서 `db/01_schema.sql` → `db/02_common_code.sql` 순서로 실행(백엔드 저장소 `db/`)
- [ ] 확인: `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='yeohaengmal'` → **14**, `tb_common_code` → **79**
- [ ] 고가용성(HA) 옵션은 시연 단계에선 끈다(과금) ▲

### 4.6 NAT Gateway

- [ ] NAT Gateway 생성(NAT 서브넷에), 공인 IP 연결 ▲
- [ ] Private 라우트 테이블에 `0.0.0.0/0 → NAT` 추가
- [ ] 확인: WAS 서버에서 `curl https://kr.object.ncloudstorage.com` 가 응답한다

### 4.7 Load Balancer · HTTPS · 도메인

- [ ] 로드밸런서 생성: **Application Load Balancer, Public** ▲(구상도의 "Public Load Balancer")
- [ ] 리스너 443(HTTPS) → 대상 그룹(Nginx 서버 80), 상태 확인 경로 `/` ▲
- [ ] **인증서**: Certificate Manager에 등록 ▲ — 도메인이 필요하다
- [ ] **도메인**: 보유 도메인의 CNAME을 로드밸런서 도메인으로 연결(또는 NCP DNS) ▲
- [ ] 마이크는 HTTPS에서만 동작하므로 폰 시연 전에 반드시 완료
- [ ] HTTPS 종료 후 내부는 HTTP이므로 WAS가 `X-Forwarded-Proto`를 신뢰한다(백엔드에 이미 설정: `forward-headers-strategy: framework`), 배포 시 `COOKIE_SECURE=true`

### 4.8 리소스 대장 (만든 것은 여기에 기록 — 팀 노트의 리소스 대장과 같은 형식)

| 리소스 | 이름 | 종류·사양 | Zone/서브넷 | 담당 | 생성일 | 상태 | 비고(비밀 제외) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| VPC | yhm-dev-vpc | 10.0.0.0/16 | - | | | | |
| Object Storage 버킷 | | | | A | | | 엔드포인트·리전은 비고에 |
| Cloud DB for MySQL | | 8.0 | yhm-sub-db | A | | | |
| Server(Web) | | | yhm-sub-web | E | | | |
| Server(App) | | | yhm-sub-app | E | | | |
| NAT Gateway | | | yhm-sub-nat | E | | | |
| Load Balancer | | | yhm-sub-lb | E | | | |
| 인증서/도메인 | | | - | E | | | |

---

## 5. 단계 4 — 서버 설정

### 5.1 App 서버(WAS)

- [ ] Java 21 설치(예: `sudo apt install openjdk-21-jre-headless`) ▲ 패키지명 확인
- [ ] **ffmpeg 설치**(C 담당 기능에 필요): `sudo apt install ffmpeg`
- [ ] 빌드된 JAR 배치(`./mvnw package` → `target/yeohaengmal-backend-0.1.0.jar`)
- [ ] 환경 변수 파일(예: `/etc/yeohaengmal.env`, 권한 600) — **이름만** 아래 표, 값은 비밀
- [ ] systemd 서비스로 실행(재부팅 자동 시작)
- [ ] 확인: 서버 안에서 `curl localhost:8080/health` → `{"status":"ok"}`

| 환경 변수 | 설명 |
| --- | --- |
| `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD` | Cloud DB 접속 정보 |
| `COOKIE_NAME` `COOKIE_MAX_AGE_DAYS` `COOKIE_SECURE` | 쿠키(`yeohaengmal_token`, 180, **true**) |
| `S3_ENDPOINT` `S3_REGION` `S3_BUCKET` `S3_ACCESS_KEY` `S3_SECRET_KEY` `S3_PATH_STYLE` | Object Storage |
| `NCP_APIGW_KEY_ID` `NCP_APIGW_KEY` | Maps·CSR·Voice (C·B 구현 시 사용) |
| `CLOVA_STUDIO_API_KEY` | HyperCLOVA X |
| `CLOVA_OCR_URL` `CLOVA_OCR_SECRET` | (선택) OCR |

### 5.2 Web 서버(Nginx)

- [ ] Nginx 설치, 프론트 빌드(`npm run build`의 `dist/`) 배치
- [ ] 설정(핵심만):

```nginx
server {
  listen 80;
  client_max_body_size 20m;              # 답변 녹음(수 MB) 업로드, 기본 1MB 면 실패

  root /var/www/yeohaengmal;             # 프론트 dist
  location / { try_files $uri /index.html; }   # React Router 새로고침 대응

  location /api/ {
    proxy_pass http://<WAS 사설 IP>:8080/;     # 끝의 / 가 /api 접두를 제거한다
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;  # LB 가 넣어 준 값을 그대로 전달
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 90s;              # 답변 처리가 최대 ~20초 + 여유
    proxy_send_timeout 90s;
  }
}
```

- [ ] 로드밸런서·Nginx·WAS 타임아웃이 모두 **60초 이상**인지 확인
- [ ] 확인: 브라우저에서 `https://도메인/` 화면, `https://도메인/api/health` → ok

### 5.3 배포 후 통합 확인

- [ ] `https://도메인/` 접속 → /start → 닉네임 생성 → 책장(쿠키가 Secure로 저장되는지)
- [ ] 새 여행 → 사진 올리기 화면 → 사진 선택·업로드(버킷 CORS 확인)
- [ ] 프론트 `VITE_USE_MOCK=false`, `VITE_API_BASE_URL=/api`로 빌드했는지

---

## 6. 단계 5 — 비용·종료·보안

- [ ] 시연이 없는 시간에는 **서버 정지**(정지해도 과금되는 항목이 있는지 확인 ▲), NAT Gateway·Load Balancer·Cloud DB는 **켜 둔 동안 과금**되므로 시연 전에만 켠다
- [ ] 개발 단계에서는 로컬 Docker를 쓰고 NCP는 Object Storage·API 키만 쓴다
- [ ] 프로젝트 종료 후 리소스 **전부 삭제**(버킷 안 파일 포함). 대장의 "상태" 열로 확인
- [ ] 키 유출 시: 해당 인증키를 즉시 삭제·재발급하고 팀에 알린다
- [ ] `.env`, `.pem`, 비밀번호는 깃에 올리지 않는다(백엔드 `.gitignore`에 `.env`·`*.pem` 포함)

---

## 7. 구축 현황 (2026-10-06 기준, 계속 갱신)

> 이어받는 사람은 이 표를 기준으로 진행한다. **SSH(22) 규칙은 설정자 본인(서준호) PC의 공인 IP 한 개(`/32`)만 허용**하도록 만들었다. 다른 팀원이 서버에 접속하려면 **본인 IP를 규칙에 추가**해야 한다(4.3 참고). IP 숫자 자체는 이 문서에 적지 않는다.

### 7.1 만든 것

| 리소스 | 이름 | ID | 설정 | 만든 사람 | 상태 |
| --- | --- | --- | --- | --- | --- |
| VPC | yhm-dev-vpc | - | 10.0.0.0/16 | 서준호 | 운영중 |
| Subnet | yhm-sub-lb | 328400 | 10.0.0.0/24, KR-1, Public, 용도 LoadBalancer | 서준호 | 운영중 |
| Subnet | yhm-sub-nat | 328401 | 10.0.1.0/24, KR-1, Public, 용도 NatGateway | 서준호 | 운영중 |
| Subnet | yhm-sub-web | 328402 | 10.0.10.0/24, KR-1, Private, 일반 | 서준호 | 운영중 |
| Subnet | yhm-sub-app | 328403 | 10.0.20.0/24, KR-1, Private, 일반 | 서준호 | 운영중 |
| Subnet | yhm-sub-db | 328404 | 10.0.30.0/24, KR-1, Private, 일반 | 서준호 | 운영중 |
| ACG(기본) | yhm-dev-vpc-default-acg | 403687 | VPC 생성 때 자동 생성. 서버에 붙이지 않는다 | 자동 | 유지 |
| ACG | yhm-acg-lb | 403689 | 아래 7.2 | 서준호 | 생성됨 |
| ACG | yhm-acg-web | 403690 | 아래 7.2 | 서준호 | 생성됨 |
| ACG | yhm-acg-app | 403691 | 아래 7.2 | 서준호 | 생성됨 |
| ACG | yhm-acg-db | 403692 | 아래 7.2 | 서준호 | 생성됨 |
| Object Storage 버킷 | traveltalk-photos-dev | - | 비공개, 잠금·암호화 끔, CORS `http://localhost:5173`(PUT/GET/HEAD) | 서준호 | 서명 URL 시험 통과 |

아직 만들지 않은 것(과금 리소스): Server, Cloud DB for MySQL, NAT Gateway, Load Balancer, 인증서·도메인. 로그인 키(.pem)는 서버 생성 단계에서 같이 만든다.

서버 생성은 B~E 기능이 어느 정도 합쳐지는 시점(시험 배포, 10/9~10/10쯤 제안)에 한다.

### 7.2 ACG 규칙 (인바운드만 설정, 아웃바운드는 기본값 유지)

| ACG | 프로토콜 | 접근 소스 | 포트 | 메모 | 확인 |
| --- | --- | --- | --- | --- | --- |
| yhm-acg-lb | TCP | 0.0.0.0/0 | 80 | HTTP | 화면 확인 |
| yhm-acg-lb | TCP | 0.0.0.0/0 | 443 | HTTPS | 화면 확인 |
| yhm-acg-web | TCP | 10.0.0.0/24 (LB 서브넷) | 80 | LB 서브넷 | 화면 확인 |
| yhm-acg-web | TCP | **설정자 본인 공인 IP/32** | 22 | SSH | 화면 확인 |
| yhm-acg-app | TCP | yhm-acg-web (또는 10.0.10.0/24) | 8080 | Nginx | 적용 여부 재확인 |
| yhm-acg-app | TCP | **설정자 본인 공인 IP/32** | 22 | SSH | 적용 여부 재확인 |
| yhm-acg-db | TCP | yhm-acg-app (또는 10.0.20.0/24) | 3306 | WAS | 적용 여부 재확인 |

- **SSH(22) 규칙은 팀 공용이 아니다.** 설정자 PC의 IP에서만 접속된다. 접속해야 하는 팀원은 `myIp` 버튼으로 본인 IP를 확인해 **해당 ACG(web, app)의 Inbound에 22번 규칙을 한 줄 추가**하고 메모에 이름을 적는다. 배포가 끝나면 쓰지 않는 규칙은 삭제한다.
- **서버에 공인 IP를 붙이기 전에** 22번 규칙이 `0.0.0.0/0`이 아닌지 확인한다(현재는 `0.0.0.0/0`이 아니다).
- 3306(DB), 8080(WAS), 80(Nginx)은 어떤 경우에도 `0.0.0.0/0`으로 열지 않는다.
- "적용 여부 재확인"은 ACG 목록 화면만으로는 규칙 내용을 볼 수 없어서 붙인 표시다. 만든 사람이 각 ACG 설정 창을 열어 규칙이 저장돼 있는지 확인하고 이 칸을 "화면 확인"으로 바꾼다.

### 7.3 다음 순서

1. (배포 직전) Server 생성 시 위 ACG와 서브넷을 선택하고, 같은 마법사에서 로그인 키(.pem) 신규 생성·보관 → 3. Cloud DB → 4. NAT Gateway(Private 라우트 연결) → 5. Load Balancer·인증서·도메인.

---

# 팀 노트(Notion) 정리법

## 1. 페이지 구조

```
여행말 NCP 인프라 (부모 페이지)
├─ 0. 개요: 이 문서 링크(01 아키텍처·03 설계서·04 API), 담당표, 진행 현황 한 줄
├─ 1. 체크리스트 (데이터베이스 · 보드/표 보기)
├─ 2. 리소스 대장 (데이터베이스 · 표)
├─ 3. 환경 변수 목록 (표 — 이름·설명·담당만, 값은 쓰지 않음)
├─ 4. 접속·운영 가이드 (서버 접속 방법, 배포 절차, 로그 보는 법)
├─ 5. 작업 로그 (날짜순 — 누가 무엇을 했고 어떤 문제가 있었는지)
└─ 6. 트러블슈팅 (증상 → 원인 → 해결, 검색하기 좋게 오류 문구 포함)
```

## 2. 체크리스트 DB 속성

| 속성 | 유형 | 예 |
| --- | --- | --- |
| 작업 | 제목 | Object Storage 버킷 생성 |
| 단계 | 선택 | 0 계정 / 1 개발 최소 / 2 AI 키 / 3 인프라 / 4 서버 설정 |
| 담당 | 사람 | A~E |
| 상태 | 상태 | 대기 / 진행 중 / 막힘 / 완료 |
| 선행 작업 | 관계 | 버킷 생성 → CORS → 서명 URL 시험 |
| 막는 사람 | 사람(복수) | 이 작업이 끝나야 하는 팀원 |
| 완료일 | 날짜 | |
| 결과·메모 | 텍스트 | 엔드포인트, 시험 결과(비밀 제외) |

보기: ① 단계별 그룹 표 ② 담당자별 보드 ③ "막힘" 필터(매일 아침 확인).

## 3. 리소스 대장 DB 속성

리소스, 이름, 종류·사양, Zone/서브넷, 담당, 생성일, 상태(켜짐/정지/삭제), 비밀 위치("팀 비밀번호 관리 도구 항목명"), 비고. **값 자체(키·비밀번호)는 쓰지 않고 "어디에 보관했는지"만 쓴다.**

## 4. 비밀 정보 규칙 (노트 맨 위에 고정)

- 키·비밀번호는 노트·채팅·깃·스크린샷에 평문으로 올리지 않는다.
- 팀 비밀번호 관리 도구(또는 합의한 비공개 저장소)에 항목으로 보관하고, 노트에는 항목 이름만 적는다.
- 각자 `.env`(깃 제외)에 두고, 환경 변수 **이름**은 04 문서 8장·백엔드 `.env.example`과 똑같이 쓴다.
- 키가 노출되면 즉시 재발급 → 팀 공지.

## 5. 작업 로그·트러블슈팅 작성 틀

작업 로그 한 줄: `날짜 · 담당 · 한 일 · 결과(성공/막힘) · 다음 할 일`

트러블슈팅 한 건:

```
증상:    (화면/오류 문구 그대로)
원인:    
해결:    (실행한 명령·설정 값, 비밀 제외)
확인법:  
작성자/날짜:
```

## 6. 운영 규칙

- 인프라를 **새로 만들거나 바꾸면 그 자리에서** 리소스 대장에 적는다(만든 사람이).
- 과금 리소스(서버·DB·NAT·LB)는 켠 사람이 끄는 것까지 책임진다. 대장의 "상태"가 켜짐인 항목은 매일 저녁 점검.
- 다른 팀원 작업이 나에게 의존하면 체크리스트 "막는 사람"에 그 이름을 적어 공지한다.
