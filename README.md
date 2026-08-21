# Descon Frontend

The repository contains the React Router web application and the Expo mobile application.

## Web development

```bash
cp web/.env.example web/.env
docker compose up --build
```

Open `http://localhost:4000`. The admin prototype is available at `http://localhost:4000/admin`.

With the Rails API running on port 3000, verify the connection at `http://localhost:4000/api/health`.

To run without Docker:

```bash
cd web
cp .env.example .env
npm ci
npm run dev
```

## Mobile development

```bash
cd mobile
npm ci
npx expo start
```

Use the host machine's LAN IP, rather than `localhost`, for the mobile API URL when running on a physical device.
