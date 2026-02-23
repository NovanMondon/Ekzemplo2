import { main } from "./main.js";

try {
  await main();
} catch (e) {
  const message = e instanceof Error ? (e.message || e.toString()) : String(e);
  console.error(`parse: failed\n${message}`);
  process.exitCode = 1;
}
