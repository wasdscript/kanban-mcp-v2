# Kanban MCP

Форк проекта [bradrisse/kanban-mcp](https://github.com/bradrisse/kanban-mcp) (автор — Brad Risse) с поддержкой **Planka v2**.

Kanban MCP — мост между [Planka](https://planka.app/) (open-source канбан-доска) и MCP-клиентами, такими как Claude Desktop или [Cursor](https://cursor.sh/). Он позволяет ИИ-ассистенту:

- просматривать проекты, доски, списки и карточки и управлять ими
- создавать и обновлять задачи
- добавлять комментарии к карточкам
- перемещать карточки между списками
- ставить и снимать метки
- вести учёт времени секундомером
- назначать исполнителей на карточки
- работать со списками задач карточки (в Planka v2 их может быть несколько)
- сортировать карточки в списке, переносить карточки в архив, очищать корзину
- прикреплять к карточкам ссылки и файлы

## Установка

### Требования

- [Docker](https://www.docker.com/get-started) для запуска Planka (если нет своей)
- [Git](https://git-scm.com/downloads)
- [Node.js](https://nodejs.org/) версии 18 или выше и npm

### Шаги

1. Клонируйте репозиторий:
```bash
git clone https://github.com/wasdscript/kanban-mcp-v2.git
cd kanban-mcp-v2
```

2. Установите зависимости и соберите проект:
```bash
npm install
npm run build
```

3. Запустите Planka (пропустите, если используете свою):
```bash
npm run up
```
   - Адрес по умолчанию: http://localhost:3333
   - Данные для входа по умолчанию: `demo@demo.demo` / `demo`

4. Подключите MCP-сервер к клиенту (Claude Desktop или Cursor). Пример конфигурации:
```json
{
  "mcpServers": {
    "kanban": {
      "command": "node",
      "args": ["/path/to/kanban-mcp-v2/dist/index.js"],
      "env": {
        "PLANKA_BASE_URL": "http://localhost:3333",
        "PLANKA_AGENT_EMAIL": "demo@demo.demo",
        "PLANKA_AGENT_PASSWORD": "demo"
      }
    }
  }
}
```
   - Замените `/path/to/kanban-mcp-v2` на абсолютный путь к папке проекта (в Windows используйте обычные косые `/` или двойные обратные `\\`).
   - Для Claude Desktop блок добавляется в `claude_desktop_config.json`, для Cursor — в Settings > Features > MCP или в файл `.cursor/mcp.json` в корне проекта.
   - Для своей Planka укажите её адрес в `PLANKA_BASE_URL`, а в `PLANKA_AGENT_EMAIL` и `PLANKA_AGENT_PASSWORD` — учётную запись агента. Агент должен принять условия использования и быть участником нужной доски с ролью «редактор».

5. Перезапустите клиент. Claude Desktop нужно полностью закрыть через значок в трее и открыть снова.

После изменения кода выполните `npm run build` и снова перезапустите клиент.

Подробнее об установке, использовании и решении проблем — в [wiki оригинального проекта](https://github.com/bradrisse/kanban-mcp/wiki).

## Возможности Planka v2

Помимо исходных инструментов, в форке добавлены:

| Инструмент | Действия |
|---|---|
| `mcp_kanban_card_membership_manager` | `get_all` (кто назначен на карточку), `add`, `remove`, `get_board_users` (кого можно назначить) |
| `mcp_kanban_task_list_manager` | `get_all`, `get_one`, `create`, `update`, `delete` для списков задач карточки |
| `mcp_kanban_list_manager` | новые действия `sort` (сортировка карточек по `name`, `dueDate` или `createdAt`), `move_cards` (все карточки закрытого списка в архив), `clear` (удалить все карточки из корзины); при `create` можно указать `type`: `active` или `closed` |
| `mcp_kanban_task_manager` | в `create` можно указать `taskListId`; по умолчанию задача попадает в первый список задач карточки |
| `mcp_kanban_attachment_manager` | `get_all`, `add_link`, `upload`, `download`, `update` (переименовать), `delete`, `get_folder` |

### Вложения и папка для файлов

Чтобы ассистент не мог читать и записывать файлы в произвольных местах диска, загрузка и скачивание вложений работают только в одной папке. По умолчанию это `~/kanban-mcp-attachments` (в Windows `C:\Users\ВАШ_ПОЛЬЗОВАТЕЛЬ\kanban-mcp-attachments`). Другую папку можно задать переменной окружения `PLANKA_ATTACHMENTS_DIR` в блоке `env` конфигурации. Пути вне этой папки отклоняются.

### Проверка без клиента

Скрипт `tests/v2-smoke.mjs` запускает собранный сервер и проверяет все новые инструменты на живой Planka. Он создаёт и удаляет на доске свои списки, карточки и вложения, поэтому используйте для него только тестовую доску:

```bash
node tests/v2-smoke.mjs ID_ТЕСТОВОЙ_ДОСКИ
```

Учётные данные берутся из `claude_desktop_config.json` либо из переменных окружения `PLANKA_BASE_URL`, `PLANKA_AGENT_EMAIL`, `PLANKA_AGENT_PASSWORD`.

## Изменения относительно оригинала

Совместимость с Planka v2:
- проекты: поле `background` может отсутствовать;
- списки: при создании передаётся `type`, служебные списки (архив, корзина) без имени и позиции не ломают код;
- карточки: при создании передаётся `type`, пустое описание не отправляется, позиция может быть пустой (карточки в архиве и корзине);
- комментарии: адрес `/comments` вместо `/comment-actions`;
- метки на карточке: адрес `/card-labels`;
- задачи: создаются в списках задач (`task-lists`);
- членства доски: получение и создание через новые адреса v2, поиск по id;
- `get_board_summary`, `get_details`: исправлены падения и показ только меток карточки.

Новое: исполнители карточки, списки задач, сортировка и очистка списков, перенос карточек в архив, вложения (см. выше).

## Лицензия

Проект распространяется под лицензией MIT. Подробности см. в файле [LICENSE](LICENSE).
