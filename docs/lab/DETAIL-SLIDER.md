# The Detail slider (labs)

Lane Kit lab, October 10, 2026 (Opus 5.5). Experiment 1 of the lane. The measurements behind it are
in [BUDGETS.md](BUDGETS.md).

## What it is

With labs on, a slider under Detail sets a kit toy's splats directly, from 60,000 to 400,000 in
steps of 10,000. Auto, High, and Max stay, and pressing any of them clears the slider.

- **The tier follows the slider.** The tier whose usual count is nearest (Low 60k, Mid 140k, High
  200k, Max 280k) still sets everything else: the canvas's pixel cap, the light scan files on Low,
  and the fluid and picture budgets. A toy's recipe density still multiplies the count, and the most
  a toy may ask for grows in the tier's own ratio.
- **It stays on the device.** Like Detail, it is kept in this browser (`splashery.splats`), never in
  links or saved scenes, and read only while labs is on. With labs off a stored count is ignored.
- **A forced tier wins.** With `?profile=`, the slider changes the count but not the tier.
- **Who reads it.** Kit toys and the shelf's generated shapes take the slider's count. Packs that
  read the tier's budget themselves (the viewers, Space) follow the nearest tier.

## The numbers

The card `klab-detail-slider` shows the bicycle close up at 60k, 140k, 200k, 280k, and 400k.

- From 60k to 140k thin parts lose their spill (the bicycle's frame covers 18% more of the screen at
  60k than at 400k, and 7% more at 140k), and edges sharpen by about a tenth.
- Past 140k the edges gain a few hundredths of a pixel, and shimmer rises by 18 to 60%.

## Cost

No memory or time when it is not used. When it is used, the toy's memory scales with the count it
sets, exactly as if the toy had that budget: about 72 bytes a splat on the CPU, with the GPU's copy
on top.

## What it doesn't show

- Its value is on a real phone: the software renderer can't say which counts a given phone keeps
  smooth.
- It changes the tier with the count, so 60k on the slider is also Low's softer canvas. The sweep in
  BUDGETS.md holds the canvas at ratio 3 to separate the two.

## Recommendation

**Keep it as a labs option.** It is the tool to answer the one open budget question (whether a weak
phone keeps its frame rate at 90,000 to 100,000), and it costs nothing when unused. Don't make it
the default: the sweep says no phone needs more than its tier gives, and a slider invites people to
raise the count, which makes toys shimmer more.
