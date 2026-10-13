## Photo to 3D round 3 test tools (not shipped)

License sources were opened on October 13, 2026. These executables run only in the test workspace;
neither is copied into the site or the review media.

- Chromium 151.0.7922.173 (BSD-3-Clause for the Chromium project, with separately licensed
  third-party components),
  https://chromium.googlesource.com/chromium/src/+/refs/heads/main/LICENSE?format=TEXT: the
  workspace's existing browser captures and measures the actual photo renderer.
- Xvfb 2:21.1.16-1.3+deb13u4 (X.Org's MIT/X11 notices and separately licensed bundled components),
  https://metadata.ftp-master.debian.org/changelogs/main/x/xorg-server/xorg-server_21.1.16-1.3+deb13u4_copyright:
  the Debian package supplies a temporary virtual display for Chromium's Mesa WebGL2 tests. Its
  complete notices remain with the extracted test runtime in the ignored cache.
- FFmpeg / ffprobe 7.1.5-0+deb13u1 (this Debian build reports GPL-2.0-or-later),
  https://ffmpeg.org/legal.html: the workspace's installed encoder makes the paired H.264 review
  clips using libx264. Its actual license was also read from the Debian package's copyright file and
  `ffmpeg -L`. This test build is separate from the 9.0.2 build used for the earlier PDF audit.
- Pillow 12.3.0 (MIT-CMU), https://pillow.readthedocs.io/en/stable/about.html: the existing
  workspace library makes the public CC0 GIF fixtures. No Pillow runtime is copied into the review
  media.

These tool versions are retained with the public review evidence.
