# Keep completed models when optional environment fitting is unavailable

Made by Ryan with Codex (GPT-6), MIT. These are pipeline/session controls with simulated I/O, not native bake or device-speed measurements. The original code failed the new regression: a completed model was discarded after optional fitting rejected. The original failure log, screenshot, and trace are preserved.

The changed pipeline retains its black background and diagnostic when only fitting fails or reaches its60-second deadline. Export remains serialized behind fitter cleanup. Late accepted color cannot revive after its deadline. Device loss, training errors, and export failures still prevent publication. Eight browser pipeline/session cases pass; a separate17-case run includes existing deadline, fitter resource, and fatal-training controls. No existing assertion, threshold, or skip was changed.

The native R10 Pisac desktop attempt is the trigger: training completed, then its optional fit exceeded60seconds and returned an explanation instead of a model. That original negative outcome remains unchanged. A fresh native revision is required to measure recovery; these simulated controls do not promote the R10 result to a success.
