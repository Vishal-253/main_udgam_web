import { createFileRoute } from "@tanstack/react-router";
import MerchApp from "@/features/merch/MerchApp";
import merchCss from "@/features/merch/merch.css?url";

export const Route = createFileRoute("/merch")({
  // The store keeps its cart in localStorage and reads window size/hash, so render it client-side only.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Merch — Udgam 2K26" },
      {
        name: "description",
        content:
          "Official Udgam 2K26 merchandise: T-shirts, hoodies, quarter zips and the full fest collection.",
      },
      { property: "og:title", content: "Merch — Udgam 2K26" },
      { property: "og:description", content: "Chase the Bloom — official Udgam 2K26 merch store." },
    ],
    links: [
      { rel: "stylesheet", href: merchCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&display=swap",
      },
    ],
  }),
  component: MerchApp,
});
