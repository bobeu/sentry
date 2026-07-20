import { prisma } from "@/lib/prisma";

/** Max uploaded / fetched raw bytes before text extraction. */
export const MAX_KB_FILE_BYTES = 512 * 1024; // 512 KB
/** Max extracted plain text stored per source. */
export const MAX_KB_TEXT_CHARS = 120_000;
/** Max knowledge sources per group. */
export const MAX_KB_SOURCES = 10;
/** Chunk size for retrieval. */
const CHUNK_CHARS = 1200;
const CHUNK_OVERLAP = 150;
const FETCH_TIMEOUT_MS = 15_000;

const ALLOWED_FILE_EXT = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".html",
  ".htm",
]);

const ALLOWED_MIME = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "application/json",
  "application/octet-stream",
]);

export type KnowledgeHit = {
  sourceId: string;
  title: string;
  excerpt: string;
  score: number;
};

function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(raw: string) {
  return raw.replace(/\r\n/g, "\n").replace(/\t/g, " ").trim().slice(0, MAX_KB_TEXT_CHARS);
}

function chunkText(text: string): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= CHUNK_CHARS) return [clean];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + CHUNK_CHARS, clean.length);
    if (end < clean.length) {
      const soft = clean.lastIndexOf("\n", end);
      if (soft > start + CHUNK_CHARS * 0.5) end = soft;
      else {
        const space = clean.lastIndexOf(" ", end);
        if (space > start + CHUNK_CHARS * 0.5) end = space;
      }
    }
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }
  return chunks;
}

function tokenize(q: string) {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function scoreChunk(query: string, content: string) {
  const tokens = tokenize(query);
  if (tokens.length === 0) return 0;
  const hay = content.toLowerCase();
  let hits = 0;
  for (const t of tokens) {
    if (hay.includes(t)) hits += 1;
  }
  const coverage = hits / tokens.length;
  const density = hits / Math.max(1, Math.sqrt(content.length / 100));
  return coverage * 2 + density * 0.1;
}

async function fetchUrlText(url: string): Promise<{ title: string; text: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http(s) URLs are allowed");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "SentryBot/1.0 (+https://sentry-sigma-two.vercel.app)",
        Accept: "text/html,text/plain,application/json,*/*;q=0.8",
      },
    });
    if (!res.ok) {
      throw new Error(`Fetch failed (${res.status})`);
    }
    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_KB_FILE_BYTES) {
      throw new Error(
        `Remote content exceeds ${Math.round(MAX_KB_FILE_BYTES / 1024)}KB limit`,
      );
    }
    const raw = buf.toString("utf8");
    let text: string;
    if (contentType.includes("html") || /<\/?[a-z][\s\S]*>/i.test(raw.slice(0, 2000))) {
      text = stripHtml(raw);
    } else {
      text = normalizeText(raw);
    }
    text = normalizeText(text);
    if (text.length < 40) {
      throw new Error("Could not extract enough text from that URL");
    }
    const titleMatch = raw.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || parsed.hostname;
    return { title, text };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("URL fetch timed out");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function replaceChunks(groupId: string, sourceId: string, text: string) {
  await prisma.groupKnowledgeChunk.deleteMany({ where: { sourceId } });
  const pieces = chunkText(text);
  if (pieces.length === 0) return;
  await prisma.groupKnowledgeChunk.createMany({
    data: pieces.map((content, ordinal) => ({
      groupId,
      sourceId,
      ordinal,
      content,
    })),
  });
}

export class KnowledgeService {
  async list(groupId: string) {
    return prisma.groupKnowledgeSource.findMany({
      where: { groupId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        title: true,
        url: true,
        fileName: true,
        mimeType: true,
        byteSize: true,
        status: true,
        error: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { chunks: true } },
      },
    });
  }

  async count(groupId: string) {
    return prisma.groupKnowledgeSource.count({ where: { groupId } });
  }

  async assertCanAdd(groupId: string) {
    const count = await this.count(groupId);
    if (count >= MAX_KB_SOURCES) {
      throw new Error(`A group can have at most ${MAX_KB_SOURCES} knowledge sources`);
    }
  }

  async addUrl(groupId: string, url: string, title?: string) {
    await this.assertCanAdd(groupId);
    const source = await prisma.groupKnowledgeSource.create({
      data: {
        groupId,
        type: "url",
        url: url.trim(),
        title: title?.trim() || null,
        status: "pending",
      },
    });

    try {
      const { title: fetchedTitle, text } = await fetchUrlText(url.trim());
      await prisma.groupKnowledgeSource.update({
        where: { id: source.id },
        data: {
          title: title?.trim() || fetchedTitle,
          contentText: text,
          byteSize: Buffer.byteLength(text, "utf8"),
          status: "ready",
          error: null,
        },
      });
      await replaceChunks(groupId, source.id, text);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ingest failed";
      await prisma.groupKnowledgeSource.update({
        where: { id: source.id },
        data: { status: "failed", error: message },
      });
      throw new Error(message);
    }

    return this.get(source.id);
  }

  async addFile(input: {
    groupId: string;
    fileName: string;
    mimeType?: string | null;
    bytes: Buffer;
    title?: string;
  }) {
    await this.assertCanAdd(input.groupId);

    if (input.bytes.byteLength === 0) {
      throw new Error("File is empty");
    }
    if (input.bytes.byteLength > MAX_KB_FILE_BYTES) {
      throw new Error(
        `File exceeds ${Math.round(MAX_KB_FILE_BYTES / 1024)}KB limit (got ${Math.round(input.bytes.byteLength / 1024)}KB)`,
      );
    }

    const ext = extOf(input.fileName);
    const mime = (input.mimeType ?? "").toLowerCase().split(";")[0].trim();
    if (!ALLOWED_FILE_EXT.has(ext) && mime && !ALLOWED_MIME.has(mime)) {
      throw new Error(
        "Unsupported file type. Use .txt, .md, .csv, .json, or .html (max 512KB).",
      );
    }

    const raw = input.bytes.toString("utf8");
    const text =
      ext === ".html" || ext === ".htm" || mime.includes("html")
        ? normalizeText(stripHtml(raw))
        : normalizeText(raw);

    if (text.length < 20) {
      throw new Error("Could not extract enough text from that file");
    }

    const source = await prisma.groupKnowledgeSource.create({
      data: {
        groupId: input.groupId,
        type: "file",
        title: input.title?.trim() || input.fileName,
        fileName: input.fileName,
        mimeType: mime || null,
        contentText: text,
        byteSize: input.bytes.byteLength,
        status: "ready",
      },
    });
    await replaceChunks(input.groupId, source.id, text);
    return this.get(source.id);
  }

  async get(id: string) {
    return prisma.groupKnowledgeSource.findUnique({
      where: { id },
      select: {
        id: true,
        groupId: true,
        type: true,
        title: true,
        url: true,
        fileName: true,
        mimeType: true,
        byteSize: true,
        status: true,
        error: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { chunks: true } },
      },
    });
  }

  async remove(groupId: string, sourceId: string) {
    const existing = await prisma.groupKnowledgeSource.findFirst({
      where: { id: sourceId, groupId },
    });
    if (!existing) throw new Error("Knowledge source not found");
    await prisma.groupKnowledgeSource.delete({ where: { id: sourceId } });
  }

  async refresh(groupId: string, sourceId: string) {
    const source = await prisma.groupKnowledgeSource.findFirst({
      where: { id: sourceId, groupId },
    });
    if (!source) throw new Error("Knowledge source not found");
    if (source.type !== "url" || !source.url) {
      throw new Error("Only URL sources can be refreshed");
    }

    await prisma.groupKnowledgeSource.update({
      where: { id: sourceId },
      data: { status: "pending", error: null },
    });

    try {
      const { title, text } = await fetchUrlText(source.url);
      await prisma.groupKnowledgeSource.update({
        where: { id: sourceId },
        data: {
          title: source.title || title,
          contentText: text,
          byteSize: Buffer.byteLength(text, "utf8"),
          status: "ready",
          error: null,
        },
      });
      await replaceChunks(groupId, sourceId, text);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Refresh failed";
      await prisma.groupKnowledgeSource.update({
        where: { id: sourceId },
        data: { status: "failed", error: message },
      });
      throw new Error(message);
    }

    return this.get(sourceId);
  }

  /**
   * Tool: search employer knowledge base for passages relevant to a question.
   */
  async search(groupId: string, query: string, limit = 6): Promise<KnowledgeHit[]> {
    const chunks = await prisma.groupKnowledgeChunk.findMany({
      where: { groupId, source: { status: "ready" } },
      include: {
        source: { select: { id: true, title: true, url: true, fileName: true } },
      },
      take: 400,
    });

    if (chunks.length === 0) return [];

    const scored = chunks
      .map((c) => ({
        sourceId: c.sourceId,
        title: c.source.title || c.source.fileName || c.source.url || "Knowledge",
        excerpt: c.content,
        score: scoreChunk(query, c.content),
      }))
      .filter((h) => h.score > 0.15)
      .sort((a, b) => b.score - a.score);

    const out: KnowledgeHit[] = [];
    const seen = new Set<string>();
    for (const hit of scored) {
      const key = hit.excerpt.slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(hit);
      if (out.length >= limit) break;
    }
    return out;
  }

  async hasReadySources(groupId: string) {
    const n = await prisma.groupKnowledgeSource.count({
      where: { groupId, status: "ready" },
    });
    return n > 0;
  }

  formatHitsForPrompt(hits: KnowledgeHit[]) {
    if (hits.length === 0) return "(no knowledge-base hits)";
    return hits
      .map(
        (h, i) =>
          `[KB${i + 1} | ${h.title} | score=${h.score.toFixed(2)}]\n${h.excerpt}`,
      )
      .join("\n\n");
  }
}

export const knowledgeService = new KnowledgeService();
