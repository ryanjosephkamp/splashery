// Chess rules for the chess set: positions, legal moves, SAN and PGN.
//
// readPgn(text) reads the first game in a PGN file (or a pasted move list),
// checks every move against the rules and returns the plies the chess set
// plays: from and to squares, plus the rook for castling, the captured pawn
// for en passant and the new piece for a promotion.

const FILES = "abcdefgh";
export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
export const squareName = (i) => FILES[i & 7] + ((i >> 3) + 1);
export const squareIndex = (s) => FILES.indexOf(s[0]) + 8 * (Number(s[1]) - 1);
const other = (side) => (side === "w" ? "b" : "w");

// A position: board[64] ("wP", "bK" or null; a1 = 0, h8 = 63), the side to
// move, the castling rights still open ("KQkq") and the en passant square.
export function parseFen(fen) {
  const [placement = "", turn = "w", castling = "-", ep = "-"] = String(fen).trim().split(/\s+/);
  const rows = placement.split("/");
  if (rows.length !== 8) throw new Error("The FEN position needs 8 ranks.");
  const board = new Array(64).fill(null);
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of rows[r]) {
      if (/[1-8]/.test(ch)) f += Number(ch);
      else if (/[prnbqk]/i.test(ch)) {
        if (f > 7) break;
        board[(7 - r) * 8 + f] = (ch === ch.toUpperCase() ? "w" : "b") + ch.toUpperCase();
        f++;
      } else throw new Error(`The FEN position has an unknown piece "${ch}".`);
    }
    if (f !== 8) throw new Error("A rank of the FEN position does not add up to 8 squares.");
  }
  for (const k of ["wK", "bK"])
    if (board.filter((p) => p === k).length !== 1)
      throw new Error("The FEN position needs exactly one king on each side.");
  if (turn !== "w" && turn !== "b") throw new Error("The FEN position has no side to move.");
  // Only rights whose king and rook still stand on their squares count.
  const rights = [...(castling === "-" ? "" : castling)]
    .filter((c) => "KQkq".includes(c))
    .filter((c) => {
      const w = c === c.toUpperCase();
      const rank = w ? 0 : 56;
      const side = w ? "w" : "b";
      return board[rank + 4] === `${side}K` && board[rank + (c.toLowerCase() === "k" ? 7 : 0)] === `${side}R`; // prettier-ignore
    })
    .join("");
  const epSq = /^[a-h][36]$/.test(ep) ? squareIndex(ep) : null;
  return { board, turn, castling: rights, ep: epSq };
}

const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]; // prettier-ignore
const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]; // prettier-ignore
const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]]; // prettier-ignore
const BISHOP = [[1, 1], [1, -1], [-1, 1], [-1, -1]]; // prettier-ignore
const on = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;

// True when side `by` attacks square sq.
export function attacked(board, sq, by) {
  const f = sq & 7;
  const r = sq >> 3;
  const pr = by === "w" ? r - 1 : r + 1;
  for (const df of [-1, 1]) if (on(f + df, pr) && board[pr * 8 + f + df] === `${by}P`) return true;
  for (const [a, b] of KNIGHT) if (on(f + a, r + b) && board[(r + b) * 8 + f + a] === `${by}N`) return true; // prettier-ignore
  for (const [a, b] of KING) if (on(f + a, r + b) && board[(r + b) * 8 + f + a] === `${by}K`) return true; // prettier-ignore
  for (const [dirs, kinds] of [
    [ROOK, "RQ"],
    [BISHOP, "BQ"],
  ]) {
    for (const [a, b] of dirs) {
      let x = f + a;
      let y = r + b;
      while (on(x, y)) {
        const p = board[y * 8 + x];
        if (p) {
          if (p[0] === by && kinds.includes(p[1])) return true;
          break;
        }
        x += a;
        y += b;
      }
    }
  }
  return false;
}

export const inCheck = (pos, side = pos.turn) => attacked(pos.board, pos.board.indexOf(`${side}K`), other(side)); // prettier-ignore

// Every move the side to move could make, before checking its own king.
function pseudoMoves(pos) {
  const { board, turn } = pos;
  const out = [];
  for (let s = 0; s < 64; s++) {
    const p = board[s];
    if (!p || p[0] !== turn) continue;
    const f = s & 7;
    const r = s >> 3;
    const kind = p[1];
    const add = (to, extra = {}) => out.push({ from: s, to, piece: p, ...extra });
    if (kind === "P") {
      const d = turn === "w" ? 1 : -1;
      const last = turn === "w" ? 7 : 0;
      const home = turn === "w" ? 1 : 6;
      const step = (to, extra) => {
        if (to >> 3 === last) for (const q of "QRBN") add(to, { ...extra, promo: q });
        else add(to, extra);
      };
      const one = s + 8 * d;
      if (on(f, r + d) && !board[one]) {
        step(one, {});
        if (r === home && !board[one + 8 * d]) add(one + 8 * d, { double: true });
      }
      for (const df of [-1, 1]) {
        if (!on(f + df, r + d)) continue;
        const to = (r + d) * 8 + f + df;
        if (board[to] && board[to][0] !== turn) step(to, { capture: to });
        else if (pos.ep === to && !board[to]) add(to, { capture: r * 8 + f + df, ep: true });
      }
    } else if (kind === "N" || kind === "K") {
      for (const [a, b] of kind === "N" ? KNIGHT : KING) {
        if (!on(f + a, r + b)) continue;
        const to = (r + b) * 8 + f + a;
        if (board[to] && board[to][0] === turn) continue;
        add(to, board[to] ? { capture: to } : {});
      }
      if (kind === "K") {
        // Castling: the king and rook on their squares, the squares between
        // empty, and the king neither in, through nor into check.
        const rank = turn === "w" ? 0 : 56;
        const opp = other(turn);
        if (s === rank + 4 && !attacked(board, s, opp)) {
          if (pos.castling.includes(turn === "w" ? "K" : "k") &&
            board[rank + 7] === `${turn}R` && !board[rank + 5] && !board[rank + 6] &&
            !attacked(board, rank + 5, opp) && !attacked(board, rank + 6, opp))
            add(rank + 6, { castle: { from: rank + 7, to: rank + 5 } }); // prettier-ignore
          if (pos.castling.includes(turn === "w" ? "Q" : "q") &&
            board[rank] === `${turn}R` && !board[rank + 1] && !board[rank + 2] && !board[rank + 3] &&
            !attacked(board, rank + 3, opp) && !attacked(board, rank + 2, opp))
            add(rank + 2, { castle: { from: rank, to: rank + 3 } }); // prettier-ignore
        }
      }
    } else {
      const dirs = kind === "R" ? ROOK : kind === "B" ? BISHOP : [...ROOK, ...BISHOP];
      for (const [a, b] of dirs) {
        let x = f + a;
        let y = r + b;
        while (on(x, y)) {
          const to = y * 8 + x;
          if (board[to]) {
            if (board[to][0] !== turn) add(to, { capture: to });
            break;
          }
          add(to);
          x += a;
          y += b;
        }
      }
    }
  }
  return out;
}

// The position after a move (the move is assumed to be pseudo-legal).
export function applyMove(pos, m) {
  const board = pos.board.slice();
  if (m.capture !== undefined) board[m.capture] = null;
  board[m.to] = m.promo ? m.piece[0] + m.promo : m.piece;
  board[m.from] = null;
  if (m.castle) {
    board[m.castle.to] = board[m.castle.from];
    board[m.castle.from] = null;
  }
  let castling = pos.castling;
  const drop = (chars) => (castling = [...castling].filter((c) => !chars.includes(c)).join(""));
  if (m.piece[1] === "K") drop(m.piece[0] === "w" ? "KQ" : "kq");
  for (const sq of [m.from, m.to]) {
    if (sq === 0) drop("Q");
    if (sq === 7) drop("K");
    if (sq === 56) drop("q");
    if (sq === 63) drop("k");
  }
  const ep = m.double ? (m.from + m.to) / 2 : null;
  return { board, turn: other(pos.turn), castling, ep };
}

export function legalMoves(pos) {
  return pseudoMoves(pos).filter((m) => !inCheck(applyMove(pos, m), pos.turn));
}

// The move a SAN string names in this position ("Nbd7", "exd6", "O-O-O",
// "e8=Q+", "Qh4xe1#"), or an Error saying why not.
export function moveFromSan(pos, text) {
  const san = String(text)
    .replace(/e\.p\.?$/i, "")
    .replace(/[+#?!]+/g, "")
    .trim();
  const legal = legalMoves(pos);
  const castle = san.replace(/0/g, "O").toUpperCase();
  if (castle === "O-O" || castle === "O-O-O") {
    const file = castle === "O-O" ? 6 : 2;
    const m = legal.find((x) => x.castle && (x.to & 7) === file);
    if (!m) throw new Error(`castling ${castle === "O-O" ? "short" : "long"} is not allowed here`);
    return m;
  }
  const parts = san.match(
    /^([KQRBN])?([a-h])?([1-8])?[x:-]?([a-h][1-8])(?:=?\(?([QRBNqrbn])\)?)?$/,
  );
  if (!parts) throw new Error(`"${text}" is not a chess move`);
  const [, kind = "P", fromFile, fromRank, to, promo] = parts;
  const target = squareIndex(to);
  let found = legal.filter(
    (m) =>
      m.piece[1] === kind &&
      m.to === target &&
      (!fromFile || (m.from & 7) === FILES.indexOf(fromFile)) &&
      (!fromRank || m.from >> 3 === Number(fromRank) - 1),
  );
  // A promotion that leaves out the new piece becomes a queen.
  if (found.some((m) => m.promo))
    found = found.filter((m) => m.promo === (promo || "Q").toUpperCase()); // prettier-ignore
  else if (promo) found = [];
  if (found.length === 1) return found[0];
  if (found.length > 1) throw new Error(`"${text}" could be more than one piece`);
  throw new Error(`"${text}" is not a legal move here`);
}

// The SAN for a legal move (for titles, messages and tests).
export function sanOf(pos, m) {
  let s;
  if (m.castle) s = (m.to & 7) === 6 ? "O-O" : "O-O-O";
  else {
    const kind = m.piece[1];
    const to = squareName(m.to);
    if (kind === "P")
      s = (m.capture !== undefined ? `${FILES[m.from & 7]}x` : "") + to + (m.promo ? `=${m.promo}` : ""); // prettier-ignore
    else {
      const rivals = legalMoves(pos).filter((x) => x.piece === m.piece && x.to === m.to && x.from !== m.from); // prettier-ignore
      let dis = "";
      if (rivals.length) {
        const sameFile = rivals.some((x) => (x.from & 7) === (m.from & 7));
        const sameRank = rivals.some((x) => x.from >> 3 === m.from >> 3);
        dis = !sameFile ? FILES[m.from & 7] : !sameRank ? String((m.from >> 3) + 1) : squareName(m.from); // prettier-ignore
      }
      s = kind + dis + (m.capture !== undefined ? "x" : "") + to;
    }
  }
  const next = applyMove(pos, m);
  if (inCheck(next)) s += legalMoves(next).length ? "+" : "#";
  return s;
}

// ---- PGN ----------------------------------------------------------------------

const RESULTS = new Set(["1-0", "0-1", "1/2-1/2", "½-½", "*"]);

// Splits the first game of a PGN text into its tags, its moves (SAN, main
// line only) and its result. Comments, variations, move numbers and NAGs
// are skipped.
export function splitPgn(text) {
  const src = String(text).replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const tags = {};
  const moves = [];
  let result = null;
  let depth = 0;
  let more = false;
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
    } else if (ch === "{") {
      const end = src.indexOf("}", i);
      i = end < 0 ? src.length : end + 1;
    } else if (ch === ";" || (ch === "%" && (i === 0 || src[i - 1] === "\n"))) {
      const end = src.indexOf("\n", i);
      i = end < 0 ? src.length : end + 1;
    } else if (ch === "(") {
      depth++;
      i++;
    } else if (ch === ")") {
      depth = Math.max(0, depth - 1);
      i++;
    } else if (ch === "[") {
      const end = src.indexOf("]", i);
      const body = src.slice(i + 1, end < 0 ? src.length : end);
      i = end < 0 ? src.length : end + 1;
      if (moves.length || result) {
        more = true;
        break;
      }
      const t = body.match(/^\s*([A-Za-z0-9_]+)\s+"((?:[^"\\]|\\.)*)"\s*$/);
      if (t) tags[t[1]] = t[2].replace(/\\(.)/g, "$1");
    } else {
      let j = i;
      while (j < src.length && !/[\s{}();[\]]/.test(src[j])) j++;
      let tok = src.slice(i, j);
      i = j;
      if (depth > 0) continue;
      if (RESULTS.has(tok)) {
        result = tok === "½-½" ? "1/2-1/2" : tok;
        // Anything after the result belongs to the next game.
        more = /\S/.test(src.slice(i).replace(/\{[^}]*\}/g, ""));
        break;
      }
      if (/^\$\d+$/.test(tok) || /^e\.p\.?$/i.test(tok)) continue;
      tok = tok.replace(/^\d+\.+/, "");
      if (!tok || /^\.+$/.test(tok) || /^\d+$/.test(tok)) continue;
      moves.push(tok);
    }
  }
  return { tags, moves, result, more };
}

const surname = (name) => {
  const n = String(name || "").trim();
  if (!n || n === "?") return "";
  return n.includes(",") ? n.split(",")[0].trim() : n;
};

// A short name for a game: "Kasparov v Topalov, Wijk aan Zee 1999".
export function gameTitle(tags) {
  const w = surname(tags.White);
  const b = surname(tags.Black);
  const year = /^\d{4}/.test(tags.Date || "") ? tags.Date.slice(0, 4) : "";
  const where = [tags.Event, tags.Site].map((x) => (x && x !== "?" ? x : "")).find(Boolean) || ""; // prettier-ignore
  const who = w || b ? `${w || "White"} v ${b || "Black"}` : "A game";
  return [who, [where, year].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

// Reads a PGN game and checks it move by move. Returns { tags, title,
// start (square -> piece), plies, result, loser ("w", "b" or null), more }.
// Throws an Error with a message for people when the text is not a game.
export const MAX_PLIES = 800;
export function readPgn(text) {
  if (!/\S/.test(String(text || ""))) throw new Error("The file is empty.");
  const { tags, moves, result, more } = splitPgn(text);
  if (tags.Variant && !/^(standard|chess)$/i.test(tags.Variant))
    throw new Error(`This chess set plays standard chess, not ${tags.Variant}.`);
  let pos;
  try {
    pos = parseFen(tags.FEN || START_FEN);
  } catch (err) {
    throw new Error(`The game's start position is not valid: ${err.message}`);
  }
  if (!moves.length) throw new Error("No moves were found. Is this a PGN file?");
  if (moves.length > MAX_PLIES) throw new Error(`The game is too long to play here (over ${MAX_PLIES / 2} moves).`); // prettier-ignore
  const start = {};
  pos.board.forEach((p, i) => p && (start[squareName(i)] = p));
  const firstTurn = pos.turn;
  const plies = [];
  for (let n = 0; n < moves.length; n++) {
    let m;
    try {
      m = moveFromSan(pos, moves[n]);
    } catch (err) {
      const moveNo = Math.floor((n + (firstTurn === "b" ? 1 : 0)) / 2) + 1;
      const dots = pos.turn === "w" ? "." : "...";
      throw new Error(`Move ${moveNo}${dots}${moves[n]}: ${err.message}.`);
    }
    plies.push({
      from: squareName(m.from),
      to: squareName(m.to),
      ...(m.castle ? { rf: squareName(m.castle.from), rt: squareName(m.castle.to) } : {}),
      ...(m.ep ? { ep: squareName(m.capture) } : {}),
      ...(m.promo ? { promo: m.promo } : {}),
      san: moves[n],
    });
    pos = applyMove(pos, m);
  }
  // Who lost: checkmate on the board, else the result (a resigning player
  // tips their king over).
  let loser = null;
  if (inCheck(pos) && !legalMoves(pos).length) loser = pos.turn;
  else if (result === "1-0") loser = "b";
  else if (result === "0-1") loser = "w";
  return { tags, title: gameTitle(tags), start, firstTurn, plies, result, loser, more, end: pos }; // prettier-ignore
}
