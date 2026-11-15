import "server-only";
import { db } from "@/lib/db";
import { collectExport } from "./core";

export { EXPORT_VERSION, serializeExport } from "./core";

/** Everything the platform holds about the signed-in learner. Always scoped by the caller's own id. */
export const buildUserExport = (userId: string) => collectExport(db, userId, "SELF_SERVICE");
export { collectExport };
