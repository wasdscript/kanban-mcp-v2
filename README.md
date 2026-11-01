# Kanban MCP

Форк проекта [bradrisse/kanban-mcp](https://github.com/bradrisse/kanban-mcp) (автор — Brad Risse) с поддержкой **Planka v2**.

Kanban MCP — мост между [Planka](https://planka.app/) (open-source канбан-доска) и MCP-клиентами, такими как Claude Desktop или [Cursor](https://cursor.sh/). Он позволяет ИИ-ассистенту:

- просматривать проекты, доски, списки и карточки и управлять ими
- создавать и обновлять задачи
- добавлять комментарии к карточкам
- перемещать карточки между списками
- ставить и снимать метки
- вести учёт времени секундомером

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

## Лицензия

Проект распространяется под лицензией MIT. Подробности см. в файле [LICENSE](LICENSE).
