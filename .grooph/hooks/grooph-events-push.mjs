#!/usr/bin/env node
/**
 * Send this project's session events to a branch of their own (docs/subagents.md §6).
 *
 * The event hook writes <project>/.grooph/events/<session id>.jsonl. Those files
 * are a record of what ran, not part of the work: committed with a lane's work
 * they would ride into every pull request. This puts them on a branch that holds
 * nothing else, so another machine can read them and no pull request ever sees them.
 *
 *   node .grooph/hooks/grooph-events-push.mjs [--branch <name>] [--remote <name>] [--no-push]
 *
 *   --branch <name>   the branch to write. Default: grooph-events/<the branch checked out here>,
 *                     and grooph-events-detached when no branch is checked out (a cloud session
 *                     before it starts a branch, a test runner on a bare commit).
 *                     Give the whole name when a harness only lets a session push under a
 *                     prefix, for example --branch claude/grooph-events-lane-a
 *   --remote <name>   default: origin
 *   --no-push         make the commit and print its id; send nothing
 *   --hook            run as a harness hook at the end of a turn (grooph hooks install --push):
 *                     wait a moment for the event hook's own line, then push; print nothing
 *                     and exit 0 whatever happens; give way if another push is under way.
 *                     How it went is left in .grooph/events/.last-push.json, which
 *                     `grooph hooks status` reads: a push that fails says so there.
 *
 * What it does, and all it does:
 *   - it makes one commit whose tree is .grooph/events/ and nothing else, on top
 *     of what that branch already holds on the remote, and pushes it there;
 *   - it never touches the working tree, the index, HEAD or the branch checked
 *     out: nothing is staged, nothing is checked out, no local branch is made;
 *   - event files already on that branch that this clone does not have are kept,
 *     so many sessions may share one branch; a file both have is never made
 *     shorter: lines only one side has are kept from both. When another session
 *     sends first, this one looks again and goes on top of it, until it is through;
 *   - it writes only to a branch that holds events and nothing else. A branch
 *     with anything else on it (a work branch, main) is refused, and so is the
 *     branch checked out here: an events branch is never a branch of work;
 *   - it sends what the hook wrote: ids, names and times.
 *
 * Read it elsewhere, after a fetch:  grooph sessions lane-a=git:origin/<branch>
 *
 * No dependencies; any Node from 18 on, and git. `grooph hooks install` copies
 * this file to <project>/.grooph/hooks/ beside the hook. `grooph events push`
 * runs the same code.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EVENTS = ".grooph/events";
/**
 * Where the events of a checkout with no branch go: one name, the same for every such checkout, so a reader knows
 * where to look. It sits beside `grooph-events/`, not inside it: no branch's own events branch can be this name or
 * lie under it, whatever the branch is called.
 */
const DETACHED = "grooph-events-detached";
/** How the last push went, beside the events and never one of them: no `.jsonl`, so it is neither sent nor read as a session. */
const RECORD = ".last-push.json";

/**
 * How git is run. By a person, as it is. As a hook, unattended: git must never ask for a password on a terminal
 * nobody is at, and no call may outlast its limit, or a turn's end would hang on a remote that does not answer.
 */
const how = { env: process.env, limits: undefined, deadline: undefined };
/** The time one call may take: its own limit, and never past the whole run's deadline. */
const limitFor = (args) => {
  const own = how.limits?.[args[0]] ?? how.limits?.other;
  if (own === undefined || how.deadline === undefined) return own;
  const left = how.deadline - Date.now();
  if (left < 500) throw Object.assign(new Error("out of time"), { cut: true, byDeadline: true, notBegun: true });
  return Math.min(own, left);
};
/** Whether the limit a call gets is the time left of the whole run rather than its own. */
const deadlineBound = (args) => how.deadline !== undefined && (how.limits?.[args[0]] ?? how.limits?.other ?? Infinity) > how.deadline - Date.now();
/**
 * A call that talks to a remote, with a limit, on a system with a shell: the shell that starts git leads a process
 * group of its own, and the whole group is stopped when the time is up. Stopping git alone would leave its helper
 * (the program that holds the connection) running after it, one more for every turn that ends while the remote is
 * down. The group is made by how the shell is started, not by the shell's job control: job control needs a
 * terminal, takes it from whoever has it, and in a sandbox with none it makes no group at all. When git ends in
 * time, the guard and its timer go too.
 */
const GROUPED = 't="$1"; shift; "$@" & pid=$!; ( trap \'kill "$s" 2>/dev/null; exit 0\' TERM; sleep "$t" & s=$!; wait "$s" && kill -9 -$$ ) >/dev/null 2>&1 & guard=$!; wait "$pid"; code=$?; kill "$guard" 2>/dev/null; exit "$code"';
const run = (cwd, args, input, env) => {
  const limit = limitFor(args);
  const byDeadline = limit !== undefined && deadlineBound(args);
  // What git says is read to tell one refusal from another, so it is asked to say it in one language.
  const options = { encoding: "utf8", input, stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"], maxBuffer: 64_000_000, env: { ...how.env, ...env, LC_ALL: "C", LANGUAGE: "C" } };
  // A call that may reach the remote: fetch and push, and, in a clone made without file contents, reading a file
  // or a tree, which can fetch what is missing by itself. Each is stopped whole when its time is up.
  const remote = args[0] === "fetch" || args[0] === "push" || ((args[0] === "cat-file" || args[0] === "ls-tree") && input === undefined);
  // The connection itself has limits too, for the helper's sake: no ten-minute waits on a link that has gone quiet.
  const patient = remote && limit ? ["-c", "http.lowSpeedLimit=1000", "-c", "http.lowSpeedTime=10"] : [];
  try {
    if (remote && limit && process.platform !== "win32") {
      const out = execFileSync("sh", ["-c", GROUPED, "sh", String(Math.max(1, Math.ceil(limit / 1000))), "git", "-C", cwd, ...patient, ...args], { ...options, detached: true, timeout: limit + 3000, killSignal: "SIGKILL" });
      return out.replace(/\n$/, "");
    }
    return execFileSync("git", ["-C", cwd, ...patient, ...args], { ...options, ...(limit ? { timeout: limit, killSignal: "SIGKILL" } : {}) }).replace(/\n$/, "");
  } catch (err) {
    if (wasCut(err) && err && typeof err === "object") err.byDeadline = byDeadline;
    throw err;
  }
};

/** Whether a call ended because its time was up: stopped by the guard, by Node's own limit, or never begun. */
const wasCut = (err) => err?.status === 137 || err?.signal === "SIGKILL" || err?.code === "ETIMEDOUT" || err?.message === "out of time";
const cutError = (args, err) =>
  Object.assign(new Error(err?.byDeadline ? `the time for this push ran out during git ${args[0]}` : `git ${args[0]} did not finish in the time it had`), { cut: true, byDeadline: err?.byDeadline === true, notBegun: err?.notBegun === true });

/**
 * One git command in `cwd`; its output, or undefined when git says no. `input` is given on standard input.
 * A call stopped for time is an error all the same: "no" and "no answer" are not the same thing.
 */
function git(cwd, args, input) {
  try {
    return run(cwd, args, input);
  } catch (err) {
    if (wasCut(err)) throw cutError(args, err);
    return undefined;
  }
}

/**
 * The same, but a failure is an error that says what git said (`said` holds all of it). `env` adds to the
 * environment of this one call.
 */
function must(cwd, args, input, env) {
  try {
    return run(cwd, args, input, env);
  } catch (err) {
    if (wasCut(err)) throw cutError(args, err);
    const all = String(err?.stderr ?? err?.message ?? err).trim();
    // The reason, without git's advice, the address it pushed to, and its closing "failed to push some refs".
    const said = all
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "" && !/^(hint:|To |error: failed to push some refs)/.test(line))
      .slice(-3)
      .join(" ");
    throw Object.assign(new Error(`git ${args[0]} failed: ${said || all.split("\n").pop()}`), { said: all });
  }
}

const validBranch = (cwd, name) => git(cwd, ["check-ref-format", "--branch", name]) !== undefined;

/** The entries of a tree, by name. `-z`: a name with a space, a quote or an accent comes back as it is, not quoted. */
function entriesOf(cwd, treeish) {
  const listed = git(cwd, ["ls-tree", "-z", treeish]);
  if (listed === undefined) return undefined;
  const entries = new Map();
  for (const record of listed.split("\0")) {
    const m = /^(\d+) (\w+) ([0-9a-f]+)\t([\s\S]+)$/.exec(record);
    if (m) entries.set(m[4], { mode: m[1], type: m[2], id: m[3] });
  }
  return entries;
}

/** A tree from its entries, sorted as git sorts them. */
const treeOf = (cwd, entries) =>
  must(
    cwd,
    // `--missing`: in a clone made without file contents, the other sessions' files on the branch are known by id only.
    ["mktree", "-z", "--missing"],
    [...entries]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([name, e]) => `${e.mode} ${e.type} ${e.id}\t${name}\0`)
      .join(""),
  );

/**
 * What an events branch may hold: `.grooph/events/` with files in it, and nothing else at any level.
 * Returns why not, or undefined when the commit is one.
 */
function notAnEventsBranch(cwd, commit) {
  const [top, leaf] = EVENTS.split("/");
  const root = entriesOf(cwd, commit);
  if (!root) return "its tree could not be read";
  if (root.size !== 1 || root.get(top)?.type !== "tree") return `it holds other files (${[...root.keys()].filter((n) => n !== top).slice(0, 3).join(", ") || "an unexpected layout"})`;
  const mid = entriesOf(cwd, `${commit}:${top}`);
  if (!mid || mid.size !== 1 || mid.get(leaf)?.type !== "tree") return `its ${top}/ holds more than ${leaf}/`;
  const files = entriesOf(cwd, `${commit}:${EVENTS}`);
  if (!files || [...files.values()].some((e) => e.type !== "blob")) return `its ${EVENTS}/ holds folders`;
  return undefined;
}

/**
 * One event file from two copies. Events are appended, so one copy is normally the other with more lines:
 * then the longer one. When neither continues the other (a session id used again after its file was lost),
 * the branch's lines stay and the lines only this clone has follow them. Nothing is ever dropped.
 */
function joined(onBranch, here) {
  if (here.startsWith(onBranch)) return here;
  if (onBranch.startsWith(here)) return onBranch;
  const had = new Set(onBranch.split("\n"));
  const added = here.split("\n").filter((line) => line !== "" && !had.has(line));
  return `${onBranch}${onBranch.endsWith("\n") || onBranch === "" ? "" : "\n"}${added.join("\n")}${added.length ? "\n" : ""}`;
}

/** Who an events commit is by: grooph, whatever git identity the session has (the environment outranks its configuration). */
const AS_GROOPH = { GIT_AUTHOR_NAME: "grooph", GIT_AUTHOR_EMAIL: "grooph@localhost", GIT_COMMITTER_NAME: "grooph", GIT_COMMITTER_EMAIL: "grooph@localhost" };

/**
 * Whether a refused push was declined for a reason of its own (a hook or a rule of the remote's, no right to push,
 * no way through), from git's words. Only the reason is read: the remote's own lines, and what a refusal gives in
 * brackets. The address pushed to and the names of branches are left out, so that a remote called `access-denied`
 * or a branch called `issue-403` say nothing. Whether a refusal was a race is not read from words at all: a race
 * moves the branch, and that is looked at.
 */
function declined(said) {
  const reasons = String(said ?? "")
    .split("\n")
    .flatMap((line) => {
      const t = line.trim();
      if (/^(To |hint:|error: failed to push some refs)/.test(t)) return [];
      const rejected = /^!\s*\[[^\]]*\].*?(\(.*\))\s*$/.exec(t);
      if (rejected) return [rejected[1]];
      return [t.replace(/'[^']*'/g, "''")];
    })
    .join("\n");
  return /hook declined|push declined|protected branch|denied|not permitted|not allowed|unauthori[sz]ed|authentication failed|could not read (username|password)|unable to access|could not resolve host|\b40[13]\b/i.test(reasons);
}

/** How many times a push is made before giving up, when run by hand. As a hook the time left decides. */
const TRIES = 20;
/** Wait, without giving the turn to anything else: this script does one thing at a time. */
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * Leave word of how a push went: one small file beside the events, replaced each time. A hook prints nothing and
 * fails nothing, so without this a push that never arrives looks, from the outside, like a session that never ran.
 * It is read by `grooph hooks status` and `grooph sessions`, never by a harness, and it is never sent.
 */
function record(project, by, outcome) {
  let tmp;
  try {
    const dir = join(project, EVENTS);
    if (!existsSync(dir)) return;
    const file = join(dir, RECORD);
    let before;
    try {
      // Only a plain file of a sane size is read: anything else there is not a record this wrote.
      const is = statSync(file);
      if (is.isFile() && is.size < 100_000) before = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      // none yet, or not readable: this one starts the count
    }
    if (typeof before !== "object" || before === null || Array.isArray(before)) before = {};
    const at = new Date().toISOString();
    let next;
    if (outcome === "started") {
      // A push that is stopped dead (the sandbox put to sleep, the process killed) cannot say so afterwards.
      // So it says it has begun, and the word of how it ended replaces this: a start with no end is the trace.
      next = { ...before, v: 1, started: at };
    } else {
      next = { v: 1, at, ok: outcome.ok, by, ...(outcome.branch ? { branch: outcome.branch } : {}), message: plain(outcome.message), ...(outcome.tries > 1 ? { tries: outcome.tries, ...(outcome.crowded ? { crowded: true } : {}) } : {}) };
      const arrived = before.arrived && typeof before.arrived === "object" ? before.arrived : undefined;
      if (outcome.ok && outcome.commit) next.arrived = { at, branch: outcome.branch, commit: outcome.commit };
      else if (arrived) next.arrived = arrived;
      if (!outcome.ok) {
        const running = before.ok === false;
        next.failedSince = running && typeof before.failedSince === "string" ? before.failedSince : at;
        next.failures = (running && Number.isSafeInteger(before.failures) && before.failures > 0 ? before.failures : 0) + 1;
      }
    }
    tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(next)}\n`);
    renameSync(tmp, file);
  } catch {
    // A record that cannot be written changes nothing else, and leaves nothing half-written behind.
    try {
      if (tmp) rmSync(tmp, { force: true });
    } catch {
      // nor does that
    }
  }
}

/**
 * What went wrong, fit to keep and to print: one line, no control characters (a remote's own words end up here),
 * and no secret. What git says may name the remote with a password in its address, or quote a token.
 */
const plain = (message) =>
  String(message ?? "")
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/]*@/gi, "$1")
    .replace(/\b(gh[pousr]_|github_pat_|glpat-)[A-Za-z0-9_-]{8,}/g, "$1…")
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);

export function pushEvents(options) {
  const where = {};
  try {
    return send(options, where);
  } catch (error) {
    // The branch it was for, when it got as far as knowing: the record of a failed push names it.
    if (where.branch && error && typeof error === "object") error.branch = where.branch;
    throw error;
  }
}

function send(options, where) {
  const project = options.project;
  const remote = options.remote ?? "origin";
  if (git(project, ["rev-parse", "--git-dir"]) === undefined) throw new Error(`${project} is not in a git repository`);

  const dir = join(project, EVENTS);
  // Only files the hook wrote: plain files in a plain folder. A link is never followed, or a link put in the
  // repository by someone else would send whatever it points at.
  if (existsSync(dir) && lstatSync(dir).isSymbolicLink()) throw new Error(`${EVENTS} is a link, not a folder: nothing is sent from it`);
  const files = existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => name.endsWith(".jsonl") && lstatSync(join(dir, name)).isFile())
        .sort()
    : [];
  if (files.length === 0) return { status: "nothing", message: `No events in ${EVENTS}/ yet: nothing to send. The event hook writes them once it is installed (grooph hooks install).` };

  // `symbolic-ref` names the branch HEAD is on, born or not, and says nothing when HEAD is on no branch. The whole
  // name is asked for: the short one is spelt differently when a tag has the same name.
  const head = git(project, ["symbolic-ref", "--quiet", "HEAD"]) ?? "";
  const checkedOut = head.startsWith("refs/heads/") ? head.slice("refs/heads/".length) : undefined;
  // With no branch checked out there is no name to derive one from, and one made from the commit would change with
  // every commit. A cloud session starts this way, and a test runner stays this way: their events go to one branch
  // they all share, which is safe because each session writes a file of its own.
  const detached = !options.branch && !checkedOut;
  const branch = options.branch ?? (checkedOut ? `grooph-events/${checkedOut}` : DETACHED);
  if (!validBranch(project, branch)) throw new Error(`"${branch}" is not a branch name git accepts`);
  where.branch = branch;
  if (branch === checkedOut) throw new Error(`"${branch}" is the branch checked out here: the events go to a branch of their own, never to a branch of work. Leave --branch out, or name another`);
  const ref = `refs/heads/${branch}`;

  const hasRemote = git(project, ["remote", "get-url", remote]) !== undefined;
  if (!hasRemote && options.push !== false) throw new Error(`there is no remote named "${remote}" here`);

  // The branch's tip on the remote is fetched into a ref of grooph's own, never into FETCH_HEAD: a session that
  // fetched something and means to use FETCH_HEAD next must still find what it fetched there. One ref per branch,
  // under a name made from it: worktrees of one repository that send to different branches do not share it.
  const TIP = `refs/grooph/events-tips/${createHash("sha1").update(`${remote} ${branch}`).digest("hex").slice(0, 16)}`;
  const tipOnRemote = () => {
    if (!hasRemote) return undefined;
    const spec = `+${ref}:${TIP}`;
    // `--no-write-fetch-head` is git 2.29 and later. An older git has no way to fetch without writing FETCH_HEAD.
    const [major, minor] = (/(\d+)\.(\d+)/.exec(git(project, ["version"]) ?? "") ?? []).slice(1).map(Number);
    const keep = major > 2 || (major === 2 && minor >= 29) ? ["--no-write-fetch-head"] : [];
    try {
      must(project, ["fetch", "--quiet", "--no-tags", ...keep, remote, spec]);
    } catch (error) {
      if (error.cut) throw Object.assign(new Error(`${remote} did not answer in time`), { cut: true });
      // The one failure that is an answer: the branch is not there yet. Any other is a fetch that did not work,
      // and must not be taken for "no branch": a commit made on nothing would be refused, and would say why badly.
      if (/couldn't find remote ref/i.test(error.said ?? "")) return undefined;
      throw error;
    }
    const tip = git(project, ["rev-parse", "--verify", "--quiet", `${TIP}^{commit}`]);
    if (!tip) throw new Error(`${remote} ${branch} was fetched and could not be read`);
    return tip;
  };

  // Another session may send to the same branch between this one's fetch and its push. The remote takes one push at a
  // time and only on top of what it holds, so it refuses this one, and the answer is to look again and put this
  // commit on top of theirs. When many sessions' turns end together, one gets through each round and the rest go
  // again: so the tries are many, each after a short wait of a different length, and as a hook they go on until the
  // time is nearly up. A push refused for a reason of its own (no right to push, a rule of the remote's, no network)
  // is not cured by trying again: three of those, or of fetches that fail, and it stops and says what git said.
  let refused; // the last push that was refused: what it was built on, git's words, and whether the remote declined it
  let failed; // the last thing that went wrong, whatever it was: the reason given when time runs out
  let own = 0; // refusals and failures that were not another session getting there first
  let beaten = 0; // refusals that were
  let made = 0; // pushes made
  // What the last thing that went wrong was: another session getting there first ("race"), a refusal not yet told
  // apart, which in a crowd is most likely one ("pending"), or anything else ("other"), whose words are kept.
  let last = "other";
  const crowded = () => (beaten > 0 ? `: other sessions kept sending to ${branch} first` : "");
  const worth = () => failed && (last === "other" || (last === "pending" && beaten === 0));
  const spent = () => new Error(`no time left after ${made} ${made === 1 ? "try" : "tries"}${crowded()}${worth() ? `${beaten > 0 ? "; the last try" : ""}: ${failed.message}` : ""}`);
  try {
    return tryUntilThrough();
  } catch (error) {
    if (error?.cut && (beaten > 0 || failed)) {
      // The run's time ran out after other failures: what went wrong before is the reason worth keeping.
      if (error.byDeadline) throw spent();
      // One call took longer than its own limit: that is the reason, and what came before is added.
      throw new Error(`${error.message}, on try ${made}${crowded()}${worth() ? `; before that: ${failed.message}` : ""}`);
    }
    throw error;
  }

  function tryUntilThrough() {
    for (let attempt = 1; ; attempt += 1) {
      // As a hook, a try that could not finish in the time left is not begun.
      if (failed && how.deadline !== undefined && how.deadline - Date.now() < 4000) throw spent();
      // What the branch holds on the remote now, if it exists there: the new commit goes on top of it.
      let parent;
      try {
        parent = tipOnRemote();
      } catch (error) {
        if (error.cut) throw error;
        failed = error;
        last = "other";
        own += 1;
        if (own >= 3) throw error;
        pause(50 + Math.floor(Math.random() * 300));
        continue;
      }
      if (refused) {
        // A race moves the branch. A refusal that leaves it where it was is this push's own, whatever it was called.
        const race = !refused.declined && refused.parent !== parent;
        last = race ? "race" : "other";
        if (race) beaten += 1;
        else own += 1;
        const error = refused.error;
        refused = undefined;
        if (!race && own >= 3) throw error;
        // By hand there is no clock; a count ends it.
        if (how.deadline === undefined && made >= TRIES) throw new Error(`${error.message} (${TRIES} tries${crowded()})`);
      }

      // The branch may hold events and nothing else. Anything more is someone's work, and this would replace it.
      if (parent) {
        const why = notAnEventsBranch(project, parent);
        if (why) throw new Error(`${remote} ${branch} is not an events branch: ${why}. Nothing was sent. Name a branch that holds only ${EVENTS}/, or one that does not exist yet`);
      }

      // The tree: every event file on the branch, and every one here; a file both have is joined, never shortened.
      const entries = parent ? entriesOf(project, `${parent}:${EVENTS}`) : new Map();
      // Read or stop: going on without them would drop every other session's file from the branch.
      if (!entries) throw new Error(`the files ${remote} ${branch} holds could not be read. Nothing was sent`);
      for (const name of files) {
        const local = readFileSync(join(dir, name), "utf8");
        const had = entries.get(name);
        // The same for the copy on the branch: unread, this clone's copy would replace it, lines and all.
        const before = had ? must(project, ["cat-file", "blob", had.id]) : undefined;
        // `git()` trims one trailing newline; the comparison is of lines, so give it back.
        const text = before === undefined ? local : joined(before === "" ? "" : `${before}\n`, local);
        entries.set(name, { mode: "100644", type: "blob", id: must(project, ["hash-object", "-w", "--stdin"], text) });
      }
      const [top, leaf] = EVENTS.split("/");
      const eventsTree = treeOf(project, entries);
      const root = treeOf(project, new Map([[top, { mode: "040000", type: "tree", id: treeOf(project, new Map([[leaf, { mode: "040000", type: "tree", id: eventsTree }]])) }]]));
      const count = `${entries.size} event file${entries.size === 1 ? "" : "s"}`;

      if (parent && git(project, ["rev-parse", `${parent}^{tree}`]) === root) {
        return { status: "unchanged", branch, commit: parent, files: entries.size, message: `Nothing new: ${remote} ${branch} already holds ${entries.size === 1 ? "this" : "these"} ${count}.` };
      }

      // The commit names no person. Made with the session's own git identity it would put somebody's name and e-mail
      // address on a branch that holds ids, names of agents and times, and a host that guards a private address
      // refuses such a push outright (GitHub: "push declined due to email privacy restrictions").
      const when = (options.now ?? new Date()).toISOString();
      const commit = must(project, ["commit-tree", root, ...(parent ? ["-p", parent] : []), "-m", `grooph events: ${entries.size} session file${entries.size === 1 ? "" : "s"}, ${when}`], undefined, AS_GROOPH);

      if (options.push === false) return { status: "committed", branch, commit, files: entries.size, message: `Made commit ${commit.slice(0, 7)} for ${branch} (${count}); not sent (--no-push).` };

      made += 1;
      try {
        // `--no-verify`: the repository's own pre-push hook is for its work (a test run, a lint), not for this.
        must(project, ["push", "--quiet", "--no-verify", remote, `${commit}:${ref}`]);
      } catch (error) {
        // Stopped at its time limit, there is no time for another. Stopped before it began, it was not a try.
        if (error.cut) {
          if (error.notBegun) made -= 1;
          throw error;
        }
        failed = error;
        refused = { parent, error, declined: declined(error.said ?? error.message) };
        last = refused.declined ? "other" : "pending"; // a race or not is known when the branch is looked at again
        pause(50 + Math.floor(Math.random() * 300));
        continue;
      }
      return {
        status: "pushed",
        branch,
        commit,
        files: entries.size,
        tries: made,
        beaten,
        message: `Sent ${count} to ${remote} ${branch} (${commit.slice(0, 7)})${detached ? ": no branch is checked out here, so they went to the branch every such checkout shares" : ""}. Read them elsewhere after a fetch: grooph sessions <name>=git:${remote}/${branch}`,
      };
    }
  }
}

/** The project a copy of this script belongs to: <script>/../.. when it sits in .grooph/hooks/, else where it is run. */
export function projectOf(script, cwd) {
  const dir = dirname(script);
  if (dir.replace(/\\/g, "/").endsWith("/.grooph/hooks")) return resolve(dir, "..", "..");
  return git(cwd, ["rev-parse", "--show-toplevel"]) ?? cwd;
}

/**
 * @param {"hand" | "hook"} by who ran it, for the record of how it went
 * @returns {number} the exit code
 */
export function main(argv, project, out = console.log, err = console.error, by = "hand") {
  const options = { project };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--branch" || arg === "--remote") {
      const value = argv[++i];
      if (!value) {
        err(`grooph: ${arg} needs a value`);
        if (by === "hook") record(project, by, { ok: false, message: `${arg} needs a value` });
        return 1;
      }
      options[arg.slice(2)] = value;
    } else if (arg === "--no-push") options.push = false;
    else {
      err(`grooph: events push does not take "${arg}". Options: --branch <name>, --remote <name>, --no-push`);
      if (by === "hook") record(project, by, { ok: false, message: `events push does not take "${arg}"` });
      return 1;
    }
  }
  try {
    const done = pushEvents(options);
    // A commit that was made and not sent (--no-push) is not a push: by hand, the record stays as it was. A hook
    // that began says how it ended, whatever it was asked to do.
    if (done.status !== "committed") record(project, by, { ok: true, branch: done.branch, commit: done.commit, message: done.message, tries: done.tries, crowded: done.beaten > 0 });
    else if (by === "hook") record(project, by, { ok: true, branch: done.branch, message: done.message });
    out(done.message);
    return 0;
  } catch (e) {
    if (options.push !== false || by === "hook") record(project, by, { ok: false, ...(e.branch ? { branch: e.branch } : {}), message: e.message });
    err(`grooph: ${e.message}`);
    return 1;
  }
}

/**
 * As a hook at the end of a turn. A session's events are only seen elsewhere when they are sent, and a session
 * cannot send what it writes as it stops: so this runs when a turn ends, after the event hook's line for that end.
 * It keeps the event hook's promises: nothing printed, exit 0 whatever happens, nothing the harness reads back.
 * It is not the event hook, and it is installed only when asked for (--push).
 *
 * A harness runs the hooks of one event side by side, so the turn's own last line may not be written yet:
 * `settle` waits for it. One push at a time: a lock folder beside the events; a lock more than two minutes
 * from now, either way, was left by a push that died or by a wrong clock, and is taken over.
 *
 * Unattended: git is told never to ask anything of a terminal, and every call has a limit, so a remote that
 * wants a password or never answers costs a turn's end some seconds and never hangs it. A push that is stopped
 * dead leaves its lock, which the next push takes over after two minutes, and the word that it began.
 *
 * Silent is not the same as traceless: how the push went is left in `.grooph/events/.last-push.json`, so a push
 * that fails on every turn can be found by looking (`grooph hooks status`), where before it could not be told
 * from a hook that never ran.
 */
export async function hookMain(argv, project, settle = Number(process.env.GROOPH_PUSH_SETTLE_MS ?? 1500)) {
  const lock = join(project, EVENTS, ".pushing");
  let mine = false;
  const release = () => {
    if (!mine) return;
    mine = false;
    try {
      rmSync(lock, { recursive: true, force: true });
    } catch {
      // left for the next push to take over
    }
  };
  // Asked to stop, it stops quietly. While git is being waited for nothing here runs, so this is heard before the
  // work or after it, never in the middle: a push cut off in the middle is known by its "began" with no end.
  for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) {
    process.once(signal, () => {
      release();
      process.exit(0);
    });
  }
  try {
    // Everything together stays well inside the hook's own limit of sixty seconds, retries included.
    how.limits = { fetch: 12_000, push: 20_000, other: 8_000 };
    how.deadline = Date.now() + 45_000;
    how.env = { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_ASKPASS: "", SSH_ASKPASS: "", GCM_INTERACTIVE: "never" };
    // ssh asks on the terminal by itself; batch mode stops it. A project's or a person's own ssh command is left alone.
    if (!process.env.GIT_SSH_COMMAND && !git(project, ["config", "core.sshCommand"])) how.env.GIT_SSH_COMMAND = "ssh -oBatchMode=yes -oConnectTimeout=10";
    // A moment, and never more than ten seconds whatever it is set to: the whole run must end inside the hook's limit.
    await new Promise((done) => setTimeout(done, Number.isFinite(settle) && settle >= 0 ? Math.min(settle, 10_000) : 1500));
    if (!existsSync(join(project, EVENTS))) return 0;
    try {
      mkdirSync(lock);
      mine = true;
    } catch (taken) {
      // Only a lock that is there means another push. A folder that cannot be written is a failure, and is said.
      if (taken?.code !== "EEXIST") throw new Error(`${EVENTS}/ could not be written: ${taken?.code ?? taken?.message ?? taken}`);
      let age;
      try {
        age = Math.abs(Date.now() - statSync(lock).mtimeMs);
      } catch {
        age = undefined; // it went between the two looks: the push that held it has finished
      }
      if (age !== undefined && age < 120_000) return 0; // another push is under way; the next turn's will carry this one's lines
      rmSync(lock, { recursive: true, force: true });
      try {
        mkdirSync(lock);
      } catch {
        return 0; // a third push took it first
      }
      mine = true;
    }
    record(project, "hook", "started");
    main(argv.filter((arg) => arg !== "--hook"), project, () => {}, () => {}, "hook");
  } catch (e) {
    // A hook that fails must not fail a turn. It leaves word of why.
    record(project, "hook", { ok: false, message: e?.message ?? String(e) });
  } finally {
    release();
  }
  return 0;
}

const invoked = process.argv[1] ? realpathSync(process.argv[1]) : "";
if (invoked === realpathSync(fileURLToPath(import.meta.url))) {
  const argv = process.argv.slice(2);
  // The folder it was started in may be gone by now; the script's own place is always there.
  let cwd;
  try {
    cwd = process.cwd();
  } catch {
    cwd = dirname(invoked);
  }
  const project = projectOf(invoked, cwd);
  process.exitCode = argv.includes("--hook") ? await hookMain(argv, project) : main(argv, project);
}
