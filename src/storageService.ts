import { promises as fs } from "node:fs";
import path from "node:path";
import { SentAd, StorageData } from "./types.js";
import { logger } from "./logger.js";

const storagePath = path.resolve("data", "sent-ads.json");

async function ensureStorageFile() {
  await fs.mkdir(path.dirname(storagePath), { recursive: true });

  try {
    await fs.access(storagePath);
  } catch {
    await fs.writeFile(storagePath, "[]\n", "utf-8");
  }
}

export async function loadSentAds(): Promise<Map<string, SentAd>> {
  await ensureStorageFile();

  try {
    const raw = await fs.readFile(storagePath, "utf-8");
    const parsed = JSON.parse(raw) as StorageData;
    return new Map(parsed.map((item) => [item.id, item]));
  } catch (error) {
    logger.error("Nao foi possivel ler data/sent-ads.json. Usando historico vazio nesta execucao.", error);
    return new Map();
  }
}

export async function saveSentAds(sentAds: Map<string, SentAd>) {
  await ensureStorageFile();
  const data = [...sentAds.values()].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  await fs.writeFile(storagePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

export function markAsSent(sentAds: Map<string, SentAd>, id: string, url: string) {
  sentAds.set(id, {
    id,
    url,
    sentAt: new Date().toISOString()
  });
}
