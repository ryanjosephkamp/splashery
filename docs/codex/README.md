# Codex tasks

Each file here is one task for Codex, written by the Operator. Ryan starts each with a one-line
prompt:

> Read docs/codex/NN-name.md in this repository and do it.

Each task works on its own `codex/<name>` branch and opens one draft pull request against `main`
(`AGENTS.md` has the rules). The Operator and the Claude lanes check every point before anything
merges.

| File                | Task                                                        | Changes                    | Needs the web |
| ------------------- | ----------------------------------------------------------- | -------------------------- | ------------- |
| 01-about-audit.md   | Check every toy's how-to and About text; element facts      | `src/toy-help.js`, reports | yes           |
| 02-credits-audit.md | Every shipped asset's license, checked on its source page   | report only                | yes           |
| 03-test-health.md   | Flaky and slow tests, with causes and proposed fixes        | report only                | no            |
| 04-phone-a11y.md    | Phone, keyboard and screen-reader audit of the public site  | report and screenshots     | no            |
| 05-compat-tests.md  | Old `#s=` links and saved scenes: a corpus and a test file  | one new test file          | no            |
| 06-perf-audit.md    | Load size and frame time per toy, and what would lighten it | report and data            | no            |
