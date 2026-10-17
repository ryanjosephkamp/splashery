# Retained task 100 evidence

Source `cf10f12f6fd15913059124a40391f3b2df8db5c4`. October 17, 2026.

Controlled camera residuals 0.90–1.30 in 41 predeclared factors: before 40/41 passed; after 41/41 passed. Before 1.02 failed original settled<0.08 at 0.15002594518096596; swing 2.5699867134055294 passed. The actual initialdistance was 3.7758585137128833 versus target 3.7018220722675323. Projection was refreshed in both modes; this isolates moving fit, not stale projection. Native camera.update(0) is used only during setup capture to preserve the residual, then restored inside the original gesture before press; after restores it before settleCamera. Original 30 drag, 150 release, 30 sampling updates and both assertions unchanged. Oneworker, twoburners. Synthetic residual setup is distinct from the original natural Actions failure.

The exact command, file hashes, runtime, browser, CPU quota, and times are in
`recipe.json`. Probe source bytes are in `probe-sources.zip`; no source algorithm
guard or fixture change is included in the production branch. Native-model
acceptance and diagnostic counts are kept separate.
