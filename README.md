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
- **Проєкт тепер реально запускається**: `main.ts`/`AppModule` (API, HTTP на `/api/*`, Swagger
  на `/api/docs` + `/api/docs-json`, `GET /api/health`) і `worker.ts`/`WorkerModule` (окремий
  процес) — обидва перевірені: піднімають усі модулі й падають рівно на підключенні до
  Postgres/Redis, якщо їх нема (очікувана поведінка без `docker compose up`).

**Відомі прогалини навіть у зробленому** (щоб не було ілюзії «майже готово»):

- BullMQ-продюсери інжесту/outbound є, а самих воркерів-консюмерів (`@Processor`), які
  розбирають чергу (Seq 7, 16), — ще нема. `WorkerModule` підключається до Redis, але поки
  нічого не обробляє.
- `RoutingService` (Seq 26) написаний, але `IngestOrchestratorService` його ще не викликає —
  зараз новий тікет бере `chat.defaultTeamId`/`defaultAssigneeId` напряму, без стратегії.
- `TicketsModule`/`ChatsModule` як окремі NestJS-модулі ще не створені — сервіси
  (`TicketsService`, `ChatsService`, `IngestOrchestratorService` тощо) існують, але нічим не
  підключені до `AppModule`/`WorkerModule` (бо REST/WS-шару, який би їх використовував, ще нема
  — Seq 13–16).

Не почато: Seq 13–16 (REST/WS-шар поверх тікетів), Seq 20–22 (мінімальний frontend — не в
цьому репозиторії), Seq 28 і далі (claim/колізії, нотифікації M6, chat_groups/директорія M7,
аналітика M8, і все, що після). Повний список — `support_crm_backlog.xlsx`.

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
