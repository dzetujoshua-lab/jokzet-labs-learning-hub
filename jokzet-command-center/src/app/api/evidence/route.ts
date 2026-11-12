import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import { MAX_BYTES } from "@/lib/evidence/files";
import { createEvidence } from "@/lib/evidence/service";
import { isSameOrigin, json } from "@/lib/http";

const MAX_REQUEST_BYTES = MAX_BYTES.VIDEO + 1024 * 1024; // the largest file type plus form fields

/** Creates an evidence entry (multipart: fields + optional `file`). Owner-only, same-origin, size-capped. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: "Forbidden" }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_REQUEST_BYTES) return json({ error: "That upload is too large." }, 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "The upload could not be read." }, 400);
  }

  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  const file = form.get("file");
  let upload: { name: string; data: Buffer } | undefined;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_REQUEST_BYTES) return json({ error: "That file is too large." }, 413);
    upload = { name: file.name, data: Buffer.from(await file.arrayBuffer()) };
  }

  const result = await createEvidence(
    user.id,
    {
      title: text("title"), departmentCode: text("departmentCode"), kind: text("kind") as never, description: text("description"),
      linkUrl: text("linkUrl"), capturedDate: text("capturedDate"), missionCode: text("missionCode") || undefined,
    },
    upload,
    text("attachToLearnerMissionId") || undefined,
  );
  if (!result.ok) return json({ error: result.error }, 400);
  revalidatePath("/", "layout");
  return json({ ok: true, id: result.id }, 201);
}
