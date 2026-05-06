"use server";

import { requireClient } from "@/lib/auth";

export async function notifyAdminOnSubmit(_requestId: string) {
  await requireClient();
}
