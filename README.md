# crm-backendFF

Бекенд саппорт-CRM поверх групових Telegram-чатів (shared inbox / helpdesk / CRM-рівень).
Повна специфікація — див. `tz-support-telegram-helpdesk.md` (додається окремо, не в цьому репозиторії).

Стек: NestJS + TypeScript, Prisma + PostgreSQL, BullMQ + Redis, grammY (Telegram Bot API),
Socket.IO. Модульний моноліт: `tickets`, `chats`, `routing`, `notifications`, `analytics`,
`telegram`, `auth`, `excluded-senders` — домен спілкується подіями (`EventEmitter2`), щоб нові
фічі підписувались на події, не чіпаючи ядро.

## Статус — зупинився на Seq 27 з `support_crm_backlog.xlsx`

Зроблено (Seq 1–12, 17–19, 23, 26–27 з беклогу), код є і компілюється/лінтиться/проходить тести:

- Seq 1–4 (M0): repo init, CI, Docker Compose (api/workers/postgres/redis), Dockerfile
  з цілями `api`/`workers`, повна Prisma-схема (розділ 5 ТЗ), початкова міграція, seed.
- Seq 5–10 (M1): Telegram webhook (перевірка secret token), нормалізація апдейтів,
  `ClientDetectionService`, **логіка групування тредів (правила 1–3, розділ 4)** — 9 юніт-тестів.
- Seq 11–12 (M2, частково): сервіси `tickets`/`messages`/`labels`/`internal comments`,
  доменні події через `EventEmitter2`.
- Seq 17–19 (M3): Telegram Login Widget (HMAC), сесія (HTTP-only cookie), ролі admin/lead/agent.
- Seq 23 (M4): excluded-senders CRUD + resolve username→id + «Позначити як не клієнт».
- Seq 26–27 (M5): стратегії маршрутизації manual/round_robin/least_busy, `TicketsService.assign`.

**Відомі прогалини навіть у зробленому** (щоб не було ілюзії «майже готово»):

- Немає `main.ts` / `worker.ts` / кореневого `AppModule`/`WorkerModule` — усі модулі написані
  окремо, але ніде не зібрані докупи. Проєкт не запускається.
- `EventEmitterModule.forRoot()` ніде не підключено — `EventEmitter2` наразі нічим не наповнений.
- BullMQ-продюсери інжесту/outbound є, а самих воркерів-консюмерів (`@Processor`), які
  розбирають чергу (Seq 7, 16), — ще нема.
- `RoutingService` (Seq 26) написаний, але `IngestOrchestratorService` його ще не викликає —
  зараз новий тікет бере `chat.defaultTeamId`/`defaultAssigneeId` напряму, без стратегії.

Не почато: Seq 13–16 (REST/WS-шар поверх тікетів), Seq 20–22 (мінімальний frontend — не в
цьому репозиторії), Seq 28 і далі (claim/колізії, нотифікації M6, chat_groups/директорія M7,
аналітика M8, і все, що після). Повний список — `support_crm_backlog.xlsx`.

## Запуск (коли дійде до робочого стану)

```bash
cp .env.example .env   # заповнити BOT_TOKEN, JWT_SECRET тощо
npm install
docker compose up -d postgres redis
npm run prisma:migrate:deploy
npm run prisma:seed
npm run start:dev       # API
npm run start:worker:dev  # Workers, окремий процес
```

## Git-workflow для команди

Гілка `main` — завжди робочий стан, у неї напряму не пушимо. Кожен працює у власній гілці.

### 1. Створити свою гілку

Раз на задачу (або раз, якщо працюєте у своїй "постійній" гілці):

```bash
git checkout main
git pull origin main
git checkout -b <своє_ім'я>   # своя гілка від актуального main, напр. Dima
```

Назва гілки — своя зі своїм іменем (напр. `Dima`, `Olga`, або `Dima/excluded-senders` під конкретну задачу).

### 2. Пiдтягнути свіжі зміни з main у свою гілку

Робити регулярно, а не тільки в кінці — так менше конфліктів:

```bash
git checkout main
git pull origin main
git checkout <своє_ім'я>
git merge main                # або: git rebase main
```

Якщо конфлікт — git покаже файли з конфліктом, треба відкрити їх, вибрати правильний варіант
(прибрати маркери `<<<<<<<`, `=======`, `>>>>>>>`), після чого:

```bash
git add <виправлені файли>
git merge --continue           # якщо merge; для rebase: git rebase --continue
```

### 3. Закинути свою роботу в main

```bash
git add <файли>
git commit -m "коротко що зробив"
git push origin <своє_ім'я>
```

Потім — Pull Request зі своєї гілки в `main` (не push напряму в `main`), щоб хтось інший міг
подивитись на зміни перед мержем. Після мержу PR — оновити свою локальну `main`:

```bash
git checkout main
git pull origin main
```

### Правила

- Не комітити `.env` (там секрети — `BOT_TOKEN`, `JWT_SECRET`). Він і так у `.gitignore`.
- Один коміт — одна логічна зміна. Повідомлення коміту — що і навіщо, не "fix" чи "wip".
- Перед тим як відкривати PR — переконатись, що `npm run build` і `npm test` проходять локально.
