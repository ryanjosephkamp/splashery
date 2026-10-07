// The draft loop-graph page (lane Site r2): the picture is an inline SVG that carries its own light
// and dark colors, so give it the site's theme choice (the theme button sets data-theme on <html>;
// without it the picture follows the device by itself).

const svg = document.querySelector("svg.grooph-picture");
const root = document.documentElement;
function sync() {
  if (!svg) return;
  if (root.dataset.theme) svg.dataset.theme = root.dataset.theme;
  else delete svg.dataset.theme;
}
sync();
new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
