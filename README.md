# crm-backendFF

Бекенд саппорт-CRM поверх групових Telegram-чатів (shared inbox / helpdesk / CRM-рівень).
Повна специфікація — див. `tz-support-telegram-helpdesk.md` (додається окремо, не в цьому репозиторії).

Стек: NestJS + TypeScript, Prisma + PostgreSQL, BullMQ + Redis, grammY (Telegram Bot API),
Socket.IO. Модульний моноліт: `tickets`, `chats`, `routing`, `notifications`, `analytics`,
`telegram`, `auth`, `excluded-senders` — домен спілкується подіями (`EventEmitter2`), щоб нові
фічі підписувались на події, не чіпаючи ядро.

## Статус

Проєкт у розробці. На поточний момент реалізовано (з юніт-тестами де це доменна логіка):

- Каркас репозиторію, CI, Docker Compose (api/workers/postgres/redis), Dockerfile з цілями
  `api`/`workers`.
- Повна Prisma-схема моделі даних (розділ 5 ТЗ) + початкова міграція + seed.
- Telegram webhook (перевірка secret token), нормалізація апдейтів, BullMQ-інжест з дедупом.
- `ClientDetectionService` — хто клієнт/агент/виключений відправник.
- **Логіка групування тредів (правила 1–3, розділ 4 ТЗ)** — покрита юніт-тестами.
- Домен tickets/messages/labels/internal comments, event bus.
- Auth: Telegram Login Widget (HMAC), сесія (HTTP-only cookie), ролі admin/lead/agent.
- Excluded senders: CRUD, resolve username→id, «Позначити як не клієнт».
- Routing: manual/round_robin/least_busy.

Ще не підключено в `AppModule`/`WorkerModule` і не має REST/WS-шару поверх: див. відкриті задачі
в `support_crm_backlog.xlsx` (Seq 13–16, 29–38 і далі) — це наступний крок.

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
git checkout -b Dima          # своя гілка від актуального main
```

Назва гілки — своя (`Dima`, `Olga`, або `Dima/excluded-senders` під конкретну задачу).

### 2. Пiдтягнути свіжі зміни з main у свою гілку

Робити регулярно, а не тільки в кінці — так менше конфліктів:

```bash
git checkout main
git pull origin main
git checkout Dima
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
git push origin Dima
```

Потім — Pull Request з `Dima` в `main` (не push напряму в `main`), щоб хтось інший міг
подивитись на зміни перед мержем. Після мержу PR — оновити свою локальну `main`:

```bash
git checkout main
git pull origin main
```

### Правила

- Не комітити `.env` (там секрети — `BOT_TOKEN`, `JWT_SECRET`). Він і так у `.gitignore`.
- Один коміт — одна логічна зміна. Повідомлення коміту — що і навіщо, не "fix" чи "wip".
- Перед тим як відкривати PR — переконатись, що `npm run build` і `npm test` проходять локально.
