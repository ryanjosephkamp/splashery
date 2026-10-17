# Retained task 100 evidence

The first full preflight on source 9a16ae2ae used a nondefault server port,
4217. Two existing viewer tests use an absolute local PDF fixture URL on 4173.
Both failed before PDF assertions; 269 other cases passed. A direct check
confirmed no server listened on 4173. The correction restores the standard
port and repeats the complete preflight without source or assertion changes.
This is a setup failure, not a clean preflight or a target-test retry.

The complete original log and exact setup are retained. Failure files are
listed in recipe.json; empty means they were already removed by Playwright's
standard output cleanup before preservation. No missing trace is claimed.
