import { redirect } from "next/navigation";

// The projects list now lives on the dashboard (the Home tab), which shows the
// business overview above the same project list. Keep this path working for old
// links/bookmarks by sending it there.
export default function ProjectsPage() {
  redirect("/dashboard");
}
