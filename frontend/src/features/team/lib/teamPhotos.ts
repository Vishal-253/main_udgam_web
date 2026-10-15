// Member photos live in ../assets/team-photos, named by member id (e.g. sumit-prasad.webp).
// Only files that exist are bundled, so members without a photo keep the silhouette.
const files = import.meta.glob<string>("../assets/team-photos/*.{webp,jpg,jpeg,png,avif}", {
  eager: true,
  query: "?url",
  import: "default",
});

const photos: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [
    path
      .split("/")
      .pop()!
      .replace(/\.[^.]+$/, "")
      .toLowerCase(),
    url,
  ]),
);

export const teamPhotoFor = (id: string | undefined): string | undefined =>
  id ? photos[id.toLowerCase()] : undefined;
