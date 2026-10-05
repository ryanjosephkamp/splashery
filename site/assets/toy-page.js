// A toy's page (lane Toy pages): the Copy buttons for the link and the embed
// snippets, and a labs toy's player, which starts only with the labs switch on.

for (const b of document.querySelectorAll("button[data-copy]")) {
  b.addEventListener("click", async () => {
    const box = document.getElementById(b.dataset.copy);
    const label = b.querySelector("span");
    let ok = false;
    try {
      await navigator.clipboard.writeText(box.value);
      ok = true;
    } catch {
      box.focus();
      box.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
    }
    label.textContent = ok ? "Copied" : "Select and copy";
    setTimeout(() => (label.textContent = "Copy"), 2000);
  });
}

if (document.documentElement.classList.contains("labs")) {
  for (const f of document.querySelectorAll("iframe[data-src]")) f.src = f.dataset.src;
}
