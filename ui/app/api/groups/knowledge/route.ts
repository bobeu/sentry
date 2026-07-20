import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { groupService } from "@/services/group.service";
import {
  knowledgeService,
  MAX_KB_FILE_BYTES,
} from "@/services/knowledge.service";
import { z } from "zod";

const urlSchema = z.object({
  groupId: z.string().min(1),
  url: z.string().url(),
  title: z.string().max(200).optional(),
});

const deleteSchema = z.object({
  groupId: z.string().min(1),
  sourceId: z.string().min(1),
});

const refreshSchema = z.object({
  groupId: z.string().min(1),
  sourceId: z.string().min(1),
  action: z.literal("refresh"),
});

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser();
    const groupId = new URL(request.url).searchParams.get("groupId");
    if (!groupId) {
      return NextResponse.json({ error: "groupId required" }, { status: 400 });
    }
    await groupService.getForUser(user.id, groupId);
    const sources = await knowledgeService.list(groupId);
    return NextResponse.json({
      sources,
      limits: {
        maxSources: 10,
        maxFileBytes: MAX_KB_FILE_BYTES,
        allowedTypes: [".txt", ".md", ".csv", ".json", ".html"],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "List failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const groupId = String(form.get("groupId") ?? "");
      const title = form.get("title") ? String(form.get("title")) : undefined;
      const file = form.get("file");
      if (!groupId || !(file instanceof File)) {
        return NextResponse.json(
          { error: "groupId and file are required" },
          { status: 400 },
        );
      }
      await groupService.getForUser(user.id, groupId);
      if (file.size > MAX_KB_FILE_BYTES) {
        return NextResponse.json(
          {
            error: `File exceeds ${Math.round(MAX_KB_FILE_BYTES / 1024)}KB limit`,
          },
          { status: 400 },
        );
      }
      const bytes = Buffer.from(await file.arrayBuffer());
      const source = await knowledgeService.addFile({
        groupId,
        fileName: file.name || "upload.txt",
        mimeType: file.type,
        bytes,
        title,
      });
      return NextResponse.json({ source });
    }

    const json = await request.json();
    if (json?.action === "refresh") {
      const { groupId, sourceId } = refreshSchema.parse(json);
      await groupService.getForUser(user.id, groupId);
      const source = await knowledgeService.refresh(groupId, sourceId);
      return NextResponse.json({ source });
    }

    const { groupId, url, title } = urlSchema.parse(json);
    await groupService.getForUser(user.id, groupId);
    const source = await knowledgeService.addUrl(groupId, url, title);
    return NextResponse.json({ source });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Create failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireSessionUser();
    const json = await request.json();
    const { groupId, sourceId } = deleteSchema.parse(json);
    await groupService.getForUser(user.id, groupId);
    await knowledgeService.remove(groupId, sourceId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
