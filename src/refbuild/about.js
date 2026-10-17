// Optional About galleries. Only repository-local image paths are accepted.
export function aboutGallery(entries, document = globalThis.document) {
  const blocks = [];
  for (const entry of entries) {
    const section = document.createElement("section");
    section.className = "reference-gallery";
    const title = document.createElement("h4");
    title.textContent = entry.label;
    const caption = document.createElement("p");
    caption.textContent = entry.caption || "";
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: "6px",
    });
    for (const image of entry.images || []) {
      if (
        !/^(?:assets|tools\/refpack-samples)\/[a-zA-Z0-9_./-]+\.(?:png|jpg|webp)$/.test(
          image.src,
        ) ||
        image.src.split("/").includes("..")
      )
        continue;
      const img = document.createElement("img");
      img.src = image.src;
      img.alt = image.alt;
      img.loading = "lazy";
      img.width = 256;
      img.height = 256;
      Object.assign(img.style, { width: "100%", height: "auto", borderRadius: "6px" });
      row.append(img);
    }
    section.append(title, caption, row);
    blocks.push(section);
  }
  return blocks;
}
