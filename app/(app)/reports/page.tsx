import { redirect } from "next/navigation";

// Reports merged into the dashboard (same data, plus Export CSV). Keep old links working.
export default function ReportsPage() {
  redirect("/dashboard");
}
