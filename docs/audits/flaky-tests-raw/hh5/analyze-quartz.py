import base64
import json
import pathlib
import sys

report_path = pathlib.Path(sys.argv[1])
report = json.loads(report_path.read_text())
rows = []

def walk(suite):
    for spec in suite.get("specs", []):
        for test in spec.get("tests", []):
            for result in test.get("results", []):
                native = None
                for attachment in result.get("attachments", []):
                    if attachment["name"] == "quartz-native-events" and "body" in attachment:
                        native = json.loads(base64.b64decode(attachment["body"]))
                record = {"status": result["status"], "retry": result.get("retry", 0),
                          "duration_ms": result["duration"], "error": result.get("error", {}).get("message")}
                if native:
                    events = native["events"]
                    seats = [e for e in events if e["kind"] == "seat-completed" and e["body"]["joint"]["name"] == "xtal0"]
                    unpins = [e for e in events if e["kind"] == "free" and not e["before"]["joint"]["broken"]]
                    target = [e for e in unpins if e["before"]["joint"]["name"] == "xtal0"]
                    record.update({"repeat": native["repeat"], "state": native["state"][0],
                                   "neighbor_unpins": len(unpins) - len(target), "target_unpins": []})
                    for e in target:
                        generated = e.get("activeHit", {}).get("generated") or {}
                        last_seat = next((s for s in reversed(seats) if s["tick"] <= e["tick"]), None)
                        record["target_unpins"].append({
                            "free_tick": e["tick"], "generation_tick": generated.get("tick"),
                            "last_seat_tick": last_seat and last_seat["tick"],
                            "stale": bool(last_seat and generated.get("tick", 0) < last_seat["tick"]),
                            "speed": e.get("activeHit", {}).get("speed"),
                            "event": e,
                        })
                rows.append(record)
    for suite in suite.get("suites", []):
        walk(suite)

for suite in report["suites"]:
    walk(suite)
summary = {"completed": sum(r["status"] != "interrupted" for r in rows),
           "statuses": {s: sum(r["status"] == s for r in rows) for s in sorted({r["status"] for r in rows})},
           "neighbor_unpins": sum(r.get("neighbor_unpins", 0) for r in rows),
           "target_unpins": sum(len(r.get("target_unpins", [])) for r in rows),
           "rows": rows}
out = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else report_path.with_name("summary.json")
out.write_text(json.dumps(summary, indent=2) + "\n")
print(json.dumps({k: v for k, v in summary.items() if k != "rows"}))
for row in rows:
    if row["status"] != "passed" or row.get("target_unpins"):
        print(json.dumps(row))

