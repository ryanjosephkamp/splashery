# Earlier duration policy study

These files retain the first revised policy, before final bitrate tuning: Standard/High/Max used
3/8/12 Mb/s per 1080-square frame, a 20-Mb/s ceiling, and budgeted 5/3/1 minutes. The phone fixed
scene yielded raw SSIM 0.934992 / 0.828337 for Standard/High, with saved/live sharpness of 42.8% /
30.0%. The final policy spends more bits and shows shorter limits.

This earlier fixed-scene runner used the player visibility pause. The final runner uses the
supported deterministic renderAt(0, cameraState) API, which freezes the scene and snaps the camera
while allowing rendering/layout at the new buffer size. Compare each saved file with its own
reference; these different views do not isolate a causal bitrate-quality improvement.

Review evidence only. Never merge this branch. Existing assets keep their recorded licenses.
