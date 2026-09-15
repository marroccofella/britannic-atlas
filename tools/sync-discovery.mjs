import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "public", "discovery");
const destination = resolve(root, "oracle", "public", "discovery");
const files = ["catalog.json", "connections.mjs", "model.mjs", "explorer.mjs", "explorer.css", "question-policy.mjs"];

await mkdir(destination, { recursive: true });
await Promise.all(files.map((file) => copyFile(resolve(source, file), resolve(destination, file))));
console.log(`Synchronised ${files.length} discovery assets for the local Oracle.`);
