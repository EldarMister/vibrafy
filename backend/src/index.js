import "dotenv/config";
import { ensureSchema } from "./db/schema.js";
import { createApp } from "./app.js";

const PORT = Number(process.env.PORT || 3001);

async function start() {
  await ensureSchema();
  const app = createApp();

  app.listen(PORT, () => {
    console.log(`Backend listening on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
