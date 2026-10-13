// Save each observation without rewriting the growing matrix on every opening.
// Atomic checkpoints and a small journal allow recovery after process interruption.
import fs from "node:fs";

export function createAuditStore(
  filename,
  { checkpointEvery = 25, onIncompleteRecord = (message) => console.warn(message) } = {},
) {
  if (!Number.isInteger(checkpointEvery) || checkpointEvery < 1)
    throw new Error("checkpointEvery must be a positive integer");
  const pending = `${filename}.pending.jsonl`;
  const rows = fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename)) : [];
  const replace = (row) => {
    const index = rows.findIndex(
      (r) => r.id === row.id && r.device === row.device && r.sample === row.sample,
    );
    if (index >= 0) rows.splice(index, 1);
    rows.push(row);
  };
  if (fs.existsSync(pending)) {
    const data = fs.readFileSync(pending);
    const end = data.lastIndexOf(10) + 1;
    // Byte offsets keep Unicode labels intact when a write was interrupted.
    for (const line of data.subarray(0, end).toString("utf8").split("\n").slice(0, -1))
      replace(JSON.parse(line));
    if (end !== data.length) {
      fs.truncateSync(pending, end);
      onIncompleteRecord(`Discarded an incomplete final observation in ${pending}`);
    }
  }
  let sinceCheckpoint = 0;
  const checkpoint = () => {
    fs.writeFileSync(`${filename}.tmp`, JSON.stringify(rows, null, 2) + "\n");
    fs.renameSync(`${filename}.tmp`, filename);
    fs.writeFileSync(pending, "");
    sinceCheckpoint = 0;
  };
  return {
    rows,
    put(row) {
      fs.appendFileSync(pending, JSON.stringify(row) + "\n");
      replace(row);
      if (++sinceCheckpoint >= checkpointEvery) checkpoint();
    },
    finish() {
      checkpoint();
      fs.unlinkSync(pending);
    },
  };
}
