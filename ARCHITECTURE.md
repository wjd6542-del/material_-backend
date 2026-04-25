# 품목관리 서버 (material-server) 아키텍처 & 모델 설계 분석

> 작성일: 2026-04-18 (최종 갱신: 2026-04-24)
> 대상 커밋: `main` @ f766372 기준
> 추가 반영:
> - Business · PurchaseOrder · Chat(Socket.IO) · Supplier 주소 확장 · 메시지 soft delete
> - **Material 가격 6종 + 요율 5종** 필드 + `MaterialPriceHistory` (스냅샷)
> - **MaterialRate** 싱글톤 + `MaterialRateHistory` (FK 연결)
> - **Supplier 확장**: `type`(INBOUND/OUTBOUND)·`receivable`/`payable`·`registration_no`/`mobile`/`fax`/`account_no`
> - **SupplierHistory** (거래처 type·금액 변경 스냅샷)
> - **Inbound 확장**: `supplier_id`·`purchase_date`·`vat_applied`·`is_unpaid`
> - **InboundItem**: `unit_price→price`, `amount→supply_amount` 리네임 + `vat` 추가
> - **재고 로직 보강**: 이동평균 단가 계산, `stock_value` 자동 동기, shelf_id 포함 4컬럼 unique
> - **거래처 미지급금 자동 반영**: 입고 저장/삭제 시 `supplier.payable` delta + `SupplierHistory` 기록
> - **권한 전면 매핑**: 프론트 권한 트리 기반 모든 라우트에 `permission()` preHandler 적용
>
> 범위: `/server` 전체 + `/prisma/schema.prisma`

---

## 1. 시스템 개요

Fastify + Prisma(MySQL) 기반 품목·창고·재고·입출고·반품·통계·감사 로그·권한을 제공하는 백엔드 서버.
단일 프로세스 / 단일 DB 구조로 중소 규모 품목창고 운영을 위한 관리 시스템이다.

| 항목 | 값 |
| --- | --- |
| 런타임 | Node.js (ESM, `"type": "module"`) |
| 웹 프레임워크 | Fastify 4.x |
| 실시간 통신 | **Socket.IO 4.x** (채팅 전용) |
| ORM / DB | Prisma 5.x / MySQL |
| 인증 | JWT (3h 만료) + bcrypt + Resend(이메일 인증) |
| 검증 | Zod 4.x |
| 스케줄러 | node-cron (매일 00:10 Asia/Seoul 일별 통계) |
| 파일 업로드 | @fastify/multipart (최대 20MB × 10개) |
| 기타 | qrcode, nodemailer/resend, dayjs |
| 포트 | 3001 (HTTP + Socket.IO 공용) |

---

## 2. 디렉토리 구조

```
server/
├── index.js                # 엔트리: CORS, multipart, JWT/IP 훅, 라우트 자동 로드
├── cron/cron.js            # 일별 통계 배치 (현재 import 주석 상태)
├── db/prisma.js            # 레거시 Prisma 클라이언트 (미사용)
├── errors/
│   ├── AppError.js         # 운영(예상) 에러 클래스
│   └── errorHandler.js     # Fastify 전역 에러 핸들러
├── lib/
│   ├── prisma.js           # 감사 미들웨어 적용 Prisma 싱글톤
│   ├── prismaAuditMiddleware.js  # 모든 write 작업 AuditLog 자동 기록
│   ├── auditContext.js     # AsyncLocalStorage 기반 요청 컨텍스트
│   └── mail.js             # Resend 이메일 발송
├── plugins/
│   ├── errorHandler.plugin.js    # errorHandler 등록
│   ├── auditHook.js              # 요청별 감사 컨텍스트 바인딩
│   ├── validator.plugin.js       # Zod safeParse + AppError 변환
│   └── parseMultipart.plugin.js  # multipart → {fields, files}
├── middleware/
│   ├── permission.js       # 권한 코드 preHandler (is_super 우회)
│   └── auditRequest.js     # (레거시) Express 스타일 미들웨어
├── routes/                 # 도메인 라우트 (파일명이 곧 /api/<name> prefix)
├── services/               # 도메인별 비즈니스 로직
├── socket/                 # Socket.IO 이벤트 핸들러 (chat.socket.js)
├── validators/             # Zod 스키마
├── utils/qrcode.js
└── uploads/                # 업로드된 품목 이미지 실제 저장 경로
```

**자동 라우트 로드**: `index.js` 가 `routes/` 디렉토리를 읽어 모든 `*.js` 를 `/api/<파일명>` prefix 로 자동 등록한다. 라우트를 추가하려면 파일만 떨어뜨리면 된다 (예: `business.js` 추가 → `/api/business/*` 즉시 활성).

---

## 3. 요청 처리 파이프라인

```
Client ──▶ Fastify
         │
         ├─ CORS (origin: true, credentials: true)
         │
         ├─ onRequest (전역)
         │   ├─ 1. /api/* 경로에서 x-api-key 검증 (API_KEY env)
         │   ├─ 2. Authorization: Bearer <JWT> 있으면 jwt.verify
         │   │    → request.user = { id, username, is_super, ip_restrict }
         │   └─ 3. ip_restrict=true && !is_super 이면 UserIpWhitelist 조회
         │
         ├─ auditHook (AsyncLocalStorage)
         │   └─ { user_id, ip, user_agent, page, method } 바인딩
         │
         ├─ (라우트별) permission("xxx.view") preHandler
         │   └─ JWT 페이로드의 permissions 배열로 권한 코드 검사
         │
         ├─ 핸들러
         │   ├─ validate(zodSchema, req.body) → AppError 400
         │   ├─ parseMultipart(req) (필요 시)
         │   └─ xxxService.method(...) 호출
         │
         ├─ Prisma auditMiddleware (서비스 내부 CRUD 시)
         │   └─ create/update/delete/upsert → AuditLog 자동 생성
         │
         └─ errorHandler (전역)
             ├─ AppError(isOperational) → statusCode/code/message 그대로
             └─ 그 외 → 500 INTERNAL_SERVER_ERROR (로그에 상세)
```

### 3.1 보안 계층 (3중)
1. **API Key**: 모든 `/api/*` 요청에 `x-api-key` 필수
2. **JWT 검증**: 로그인 외 대부분 엔드포인트는 Bearer 토큰 필요
3. **IP 화이트리스트**: `User.ip_restrict=true` 사용자에게만 적용, super 는 우회
4. **권한 코드(RBAC)**: `permission("inbound.view")` 등 preHandler 로 적용

### 3.2 실시간 파이프라인 (Socket.IO)

HTTP 라우트와는 별개 경로로, 동일 HTTP 서버의 `upgrade` 이벤트에 부착된다.

```
Client(socket.io-client) ──▶ ws://host:3001/socket.io
         │
         ├─ io.use(authMw)      ← JWT 검증 (handshake.auth.token 또는 Authorization 헤더)
         │   └─ socket.user = { id, username, is_super }
         │
         ├─ connection
         │   └─ socket.join(`user:${userId}`)  ← 개인 룸 자동 참여
         │
         └─ 이벤트 핸들러 (server/socket/chat.socket.js)
             ├─ room:join / room:leave
             ├─ message:send   → chatService.sendMessage → 방 멤버 user:{id} 에 message:new
             ├─ message:read   → chatService.markRead    → chat:{roomId} 에 message:read
             └─ message:delete → chatService.deleteMessage → 방 멤버 user:{id} 에 message:deleted
```

- **인증**: Fastify 의 onRequest 훅은 `/api/*` 만 검사하므로 소켓은 `io.use(...)` 에서 직접 JWT 검증
- **룸 2종**: `user:{id}` (개인 배지용, 연결 시 자동 참여) / `chat:{roomId}` (현재 관람 중 방)
- **브로드캐스트 전략**: 새 메시지는 방 멤버 전원의 `user:{id}` 룸으로 emit → 관람 여부와 무관하게 배지·리스트 갱신 가능

---

## 4. 계층 아키텍처

전형적인 **Routes → Services → Prisma** 3계층.

- **Routes** (`server/routes/*.js`)
  - 얇은 라우트. Zod 검증 → 서비스 호출 → 결과 반환만 수행
  - HTTP 메서드는 거의 POST 통일 (GET 은 id 파라미터 엔드포인트 일부)
- **Services** (`server/services/*.js`)
  - 비즈니스 로직 전부 집중 (트랜잭션, 재고 이력 기록, 알림 생성 등)
  - 대부분 `export default { methods }` 객체 패턴
  - 예외: `stat.service.js` 만 `class StatService` + `new StatService()` export
- **Prisma** (`server/lib/prisma.js`)
  - 싱글톤 인스턴스에 감사 미들웨어 적용
  - 트랜잭션은 `prisma.$transaction(async tx => ...)` 콜백 스타일 사용

### 공통 CRUD 패턴
대부분의 마스터 데이터(Warehouse, Location, Shelf, Supplier, Tag, Permission, Settings, Role 등)는 아래 6개 메서드 + 파라미터 시그니처를 공유한다:

```js
getAllList(), getList(filter), getById(id),
deleteById(id), batchDelete(rows), batchSave(rows), save(row, tx?)
```

이 덕분에 프론트 클라이언트도 공통 템플릿(리스트/모달/배치 저장)으로 재사용이 용이하다.

---

## 5. 도메인 모델 설계 분석

품목관리 도메인은 크게 **재고(Stock)** 를 중심으로 **입고 → 출고 → 반품** 3가지 거래 흐름이 돌아가며, 이를 **창고·위치·선반** 계층이 물리적으로 받치고, **역할·권한·감사** 가 운영 통제를 담당한다.

### 5.1 모델 카테고리

| 영역 | 모델 |
| --- | --- |
| 계정·권한 | `Role`, `User`, `UserIpWhitelist`, `Permission`, `RolePermission` |
| 품목 | `MaterialCategory`, `Material` (가격 6 + 요율 5), `MaterialImage`, `Tag`, `MaterialTag` |
| 품목 가격·요율 이력 | `MaterialPriceHistory` (품목별 스냅샷), `MaterialRate` (싱글톤) / `MaterialRateHistory` |
| 공급업체/거래처 | `Supplier` (type·금액·사업자번호·계좌·주소 등 확장), `SupplierHistory` (enum `SupplierType`) |
| 사업자 | `Business` |
| 물리적 위치 | `Warehouse` → `Location` → `Shelf` |
| 재고 & 이력 | `Stock` (avg_cost·stock_value 동기), `StockHistory` |
| 거래 전표 | `Inbound/InboundItem` (거래처·구매일·부가세·미수금), `Outbound/OutboundItem`, `ReturnOrder/ReturnOrderItem` |
| 발주 | `PurchaseOrder/PurchaseOrderItem` (enum `PurchaseOrderStatus`) |
| 채팅 | `ChatRoom`, `ChatRoomMember`, `ChatMessage` (enum `ChatRoomType`) |
| 파일·감사·알림 | `Attachment`, `AuditLog`, `Notification` |
| 집계·통계 | `StockDailySnapshot`, `InboundDailyStat`, `OutboundDailyStat`, `ReturnDailyStat` |
| 공통 | `Settings`, `Category` |

### 5.2 핵심 관계도 (ASCII ERD 요약)

```
Role ─┬─ User ─── UserIpWhitelist
      └─ RolePermission ── Permission

MaterialCategory (self-ref parent/children, path/depth)
        │
        ▼
Material ─┬─ MaterialImage (다중 이미지)
          ├─ MaterialTag ── Tag
          ├─ Stock (N:1 품목, N:1 창고/위치/선반)
          ├─ InboundItem  ── Inbound  ── User
          ├─ OutboundItem ── Outbound ── User
          └─ ReturnOrderItem ── ReturnOrder ── User
               (Supplier 는 InboundItem/OutboundItem 에 FK)

Warehouse ── Location ── Shelf
   (각 거래 라인은 (품목, 창고, 위치, 선반) 4중 키로 물리적 지점 특정)

Stock ── StockHistory (모든 변동 이력, type: INBOUND/OUTBOUND/RETURNORDER/TRANSFER_IN/TRANSFER_OUT/ADJUST)

StockDailySnapshot / InboundDailyStat / OutboundDailyStat / ReturnDailyStat
   (배치로 생성되는 일별 집계, 대시보드·차트용)

AuditLog (모든 Prisma write 자동 기록) ── User
Notification (사용자 알림) ── User
```

### 5.3 재고 모델의 복합 유니크 키 (설계의 핵심)

```prisma
model Stock {
  @@unique([material_id, warehouse_id, location_id, shelf_id])
}
```

- **의미**: "품목×창고×위치×선반" 네 축으로 하나의 재고 셀이 정의된다
- **효과**: 업서트/증감을 단일 행에 대한 원자적 연산으로 처리 가능
- **주의**: shelf_id 는 nullable 이라 "선반 미지정" 상태의 재고도 허용
- **조회 패턴**: `prisma.stock.groupBy({ by: ["warehouse_id", "material_id"], _sum })` 같은 2/3차원 집계가 서비스 전반(warehousStock / locationStock / shelfStock)에 반복된다

### 5.4 재고 이력(StockHistory) 설계

| 필드 | 역할 |
| --- | --- |
| `type` | 변동 유형 (INBOUND/OUTBOUND/RETURNORDER/TRANSFER_IN/TRANSFER_OUT/ADJUST) |
| `quantity` | 증감값 (+/-) |
| `before_qty` / `after_qty` | 변동 전/후 스냅샷 (감사 용이) |
| `ref_table` / `ref_id` | 원천 전표 참조 (예: `inbound`, `outbound_cancel`) |
| `unit_cost` / `amount` | 금액 추적 |
| `stock_id` | 연결 Stock (nullable: 삭제된 재고도 이력 남김) |

→ **완전한 움직임 이력(Movement Ledger)** 형태로 관리. 트랜잭션으로 Stock 업데이트와 StockHistory 생성을 한 묶음으로 처리한다(`inbound.service.js updateStock`, `outbound.service.js updateStock`, `returnorder.service.js updateStock`, `stock.service.js transfer`).

### 5.5 전표(Header/Line) 패턴

입고/출고/반품 모두 동일한 **헤더 + 라인** 구조:

```
Inbound            InboundItem         (N개 라인)
  - inbound_no       - material / warehouse / location / shelf
  - supplier_id      - supplier_id (선택, 라인 단위)
  - purchase_date    - quantity / price / supply_amount / vat
  - vat_applied
  - is_unpaid        (* PurchaseOrderItem 필드명 일치: price / supply_amount / vat)
  - user_id

Outbound           OutboundItem
  - outbound_no      - sale_price / sale_amount
  - user_id          - cost_price / cost_amount / profit  ← 원가/이익 저장

ReturnOrder        ReturnOrderItem
  - return_no        - sale_price / cost_price / profit
  - status (enum)    - reasonType / stockStatus
  - totalAmount

PurchaseOrder      PurchaseOrderItem
  - order_no         - price / supply_amount / vat
  - supplier_id      - supplier_id (헤더와 동일, 비정규화)
  - order_date       - memo
  - delivery_date
  - status · vat_applied
```

**특이점**:
- **Inbound ↔ PurchaseOrder 패턴 정렬**: 둘 다 `supplier_id`, `vat_applied` 를 헤더에 가짐. 라인 단가 필드명도 `price/supply_amount/vat` 로 통일 (과거 `unit_price/amount` 에서 리네임)
- Inbound 는 `is_unpaid` (미수금 여부)로 지급 상태를 추적 (기본 true=미지급)
- OutboundItem 에 `cost_price` / `profit` 이 저장되어 **출고 시점에 원가가 고정**됨 (이후 입고로 이동평균이 바뀌어도 이미 팔린 건은 흔들리지 않음 = 재무 재현성)
- ReturnOrderItem 은 `reasonType`, `stockStatus`(READY/DONE) 로 **반품 프로세스 상태 + 재고 반영 여부** 를 분리 추적
- ReturnOrder 만 `status` enum(REQUESTED/INSPECTING/COMPLETED/REJECTED) 을 가지며, COMPLETED 전이 시 재고를 +로 반영

### 5.6 카테고리 트리 설계

```prisma
model MaterialCategory {
  parentId Int?   @map("parent_id")
  path     String @default("")   // 예: "1/5/12/30/"
  depth    Int    @default(1)
  @@index([path])
}
```

- **closure-path 하이브리드**: 부모 참조 + path 문자열 + depth 를 같이 유지
- 장점: 조상/후손 조회를 `WHERE path LIKE '1/5/%'` 한 줄로 가능
- `category.service.js batchSave` 에서 프론트 트리 페이로드를 그대로 받아 **자식→부모 순 삭제 → saveNode 재귀 저장** 으로 트리 전체를 스냅샷 방식으로 동기화한다
- Material 이 FK 로 연결된 카테고리는 자동 삭제에서 제외(참조 무결성 보호)

### 5.7 자동 감사 로그(AuditLog)

`lib/prismaAuditMiddleware.js` 에서 Prisma `$use` 미들웨어로 모든 write 를 가로챈다:

| 액션 | before_data | after_data | 비고 |
| --- | --- | --- | --- |
| create | null | 결과 | |
| update | findUnique 사전조회 | 결과 | |
| delete | findUnique 사전조회 | 결과 | |
| upsert | findUnique 사전조회 | 결과 | before 존재 여부로 CREATE/UPDATE 판별 |
| createMany/updateMany/deleteMany | - | - | `Batch ${action} count: N` 설명만 기록 |

- 예외 시 `status: 'FAIL'` 로 기록 후 에러 재던짐 (관찰성 + 정상 전파 양립)
- AuditLog 모델 자체는 루프 방지를 위해 제외
- 컨텍스트(`user_id`, `ip`, `user_agent`, `page`)는 AsyncLocalStorage 로 주입 — 서비스 코드가 매번 넘겨줄 필요 없음

### 5.8 통계 모델(CQRS 정적 뷰)

```
InboundDailyStat  (date, material_id)  total_qty, total_cost
OutboundDailyStat (date, material_id)  total_qty, total_sales, total_cost, total_profit
ReturnDailyStat   (date, material_id)  동일
StockDailySnapshot (date, material_id, warehouse_id) quantity
```

- **일 단위 사전집계 테이블** → 대시보드/차트 쿼리가 재고 트랜잭션 테이블을 스캔하지 않아도 되도록 분리 (Read 모델)
- cron 배치가 매일 00:10 (KST) 에 `create*DailyStat()` 호출 → 해당일 데이터 deleteMany 후 createMany (멱등)
- 수동 재집계 API (`/api/stat/inbound/daily` 등) 는 동일 메서드를 호출해 재처리 가능

### 5.9 발주(PurchaseOrder)

입고와 별도로 **구매 요청 단계의 전표** 를 관리한다. 입고와 달리 재고에 즉시 영향을 주지 않는다.

```
PurchaseOrder (헤더)                PurchaseOrderItem (라인)
  - order_no (PO-<timestamp>)         - material_id
  - supplier_id                       - supplier_id (헤더와 동일, 조회 편의용 비정규화)
  - order_date / delivery_date        - quantity / price
  - status (draft|ordered|            - supply_amount / vat
            received|canceled)        - memo
  - vat_applied (bool)
  - memo
```

- **상태 전이**: `draft → ordered → received | canceled` (enum `PurchaseOrderStatus`)
- **재고 연동 없음**: 실제 재고 증가는 `Inbound` 생성 시점에만 발생. 발주는 예정 정보
- **QR 지원**: `order_no` 로 QR 코드 생성 (리스트/단건 응답에 포함)
- **알림**: 생성/수정 시 `Notification(type=PURCHASEORDER)` 발급
- **detailList 패턴**: 입고와 동일하게 `/api/purchaseOrder/detail/list` 에서 `PurchaseOrderItem` 단위 평탄화 조회 + material/supplier/기간 필터 지원

### 5.10 채팅(Chat) — 하이브리드 REST + Socket.IO

직원간 실시간 메시지. 이력·목록은 REST, 실시간 송수신은 Socket.IO 로 책임 분리.

```
ChatRoom
  - type: PUBLIC | DM       (enum ChatRoomType)
  - name                    (PUBLIC 전용, DM 은 null)
  - dm_key (unique)         ("min(a,b)_max(a,b)" 포맷, DM 쌍 중복 방지)

ChatRoomMember (방 ↔ 사용자)
  - last_read_at            (미읽음 카운트 계산용)
  - joined_at
  - UNIQUE(room_id, user_id)

ChatMessage
  - sender_id, content (Text)
  - is_deleted / deleted_at / deleted_by   ← soft delete
  - INDEX(room_id, created_at)             ← 방별 타임라인 조회 최적화
```

**핵심 설계 포인트**

| 주제 | 선택 |
| --- | --- |
| 방 유형 | PUBLIC(전체 공지방, 자동 참여) + DM(1:1) 두 가지 |
| DM 중복 방지 | `dm_key = min(a,b)_max(a,b)` 문자열을 UNIQUE 로 건 get-or-create |
| 멤버십 검증 | 모든 조회/쓰기 메서드가 `assertMember(roomId, userId)` 선행 |
| 미읽음 수 | `chatMessage.count({ sender_id ≠ me, created_at > last_read_at })` per room |
| 전송 후처리 | 트랜잭션으로 message 생성 + room.updated_at 갱신 + 본인 last_read_at = now |
| 삭제 정책 | **Soft delete** + 권한: 본인(`sender_id === user.id`) OR `is_super` |
| 삭제 응답 마스킹 | `is_deleted=true` 인 메시지는 서비스 계층에서 `content=""` 로 교체해 반환 (원본은 DB 보존) |
| 실시간 | Socket.IO 이벤트: `message:new` / `message:read` / `message:deleted` |
| 클라이언트 배지 | 방 멤버 전원의 `user:{id}` 룸으로 브로드캐스트해 관람 여부와 무관하게 배지·리스트 갱신 |

**REST 엔드포인트 요약** (`/api/chat/*`)

| Path | 설명 |
| --- | --- |
| `/public/ensure` | 전체 공지방 보장 + 자동 참여 |
| `/dm` | DM 방 get-or-create |
| `/rooms` | 내 방 목록 (마지막 메시지 + 미읽음 + DM 상대) |
| `/room` | 방 단건 (members 포함) |
| `/messages` | 메시지 이력 (역방향 페이지네이션, `beforeId`) |
| `/read` | 읽음 처리 (last_read_at = now) |
| `/unreadCount` | 헤더 배지용 전체 미읽음 합계 |
| `/leave` | 방 나가기 (DM 금지) |
| `/users` | DM 대상 유저 목록 (본인 제외, is_active) |
| `/message/delete` | 메시지 소프트 삭제 (본인/관리자) |

**Socket 이벤트 요약** — 상세는 §3.2

- C→S: `room:join`, `room:leave`, `message:send`, `message:read`, `message:delete`
- S→C: `message:new`, `message:read`, `message:deleted`, `connect_error`

**설계 결정 배경**

- REST 이력 조회를 유지한 이유: 새로고침/탭 전환 후 재동기화·페이지네이션 캐싱이 HTTP 쪽이 단순함
- 소켓을 병행한 이유: 실시간성 요구(타이핑감, 즉시 반영)가 polling 으로 커버 불가
- Soft delete 이유: 감사성·복구 가능성 + "삭제된 메시지입니다" 플레이스홀더로 대화 흐름 보존

### 5.11 품목 가격·요율 관리

품목 단위 가격과 전사 공통 요율 프리셋을 분리 운영한다.

```
Material (품목별 값 저장)
├─ 가격 6종:  inbound_price, outbound_price1/2, wholesale_price1/2, online_price
└─ 요율 5종:  outbound_rate1/2, wholesale_rate1/2, online_rate
       │
       ▼
MaterialPriceHistory
  - 가격·요율 11개 컬럼 스냅샷 + action(CREATE|UPDATE) + changed_by + reason
  - CREATE 시 항상 기록, UPDATE 는 11개 중 하나라도 변경되면 기록

MaterialRate (싱글톤, 프론트 프리셋 전용)
  - 요율 5종 (Material 의 rate 컬럼명과 동일)
  - updated_by
       │ 1:N (FK: rate_id)
       ▼
MaterialRateHistory
  - 요율 5종 스냅샷, 값 1개라도 변경 시 기록
```

- **용도 분리**: `MaterialRate` 는 품목 등록 화면의 초기값 제공용, 실제 계산에 쓰이는 값은 `Material.*_rate`
- **필드명 일치**: `MaterialRate` 의 요율 컬럼명을 Material 과 동일하게 맞춰 프론트에서 그대로 바인딩 가능
- **엔드포인트**: `/api/material/priceHistory`, `/api/materialRate/info|save|history`

### 5.12 거래처(Supplier) 확장 + 이력

거래처는 단순 마스터에서 **구매/판매 구분 + 금액 관리 + 변경 이력**을 갖춘 모델로 확장됨.

```
Supplier
├─ 기본: name, type (INBOUND|OUTBOUND), registration_no, phone, mobile, fax,
│        email, account_no, zipcode, address, address_detail, memo, sort
├─ 금액: receivable(미수금), payable(미지급금)   ← Decimal(18,2)
└─ 관계: inbounds, inbound_items, outbound_items, purchase_orders,
         purchase_order_items, histories

SupplierHistory (FK supplier_id, onDelete: Cascade)
  - type + receivable + payable + action(CREATE|UPDATE) + updated_by + reason
  - Supplier 의 type·receivable·payable 중 하나라도 변경 시 스냅샷 기록
```

- **enum `SupplierType`**: `INBOUND`(구매=공급업체) / `OUTBOUND`(판매=고객사)
- **자동 이력**: `supplier.service.save` 가 변경 감지하여 `SupplierHistory` 생성
- **미지급금 자동 반영**: `inbound.service` 가 저장/삭제 시 `Supplier.payable` delta 적용 (§6.5 참조)
- **엔드포인트**: `/api/supplier/history`

---

## 6. 대표 트랜잭션 흐름

### 6.1 입고 저장 (`inbound.service.save`)
```
1. Inbound 헤더 생성/수정 (supplier_id, purchase_date, vat_applied, is_unpaid 포함)
2. Notification(INBOUND) 생성
3. items 루프:
   - 기존 item 이면 updateStock(-old_qty) 로 원복 → InboundItem update (price/supply_amount/vat) → updateStock(+new_qty)
   - 신규 item 이면 InboundItem create → updateStock(+qty)
4. 요청에 없는 기존 item 은 InboundItem 삭제 + updateStock(-qty)
5. 거래처 미지급금 반영: 이전/신규 items 를 supplier_id 별 집계 → delta 계산
   → applySupplierPayableDelta(tx, deltaMap) 으로 Supplier.payable 증감 + SupplierHistory 1행씩 기록
   → updateStock 은 Stock.upsert + StockHistory(INBOUND/OUTBOUND) 원샷
     + 이동평균 avg_cost · stock_value 자동 재계산 (§6.6)
```

### 6.2 출고 저장 (`outbound.service.save`)
- 입고와 구조 동일하나, 저장 시점에 **Stock.avg_cost 를 읽어 cost_price 를 고정**하고 `sale_amount - cost_amount = profit` 계산
- 재고 부족 시 AppError 던져 트랜잭션 롤백
- stock_value 를 새 수량 기준으로 재계산 (avg_cost 는 유지)

### 6.3 재고 이동 (`stock.service.transfer`)
- from/to Location 을 통해 warehouse_id 파생 → 동일 창고 내 이동이 아니어도 동작
- 출발지 차감 + 도착지 증가 (도착지 Stock 없으면 새로 생성, 출발지 `shelf_id` 그대로 보존)
- **이동평균 병합**: 도착지에 기존 재고 있으면 단가 가중평균 재계산
- StockHistory 에 `TRANSFER_OUT`(-qty) + `TRANSFER_IN`(+qty) 두 건을 짝으로 기록 (shelf_id / unit_cost / amount 포함)
- STOCK 타입 알림 생성

### 6.4 반품 완료 (`returnorder.service.save` → status=COMPLETED)
- 각 item 의 창고/위치/선반에 +수량으로 Stock upsert + StockHistory(RETURNORDER)
- `stockStatus`=DONE 으로 재고 반영 완료 표시
- 삭제 시 COMPLETED 였으면 -수량으로 원복
- avg_cost 는 유지 (신규 셀은 `item.cost_price` 로 초기화), stock_value 재계산

### 6.5 거래처 미지급금 자동 반영 (`applySupplierPayableDelta`)

입고 저장/삭제 트랜잭션 내부에서 실행되는 `inbound.service` 의 헬퍼:

```
1. aggregateSupplierAmounts(oldItems) / aggregateSupplierAmounts(newItems)
   → 각 supplier_id 별 supply_amount 합계 Map 생성 (supplier_id 없는 item 은 제외)
2. supplier 별 delta = new - old 계산
3. delta != 0 인 supplier 에 대해:
   - Supplier.payable 을 { increment: delta } 로 갱신
   - SupplierHistory 1행 기록 (action=UPDATE, reason="입고 {no} 반영 (+/-)")
```

- **입고 삭제 시**: 모든 item 의 supply_amount 를 음수 delta 로 적용 (payable 차감)
- **수정 시**: 기존 items 와 신규 items 의 합계 차이만큼 정확히 ±
- **supplier 교체**: 같은 item 이 A→B 로 바뀌면 A -amount, B +amount 각각 기록

### 6.6 재고 금액 동기 (`avg_cost` / `stock_value`)

모든 재고 증감 연산에서 함께 관리되는 회계 지표:

| 연산 | avg_cost | stock_value |
| --- | --- | --- |
| 입고(+) | 이동평균 재계산 `(oldQty*oldAvg + inQty*inPrice) / newQty` | `newQty * newAvg` |
| 입고 롤백/출고(−) | 유지 | `newQty * avg_cost` |
| 반품(+) | 유지 (0 이었으면 `item.cost_price` 로 초기화) | `newQty * avg_cost` |
| Transfer IN | 도착지 기준 이동평균 병합 | `newQty * mergedAvg` |
| Transfer OUT | 유지 | `newQty * avg_cost` |
| 재고 0 소진 | 0 으로 초기화 | 0 |

이전에는 avg_cost 가 0 으로 고정돼 출고 원가·이익이 모두 0 으로 저장되던 버그를 해결한 핵심 변경 지점.

---

## 7. 주요 엔드포인트 요약

| Prefix | 책임 | 주요 특이사항 |
| --- | --- | --- |
| `/api/auth` | 로그인/회원가입/비밀번호 재설정 | JWT(3h), Resend 이메일 인증 |
| `/api/material` | 품목 마스터 + 이미지 + 태그 | multipart 업로드, QR 생성 |
| `/api/category` | 품목 카테고리 트리 | path/depth, 자식→부모 순 삭제 |
| `/api/tag` | 태그 + 품목-태그 매핑 | `syncMaterialTags` 재동기화 |
| `/api/supplier` | 공급업체 | |
| `/api/business` | 사업자(등록번호·회사명·대표·주소·연락처·FAX) | 독립 마스터, 공통 CRUD 6종 |
| `/api/warehouse` | 창고 (도면 좌표 포함) | 삭제 시 Location/Shelf cascade |
| `/api/location` | 창고 내 위치 | |
| `/api/shelf` | 위치 내 선반 | x/y/w/h 도면 좌표 |
| `/api/stock` | 재고 조회/이동/이력 | warehousStock·locationStock·shelfStock 다차원 집계 |
| `/api/inbound` | 입고 전표 | permission("inbound.*") 적용 |
| `/api/outbound` | 출고 전표 | 원가/이익 고정, 반품 대상 조회 |
| `/api/returnorder` | 반품 전표 | 상태 전이, 재고 반영 |
| `/api/purchaseOrder` | 발주 전표 | draft/ordered/received/canceled 상태, detail/list 평탄화 조회, PURCHASEORDER 알림 |
| `/api/chat` | 채팅(REST 측) | 방 목록·이력·읽음·미읽음·삭제. 실시간은 Socket.IO |
| `/api/user` `/role` `/permission` | 계정·역할·권한 마스터 | RBAC 기반 |
| `/api/notification` | 알림 조회/읽음 | 유형별 카운트 (INBOUND/OUTBOUND/MATERIAL/RETURNORDER/PURCHASEORDER) |
| `/api/auditLog` | 감사 로그 | permission("dashboard.view") |
| `/api/settings` | 시스템 설정 | key/value 동적 |
| `/api/stat` | 일별 통계 생성/조회/차트 | cron 과 동일 메서드 |
| `/api/dashboard` | 종합 대시보드 | 14개 쿼리 $transaction 병렬 실행 |

---

## 8. 설계상 강점 / 주의점

### 강점
1. **완전한 감사성**: Prisma 미들웨어로 모든 CRUD 가 AuditLog 에 자동 기록, AsyncLocalStorage 로 컨텍스트 주입이 서비스 코드에 침투하지 않음
2. **재고 이력의 이중기입**: Stock 현재값 + StockHistory 흐름 로그를 함께 유지 → 무결성·감사·되감기가 쉬움
3. **전표 원가 고정**: OutboundItem 이 cost_price/profit 을 저장해 과거 재무 재현 가능
4. **CQRS 식 집계 테이블**: DailyStat/Snapshot 분리로 대시보드 쿼리 최적화
5. **도면 좌표 내장**: Warehouse/Location/Shelf 에 points/rotation/x/y/w/h 보존 → 프론트 시각화 직결
6. **공통 CRUD 패턴**: 프론트/백 양쪽 스캐폴딩 재사용 용이
7. **권한 체계**: JWT 페이로드에 권한 코드 배열을 담아 DB 재조회 없이 인가 (superadmin 우회)
8. **API 자동 마운트**: `routes/` 파일만 추가하면 즉시 `/api/<name>` 마운트

### 주의/개선 여지
1. **cron 비활성**: `server/index.js` 에서 `import "./cron/cron.js";` 가 주석 처리되어 있어 **현재 일별 통계 자동 생성이 돌지 않음**. 운영 반영 시 주석 해제 필요
2. **`db/prisma.js` 중복**: 감사 미들웨어 없이 생성된 PrismaClient 가 레거시로 남아있음. 실수로 import 하면 감사 로그가 누락되므로 제거 권장
3. **`AuditLog.target_id` 가 `Int?`**: 단일 키 테이블에만 적합. 복합 PK 모델(RolePermission 등)에는 target_id 가 null 로 남음
4. **Outbound 재고 차감 동시성**: `upsert + check` 방식이라 고동시 트래픽에서 과차감 가능. 필요 시 행 락(`SELECT ... FOR UPDATE`) 고려
5. **Zod `validate` 가 전역 플러그인이 아닌 함수 호출식**: 라우트마다 `validate(schema, req.body)` 수동 호출 → 누락 위험. Fastify 스키마 라우트 옵션(`schema: { body: ... }`) 전환 고려
6. **`material.service.save` 파일 롤백**: 트랜잭션 실패 시 저장된 이미지만 삭제. 다중 파일 쓰기 중간 실패 시 일부 파일은 이미 디스크에 있으므로 예외 경로에서 전부 누적 관리는 되어있음 — 다만 **트랜잭션 커밋 후 디스크 실패** 시나리오는 커버되지 않음
7. **`returnorder.service.save` 의 updateStock**: diff 계산을 `stock.quantity - diffQty` 로 구해 before_qty 를 산출 — 동시 변경 환경에서 before_qty 가 "그 순간의 현재-증분" 이라 실제 이전값과 괴리 가능
8. **`stat.service.buildDateWhere` 기본값이 "오늘"**: 통계 리스트 API 에 기간 누락 시 오늘만 보이므로 프론트 페이지에서 항상 범위를 지정해야 함
9. **국제화 미반영**: 에러 메시지/알림 문구가 한국어 하드코딩

---

## 9. 운영·배포 힌트

- `.env` 필수 키: `DATABASE_URL`, `API_KEY`, `JWT_SECRET`, `MAIL_KEY`
- `npx prisma migrate dev --name <변경이름>` → `npx prisma generate`
- 서버 기동: `npm run dev` (= `node server/index.js`, 기본 포트 3001, 0.0.0.0 바인딩)
- **HTTP + Socket.IO 공용 포트**: 3001 하나로 둘 다 서빙. 소켓 경로는 기본값 `/socket.io/*`. 리버스 프록시 배치 시 `Upgrade`/`Connection` 헤더 포워딩 필수
- **Socket.IO CORS**: `origin: true` 로 모든 오리진 허용 중 → 운영에서는 화이트리스트로 좁힐 것
- 정적 리소스: `/uploads/*` 는 `process.cwd()/uploads` 로 매핑
- 배치 활성화: `server/index.js` 상단 `// import "./cron/cron.js";` 주석 해제
- 타임존: 서버 기동 시스템의 TZ 와 무관하게 cron 은 `Asia/Seoul`, 통계 집계도 KST 기준(`getDateRange`)

---

## 10. 요약

이 서버는 **"재고(Stock) = 품목×창고×위치×선반 4축의 실시간 수량" + "StockHistory = 모든 움직임의 완전한 이력"** 이라는 두 축 위에 입고·출고·반품·발주 전표가 얹어진 구조다. 모든 DB 변경은 자동 감사되고, 일 단위 집계 테이블이 대시보드 쿼리를 분리해 받쳐준다. RBAC·IP 화이트리스트·API Key 로 보안이 3중으로 잠겨 있고, 도메인 라우트는 파일을 추가하는 것만으로 자동 등록된다. 직원간 실시간 협업은 Socket.IO 기반 채팅(전체 공지방 + 1:1 DM, soft delete) 이 HTTP 레이어와 공존한다. 설계 의도가 일관되어 있어 확장성과 감사성 양쪽이 잘 확보된 소형 품목관리 WMS 구조라고 평가할 수 있다.
