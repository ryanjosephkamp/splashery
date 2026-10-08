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

// The player's own "Open in Splashery" link opens the app in a new tab, so the toy page
// (and a toy being customized) stays where it was. The player is the same origin.
for (const f of document.querySelectorAll(".toy-stage iframe")) {
  const fix = () => {
    try {
      const a = f.contentDocument?.getElementById("open-link");
      if (a) {
        a.target = "_blank";
        a.rel = "noopener";
      }
    } catch {
      // A player from another origin keeps its link as it is.
    }
  };
  f.addEventListener("load", fix);
  fix();
}
