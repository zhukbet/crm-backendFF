# Definition of Done — звірка з §16 ТЗ

Чесний статус на 2026-08-09, перевірено грепом коду (не з пам'яті) + живим прогоном
проти реального Postgres/Redis (див. README, розділ "Перевірено вживу") +
`npm run test:e2e` (8/8 зелені, `test/app.e2e-spec.ts`).

Позначення: ✅ зроблено й перевірено · ⚠️ бекенд готовий, фронтенду немає · ❌ не зроблено.

| § | Пункт | Статус | Де |
|---|---|---|---|
| 1 | Docker Compose піднімає api + workers + web + postgres + redis | ✅ | `crm-infraFF/docker-compose.yml` — усі 5 сервісів + reverse-proxy (Caddy), CI смоук-тест `curl`-ить `/api/health` і фронт |
| 2 | Вхід через Telegram, allowlist, ролі admin/lead/agent | ✅ | `AllowlistGuard` перевіряє `Agent.isActive`; `AgentRole` enum = admin/lead/agent (`schema.prisma:15`); Telegram Login Widget HMAC у `auth.controller.ts` |
| 3 | Нове звернення (не allowlist, не excluded) → тред у списку real-time, інжест через чергу з дедупом | ✅ | Перевірено e2e (DoD-тест) + вживу (webhook → BullMQ ingest → WS broadcast); дедуп на 2 рівнях — jobId (chatId+tgMessageId) і DB `@@unique` бекстоп, обидва покриті тестами |
| 4 | Відповідь агента → Telegram reply у той самий тред | ✅ | Перевірено вживу: reply створює out-message, outbound черга шле в Telegram із `reply_to_message_id` |
| 5 | Пріоритет, лейбли, статус, призначення й перепризначення | ✅ | `TicketPriority`, `TicketLabel`, `PATCH /tickets/:id`, `POST /tickets/:id/assign`, `/claim` — усе на фронті (InboxPage) |
| 6 | Нотифікації: in-app + Telegram DM агенту (браузерні опційно) | ✅ | `NotificationsService` шле DM через `TelegramOutboundProducer` при першому створенні (не при дедуп-рефреші); in-app — `NotificationsPage.tsx` + WS |
| 7 | Внутрішні коментарі з @згадками | ✅ | `comments.service.ts`, `create-comment.dto.ts`, mention-нотифікації в `notification-events.listener.ts` |
| 8 | Групи чатів + директорія чатів із фільтрами | ✅ | `ChatsDirectoryPage.tsx` (пошук/фільтри) + `GET /chats`, `/chat-groups` |
| 9 | Аналітика по чатах за період + зведення | ✅ | `AnalyticsPage.tsx` — KPI картки + таблиця по чатах, `GET /analytics/{overview,chats}` |
| 10 | Ручне закриття; нове повідомлення після закриття → новий тікет | ✅ | Правило 3 (§4) — окремо покрито e2e-тестом `section 4, rule 3` |
| 11 | Ручне звʼязування з Jira (ввід ключа) + посилання в картці тікета | ⚠️ | Бекенд повний: `jiraKey` у схемі, `PATCH /tickets/:id { jira_key }`. **Фронт: поля вводу/посилання в картці тікета немає** — `jiraKey` є лише в `types/domain.ts`, жоден компонент його не рендерить |
| 12 | Три-панельний inbox + директорія чатів + аналітика; світла/темна теми | ✅ | `InboxPage.tsx` (список/розмова/деталі), `data-theme` + `prefers-color-scheme` у `index.css` |
| 13 | Екран «Виключені відправники» — CRUD, is_active, кнопка «Позначити як не клієнт» | ⚠️ | Бекенд повний і перевірений e2e: `ExcludedSendersModule` (CRUD, is_active), `POST /tickets/:id/mark-not-customer` (покрито тестом `section 8a`). **Фронт: сторінки/екрана немає взагалі** — нуль згадок "excluded" у `crm-frontendFF/src` |

## Підсумок

11 із 13 пунктів — повністю готові й перевірені (юніт + e2e + живий прогін проти
реального Postgres/Redis, не моки). 2 пункти (§16 Jira-звʼязування, §8a екран
"Виключені відправники") мають повний і перевірений бекенд, але без фронтенд-UI —
за цю сесію фронтенд свідомо не чіпався на прохання користувача. Це єдине, що
відділяє поточний стан від 13/13.

## Що не входить у MVP і не блокує DoD (за самим ТЗ)

- Браузерні push-нотифікації — прямо позначені як "якщо встигається" (§16, п.6).

## Прод-готовність (виходить за межі §16, але суміжне)

- `app.enableShutdownHooks()` додано в `main.ts`/`worker.ts` — без цього SIGTERM
  (як Docker/k8s зупиняють контейнер) не викликає `onModuleDestroy`, і Redis/Prisma
  з'єднання просто обриваються замість плавного закриття.
- Спільний BullMQ Redis-конекшн раніше не закривався на shutdown (BullMQ не
  закриває "чужі" з'єднання) — виправлено, `RedisConnectionService` тепер сам
  відповідає за своє життя.
