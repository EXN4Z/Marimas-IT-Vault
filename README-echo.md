Front-end Echo/Pusher setup

1. Copy `.env.example` to `.env` and set `VITE_PUSHER_KEY` and `VITE_PUSHER_CLUSTER`.

2. Install deps (if needed):

```bash
npm install
```

3. Run dev server:

```bash
npm run dev
```

4. If dev server already running, stop it and run `npm run dev` again so Vite picks up new env variables.

If you use a backend broadcasting driver, ensure backend has matching `PUSHER_APP_KEY` and proper `BROADCAST_CONNECTION`.
