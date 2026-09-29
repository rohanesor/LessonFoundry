"use client";

import { use } from "react";
import { Studio } from "@/components/studio/studio";

/** Route-bound Studio avoids a stale localStorage pack selection. */
export default function PackStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Studio initialPackId={id} />;
}
