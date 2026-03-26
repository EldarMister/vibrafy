import "dotenv/config";
import { ensureSchema } from "./db/schema.js";
import { createApp } from "./app.js";

const PORT = Number(process.env.PORT || 3001);
const HOST = "0.0.0.0";

async function start() {
  await ensureSchema();
  const app = createApp();

  app.listen(PORT, HOST, () => {
    console.log(`Backend listening on http://${HOST}:${PORT}`);
  });
}

start().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
