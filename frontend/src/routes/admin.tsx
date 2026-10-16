import { createFileRoute } from "@tanstack/react-router";
import AdminPage from "@/features/admin/AdminPage";
import adminCss from "@/features/admin/admin.css?url";

export const Route = createFileRoute("/admin")({
  // everything here is behind a login and loaded through authenticated server functions
  ssr: false,
  head: () => ({
    meta: [{ title: "Admin — Udgam 2K26" }, { name: "robots", content: "noindex, nofollow" }],
    links: [{ rel: "stylesheet", href: adminCss }],
  }),
  component: () => (
    <div className="udgam-admin">
      <AdminPage />
    </div>
  ),
});
