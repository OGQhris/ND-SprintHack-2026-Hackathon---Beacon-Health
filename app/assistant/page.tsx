import { redirect } from "next/navigation";

// The assistant now lives at /ask (Ask Beacon). Keep the old link from the README working.
export default function AssistantPage() {
  redirect("/ask");
}
