# Telegram Music Mini App

Музыкальный Telegram Mini App с PostgreSQL, парсером Sefon.pro, пользовательским поиском и базовой admin-панелью.

## Структура

```text
music/
  backend/   API + PostgreSQL + парсер Sefon.pro
  frontend/  React Mini App + admin panel
```

## Что реализовано

- `GET /search?q=...` ищет треки в PostgreSQL
- Если в базе пусто, backend может импортировать результаты из Sefon.pro по настройкам парсера
- Треки, пользователи, лимиты парсера и история запусков хранятся в PostgreSQL
- Admin API для CRUD треков, статистики, включения/выключения парсера и ручного запуска импорта
- React UI для обычного пользователя и отдельный `/admin` экран
- Базовая интеграция с Telegram Web Apps API

## Запуск

1. Установить зависимости:

```bash
npm install
```

2. Создать PostgreSQL базу, например:

```sql
CREATE DATABASE telegram_music;
```

3. Скопировать пример env:

```bash
copy backend\\.env.example backend\\.env
copy frontend\\.env.example frontend\\.env
```

4. Запустить backend:

```bash
npm run dev:backend
```

При старте backend сам создаст нужные таблицы.

5. В отдельном терминале запустить frontend:

```bash
npm run dev:frontend
```

6. Открыть:

- пользовательский экран: `http://localhost:5173`
- admin-панель: `http://localhost:5173/admin`

## Railway

Для текущего проекта на Railway нужны 3 сервиса:

1. `PostgreSQL`
2. `backend`
3. `frontend`

### Backend service

- Start command: `npm run start --workspace backend`
- Переменные:
  - `DATABASE_URL` = подключить переменную из Railway Postgres
  - `ADMIN_KEY` = ваш секрет для админки
  - `PORT` = Railway выставит сам

### Frontend service

- Build command: `npm run build --workspace frontend`
- Start command: `npm run start --workspace frontend`
- Переменные:
  - `VITE_API_BASE_URL=https://<ваш-backend-domain>`

### PostgreSQL service

- Добавить PostgreSQL в этот же Railway project
- Railway прокинет `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`

## Переменные окружения

`backend/.env`

```bash
PORT=3001
CACHE_TTL_MS=300000
SEFON_BASE_URL=https://sefon.pro
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/telegram_music
ADMIN_KEY=changeme
```

`frontend/.env`

```bash
VITE_API_BASE_URL=
```

Если `VITE_API_BASE_URL` пустой, в dev-режиме запросы `/search` проксируются на локальный backend.

## Важно

- Парсер зависит от внешней HTML-структуры Sefon.pro.
- Admin endpoints защищены заголовком `x-admin-key`.
- Счетчик пользователей строится по факту открытия Mini App и отправки данных пользователя с клиента.
- Поле `cover` может быть `null`, если источник не отдает устойчивую обложку.
