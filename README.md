# crm-backendFF

Бекенд саппорт-CRM поверх групових Telegram-чатів (shared inbox / helpdesk / CRM-рівень).
Повна специфікація — див. `tz-support-telegram-helpdesk.md` (додається окремо, не в цьому репозиторії).

Стек: NestJS + TypeScript, Prisma + PostgreSQL, BullMQ + Redis, grammY (Telegram Bot API),
Socket.IO. Модульний моноліт: `tickets`, `chats`, `routing`, `notifications`, `analytics`,
`telegram`, `auth`, `excluded-senders` — домен спілкується подіями (`EventEmitter2`), щоб нові
фічі підписувались на події, не чіпаючи ядро.

## Статус — зупинився на Seq 47 з `support_crm_backlog.xlsx`

Зроблено (Seq 1–19, 23, 26–29, 31–37, 45–47 з беклогу), код є і компілюється/лінтиться/проходить тести:

- Seq 1–4 (M0): repo init, CI, Docker Compose (api/workers/postgres/redis), Dockerfile
  з цілями `api`/`workers` (з фіксами під Alpine — див. нижче), повна Prisma-схема
  (розділ 5 ТЗ), початкова міграція, seed.
- Seq 5–10 (M1): Telegram webhook (перевірка secret token), нормалізація апдейтів,
  `ClientDetectionService`, **логіка групування тредів (правила 1–3, розділ 4)** — 9 юніт-тестів.
- Seq 11–12 (M2): сервіси `tickets`/`messages`/`labels`/`internal comments`, доменні події
  через `EventEmitter2` (`EventEmitterModule.forRoot()` підключено в `CoreInfraModule`).
- Seq 13–14 (M2): REST `/api/tickets` — список з фільтрами й курсорною пагінацією, get/patch,
  reply, comments, assign, close/reopen/snooze, bulk.
- Seq 15 (M2): WebSocket `/ws` — `ticket:new/updated/assigned`, `message:new`, `comment:new`,
  `agent:typing` (кімнати `ticket:<id>`, приєднання через `ticket:join`/`ticket:leave`).
  З'єднання гейтиться тією ж сесійною кукою, що й REST (немає активного агента — дисконект).
- Seq 16 (M2): outbound-черга — `OutboundProcessor` реально шле `sendMessage` в Telegram і
  підтверджує `tg_message_id` на повідомленні; глобальний rate-limit (~25/с) через BullMQ.
- Seq 7 (M1): `IngestProcessor` реально розбирає чергу інжесту й запускає
  `IngestOrchestratorService` — вхідні повідомлення з Telegram тепер справді стають тікетами.
- Seq 17–19 (M3): Telegram Login Widget (HMAC), сесія (HTTP-only cookie), ролі admin/lead/agent.
- Seq 23 (M4): excluded-senders CRUD + resolve username→id + «Позначити як не клієнт».
- Seq 26–28 (M5): стратегії маршрутизації manual/round_robin/least_busy — тепер і справді
  застосовуються при створенні нового тікета (`IngestOrchestratorService` кличе
  `RoutingService.decideAssignment`); `POST /api/tickets/:id/claim` — «беру на себе» в один клік
  (колізії/"друкує" вже покриті `agent:typing` з Seq 15).
- Seq 29, 31–32 (M6): нотифікації — таблиці `notifications`/`notification_prefs`,
  `NotificationEventsListener` реагує на `message.received`/`ticket.assigned`/`comment.created`
  (без прямих викликів із REST/ingest — чиста підписка на події, як і вимагає розділ 3.3),
  Telegram DM-канал через того самого бота, дедуп: кілька подій по одному тікету за 5 хв
  оновлюють один запис, а не плодять нові. REST: `/api/notifications`, `/api/notification-prefs`.
- Seq 33–35 (M7, бекенд-частина): REST `/api/chats` (директорія з беклогом/обсягом на чат),
  `/api/chats/:id` (налаштування — група/команда/виконавець/стратегія за замовчуванням),
  `/api/chat-groups`.
- Seq 36–37 (M8): фонова джоба `chat_stats_daily` (BullMQ repeatable job, щодня о 01:00 UTC) +
  `/api/analytics/chats` і `/api/analytics/overview` (сума збережених днів + «сьогодні» на льоту,
  як і вимагає розділ 11 ТЗ).
- Seq 45–47 (M9): `/api/saved-views` (особисті + спільні, з правом редагування лише власником
  для особистих), `/api/canned-responses` (без виконання дій — див. прогалини нижче),
  `/api/organizations` + `/api/customers/:id/organization` (історія звернень по компанії).
- **Виправив приховану архітектурну діру у власному WS-коді з попереднього кроку**: тікети
  найчастіше створюються в процесі Workers (інжест), а WebSocket-сервер, до якого підключені
  браузери агентів, живе в процесі API — а `EventEmitter2` per-process, між ними нічого не
  спільного. Без мосту `ticket:new`/`message:new` від інжесту просто ніколи не долітали б до
  агента вживу. Додав `WorkerEventPublisher`/`ApiEventSubscriber` — Redis pub/sub міст, що
  ретранслює доменні події з Workers в API.
- **Проєкт реально запускається й піднімається в Docker Compose**: `main.ts`/`AppModule` (API,
  `/api/*`, Swagger `/api/docs`+`/api/docs-json`, `GET /api/health`) і `worker.ts`/`WorkerModule`
  — обидва перевірені і локальним boot-тестом (падають рівно на підключенні до Postgres, якщо
  його нема), і повним прогоном через `support-crm-infra`'s `docker compose up` + smoke-test
  CI (зелений, включно з реальним Postgres/Redis/reverse-proxy) — станом на Seq 37; Seq 45–47
  поки перевірені лише локальним DI-boot-тестом, ще не через повний infra smoke-test.

## Перевірено вживу з реальними Postgres/Redis (локально, без Docker)

Підняв Postgres+Redis напряму через Homebrew (не Docker), застосував міграції, засідив дані,
запустив `main.ts`+`worker.ts`, підключив фронтенд і **симулював реальний вхідний Telegram
webhook** — весь пайплайн інжесту (вебхук → черга → класифікація відправника → групування
тредів → створення тікета → повідомлення) відпрацював end-to-end вперше, і так само claim,
reply (реальний виклик Telegram API з правильними ретраями на 401), messages, аналітика.

Це виявило **чотири реальні баги, які жоден DI-boot-тест не міг спіймати** (усі виправлені):

1. **Не було глобального `ValidationPipe`** — жоден `@IsIn`/`@IsUUID`/`@Type(() => Number)` у
   жодному DTO ніколи не виконувався; `ListTicketsQueryDto.limit` завжди приходив `undefined`,
   через що `GET /tickets` падав з 500 (`Argument take is missing`). Додано
   `app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))`.
2. **Міграція не була перегенерована** після того, як я зробив `messages.tg_message_id`
   nullable в схемі (див. попередній розділ) — у реальній БД колонка досі мала `NOT NULL`,
   тому будь-яка відповідь агента падала з `Null constraint violation`. Додано міграцію
   `make_tg_message_id_nullable`.
3. **BullMQ забороняє `:` у custom `jobId`** — `TelegramIngestProducer` формував дедуп-ключ як
   `${chatId}:${tgMessageId}`, і будь-який реальний вхідний вебхук падав з
   `Error: Custom Id cannot contain :`. Замінено роздільник на `_`.
4. **Аналітика губила «сьогодні»**: `to=2026-08-08` парситься як північ *початку* дня; з
   `lte` це виключало все, що сталось пізніше того ж дня, тобто поточний день практично ніколи
   не потрапляв у власний діапазон. `AnalyticsController` тепер розширює `to` до кінця дня.

Разом із раніше знайденим BigInt-фіксом — **п'ять критичних багів, жоден з яких не спливав без
реального Postgres/Redis і реального проходу через UI**. Це найкраще підтвердження того, чому
DI-boot-тест (падає ще до підключення БД) — необхідна, але недостатня перевірка.

**Відомі прогалини навіть у зробленому:**

- Rate-limit на outbound — лише глобальний (~25 msg/s), per-chat (~1 msg/s) не реалізовано:
  потребує або власного Redis token-bucket по chat_id, або BullMQ Pro (group rate limit).
  Реальний ризик тут м'який — Telegram сам поверне 429 при перевищенні, і ретраї з backoff
  (вже налаштовані) це підхоплять, просто не так елегантно, як proactive-лімітування.
- Аналітика `avgFirstResponseSec`/`avgResolutionSec` за діапазон днів — неозважене середнє
  середніх по днях, не по кожному тікету: `chat_stats_daily` зберігає лише агрегат на день,
  не сирі семпли, тож точне зважене середнє за діапазон без зміни структури таблиці неможливе.
- `canned_responses.variables` зберігає лише назви {плейсхолдерів}, не дії — макрос, що сам
  ставить лейбл/статус/пріоритет (розділ 12 ТЗ), у поточній схемі не представлений; це має
  робити клієнт (застосувати текст, потім звичайний `PATCH /tickets/:id`).
- Все, що лишилось у CRM-рівні: Seq 48–49 (audit log UI, командна палітра — обидва Frontend,
  не сюди), і все після M9 (M10–M13 — Frontend/DevOps/QA).

## Запуск

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

Гілка `main` — завжди робочий стан, у неї напряму не пушимо. Кожен працює у власній гілці зі
своїм іменем.

### Основні поняття (коротко)

- **repo (репозиторій)** — папка проєкту з історією змін (`.git` всередині).
- **remote / origin** — копія репозиторію на GitHub. `origin` — стандартна назва цієї копії.
- **branch (гілка)** — незалежна лінія розробки. `main` — спільна/робоча, інші — особисті.
- **commit (коміт)** — знімок змін із повідомленням, що і навіщо змінили.
- **clone** — перше завантаження репозиторію з GitHub собі на комп'ютер (робиться один раз).
- **pull** — забрати нові коміти з GitHub і накласти на свою поточну гілку (`fetch` + `merge`).
- **push** — відправити свої локальні коміти на GitHub.
- **merge conflict** — git не зміг сам об'єднати зміни в одному й тому ж місці файлу, треба
  вирішити вручну.

### 0. Перше клонування (робиться один раз на комп'ютері)

```bash
git clone https://github.com/zhukbet/crm-backendFF.git
cd crm-backendFF
```

Якщо репозиторій вже є локально (як зараз) — цей крок пропускаємо.

### 1. Створити свою гілку

```bash
git checkout main
git pull origin main
git checkout -b <своє_ім'я>   # своя гілка від актуального main, напр. Dima
```

`git checkout -b` одразу і створює гілку, і перемикається на неї. Назва гілки — своя зі своїм
іменем (напр. `Dima`, `Olga`, або `Dima/excluded-senders` під конкретну задачу).

### 2. Щоденний цикл роботи

Перед тим як почати працювати — перевірити, що змінилось:

```bash
git status              # що змінено/додано локально, не закомічено
git branch              # на якій я гілці зараз (позначена зірочкою *)
```

Після того як щось зробили у коді:

```bash
git status                     # ще раз глянути, які файли змінились
git diff                       # подивитись самі зміни рядок-в-рядок (q — вийти)
git add <файл1> <файл2>        # додати конкретні файли в коміт (НЕ git add . про запас)
git commit -m "що і навіщо"    # закомітити з описовим повідомленням
git push origin <своє_ім'я>    # відправити на GitHub
```

Якщо гілка вже раз запушена — далі досить просто `git push` (без `origin <ім'я>`), git сам
знає, куди пушити.

### 3. Стягнути оновлення (pull)

Робити регулярно, а не тільки в кінці — так менше конфліктів:

```bash
git checkout main
git pull origin main           # забрати свіжі коміти з GitHub у main
git checkout <своє_ім'я>
git merge main                 # перенести ці оновлення у свою гілку
```

`git pull` = `git fetch` (завантажити нові коміти) + `git merge` (об'єднати їх з поточною
гілкою) за один крок. Якщо просто хочете подивитись, що нового на GitHub, не змінюючи нічого
локально — використовуйте `git fetch origin` окремо.

**Якщо конфлікт** — git покаже, у яких файлах не зміг об'єднати зміни автоматично:

```bash
git status                     # покаже "both modified: <файл>"
```

Відкрийте ці файли — там будуть маркери:

```
<<<<<<< HEAD
ваш варіант коду
=======
варіант з main
>>>>>>> main
```

Виберіть правильний варіант (або об'єднайте обидва вручну), приберіть маркери `<<<<<<<`,
`=======`, `>>>>>>>` повністю, збережіть файл, тоді:

```bash
git add <виправлені файли>
git merge --continue            # якщо через merge; для rebase: git rebase --continue
```

### 4. Запушити свою роботу (push) і відкрити PR

```bash
git add <файли>
git commit -m "коротко що зробив"
git push origin <своє_ім'я>
```

Якщо це перший push цієї гілки, git попросить `-u`:

```bash
git push -u origin <своє_ім'я>   # -u запам'ятовує зв'язок гілки з origin/<своє_ім'я>
```

Далі — Pull Request зі своєї гілки в `main` на GitHub (кнопка "Compare & pull request" з'явиться
сама після push). Не пушимо напряму в `main`, щоб хтось інший міг подивитись на зміни перед
мержем. Після мержу PR на GitHub — оновити свою локальну `main`:

```bash
git checkout main
git pull origin main
```

### Шпаргалка команд

| Команда | Що робить |
|---|---|
| `git status` | що змінено, на якій гілці |
| `git diff` | детальні зміни рядок-в-рядок (ще не в коміті) |
| `git log --oneline` | коротка історія комітів |
| `git branch -a` | список усіх гілок (локальних і на GitHub) |
| `git checkout <гілка>` | перемкнутись на іншу гілку |
| `git pull origin main` | стягнути свіжий `main` з GitHub |
| `git push origin <гілка>` | відправити свою гілку на GitHub |
| `git stash` / `git stash pop` | тимчасово відкласти незакомічені зміни й повернути назад |
| `git checkout -- <файл>` | скасувати незакомічені зміни в конкретному файлі |

### Типові проблеми

- **Закомітив, але ще не запушив, і хочу виправити повідомлення коміту:**
  `git commit --amend -m "нове повідомлення"`.
- **Хочу скасувати останній коміт, але залишити зміни в файлах** (ще не запушений):
  `git reset --soft HEAD~1`.
- **`git push` каже "rejected", бо на GitHub вже є нові коміти в цій гілці** (хтось інший туди
  пушив або гілку оновили через PR): спочатку `git pull origin <гілка>`, вирішити конфлікти
  якщо є, потім `git push` знову.
- **Випадково почав працювати не в тій гілці:** якщо ще нічого не закомітили —
  `git stash`, `git checkout <потрібна_гілка>`, `git stash pop`.

### Правила

- Не комітити `.env` (там секрети — `BOT_TOKEN`, `JWT_SECRET`). Він і так у `.gitignore`.
- Один коміт — одна логічна зміна. Повідомлення коміту — що і навіщо, не "fix" чи "wip".
- Перед тим як відкривати PR — переконатись, що `npm run build` і `npm test` проходять локально.
