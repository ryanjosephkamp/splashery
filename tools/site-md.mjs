// A small Markdown-to-HTML converter for the preview site (lane Site pages). It
// reads the repo's own docs (CREDITS.md, LICENSES.md, docs/NOTEBOOK.md), so the
// pages built from them never go stale. It handles what those files use:
// headings, paragraphs, bullet and numbered lists (nested), tables, fenced code,
// block quotes, and inline code, bold, italic and links. Text is escaped first,
// so nothing in a file can become markup.

import path from "node:path";

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const mdSlug = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";

// The text of a Markdown span with its syntax removed (for tests and search).
export function mdPlain(s) {
  return String(s)
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[\s(])[_*]([^_*]+)[_*](?=[\s).,;:]|$)/g, "$1$2")
    .replace(/\\\|/g, "|")
    .replace(/\s+/g, " ")
    .trim();
}

// opts: github (repo URL), baseDir (the file's folder in the repo, "" for the root),
// demote (0 or 1: how many levels to push headings down), idPrefix, ids (a Set shared
// by every file on one page so heading ids stay unique).
export function mdToHtml(text, opts = {}) {
  const { github = "", baseDir = "", demote = 0, idPrefix = "", ids = new Set() } = opts;
  const headings = [];

  const repoLink = (url) => {
    if (/^(https?:|mailto:|#)/.test(url)) return url;
    const [file, hash] = url.split("#");
    const rel = path.posix.normalize(path.posix.join(baseDir, file.replace(/^\.\//, "")));
    const kind = /\.[A-Za-z0-9]+$/.test(rel) ? "blob" : "tree";
    return `${github}/${kind}/main/${rel}${hash ? `#${hash}` : ""}`;
  };

  function inline(raw) {
    const codes = [];
    let s = String(raw).replace(/`([^`]+)`/g, (_, c) => {
      codes.push(`<code>${esc(c)}</code>`);
      return `\u0000${codes.length - 1}\u0000`;
    });
    s = esc(s.replace(/\\\|/g, "|"));
    // [text](url), one level of parentheses allowed in the url
    s = s.replace(
      /\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)(?:\s+&quot;[^&]*&quot;)?\)/g,
      (_, t, u) => {
        const url = u.replace(/&amp;/g, "&");
        return `<a href="${esc(repoLink(url))}">${t}</a>`;
      },
    );
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[\s(>])[_*]([^_*<]+)[_*](?=[\s).,;:<]|$)/g, "$1<em>$2</em>");
    // Bare web addresses (not already inside a link).
    s = s.replace(
      /(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:])/g,
      (_, a, u) => `${a}<a href="${u}">${u}</a>`,
    );
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
  }

  const isFence = (l) => /^\s*```/.test(l);
  const isHeading = (l) => /^#{1,6}\s+\S/.test(l);
  const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
  const isSep = (l) => /^\s*\|[\s:|-]+\|\s*$/.test(l) && l.includes("-");
  const listMarker = (l) => /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(l);
  const isBlockStart = (l) => isFence(l) || isHeading(l) || isTableRow(l) || listMarker(l) || /^\s*>/.test(l) || /^\s*---+\s*$/.test(l); // prettier-ignore

  const splitRow = (l) =>
    l
      .trim()
      .replace(/\\\|/g, "\u0001")
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim().replace(/\u0001/g, "\\|"));

  function blocks(lines) {
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        i++;
        continue;
      }
      if (/^\s*<!--/.test(line)) {
        while (i < lines.length && !/-->/.test(lines[i])) i++;
        i++;
        continue;
      }
      if (isFence(line)) {
        const body = [];
        i++;
        while (i < lines.length && !isFence(lines[i])) body.push(lines[i++]);
        i++;
        const pre = `<pre><code>${esc(body.join("\n"))}</code></pre>`;
        out.push(body.length > 14 ? `<details class="long-text"><summary>Show the full text (${body.length} lines)</summary>${pre}</details>` : pre); // prettier-ignore
        continue;
      }
      const h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) {
        i++;
        const level = Math.min(6, h[1].length + demote);
        const plain = mdPlain(h[2]);
        // The page has its own h1, so the file's title is dropped.
        if (h[1].length === 1) continue;
        let id = idPrefix + mdSlug(plain);
        for (let n = 2; ids.has(id); n++) id = `${idPrefix}${mdSlug(plain)}-${n}`;
        ids.add(id);
        headings.push({ level, id, text: plain });
        out.push(`<h${level} id="${id}">${inline(h[2])}</h${level}>`);
        continue;
      }
      if (/^\s*---+\s*$/.test(line)) {
        i++;
        continue;
      }
      if (isTableRow(line) && i + 1 < lines.length && isSep(lines[i + 1])) {
        const head = splitRow(line);
        i += 2;
        const rows = [];
        while (i < lines.length && isTableRow(lines[i])) rows.push(splitRow(lines[i++]));
        out.push(
          `<div class="table-wrap" tabindex="0" role="region" aria-label="Table, scrolls sideways"><table><thead><tr>${head.map((c) => `<th scope="col">${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, k) => (k === 0 ? `<th scope="row">${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join("")}</tr>`).join("")}</tbody></table></div>`, // prettier-ignore
        );
        continue;
      }
      if (/^\s*>/.test(line)) {
        const body = [];
        while (i < lines.length && /^\s*>/.test(lines[i]))
          body.push(lines[i++].replace(/^\s*>\s?/, ""));
        out.push(`<blockquote>${blocks(body).join("")}</blockquote>`);
        continue;
      }
      const m = listMarker(line);
      if (m) {
        const base = m[1].length;
        const ordered = /\d/.test(m[2]);
        const items = [];
        while (i < lines.length) {
          const mm = listMarker(lines[i]);
          if (!mm || mm[1].length !== base) break;
          const body = [mm[3]];
          i++;
          while (i < lines.length) {
            const l = lines[i];
            if (!l.trim()) {
              // A blank line ends the item unless an indented line follows.
              if (
                i + 1 < lines.length &&
                /^\s{2,}\S/.test(lines[i + 1]) &&
                lines[i + 1].search(/\S/) > base
              ) {
                body.push("");
                i++;
                continue;
              }
              break;
            }
            const ind = l.search(/\S/);
            if (ind > base) {
              body.push(l.slice(Math.min(ind, base + 2)));
              i++;
            } else if (!isBlockStart(l)) {
              body.push(l.trim()); // a lazy continuation line
              i++;
            } else break;
          }
          const inner = blocks(body);
          items.push(`<li>${inner.length === 1 && inner[0].startsWith("<p>") ? inner[0].slice(3, -4) : inner.join("")}</li>`); // prettier-ignore
        }
        out.push(`<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`);
        continue;
      }
      const para = [];
      while (i < lines.length && lines[i].trim() && !(para.length && isBlockStart(lines[i]))) para.push(lines[i++].trim()); // prettier-ignore
      out.push(`<p>${inline(para.join(" "))}</p>`);
    }
    return out;
  }

  const html = blocks(String(text).replace(/\r\n/g, "\n").split("\n")).join("\n");
  return { html, headings };
}
