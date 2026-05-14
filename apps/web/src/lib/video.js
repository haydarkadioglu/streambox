export function titleFromFilename(name) {
  return name
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function videoStats(videos) {
  return {
    total: videos.length,
    ready: videos.filter((video) => video.status === "ready").length,
    processing: videos.filter((video) => ["uploaded", "processing"].includes(video.status)).length,
    failed: videos.filter((video) => video.status === "failed").length,
  };
}

export function filterVideos(videos, search) {
  const needle = search.trim().toLowerCase();
  if (!needle) return videos;
  return videos.filter((video) =>
    [video.title, video.original_filename, video.status].some((value) =>
      String(value || "").toLowerCase().includes(needle),
    ),
  );
}

