// Live input (lane Live input): a live stream (a shared screen, a camera)
// as picture media for a picture toy's sheets (src/pictures.js), with the
// same shape as media.js's videos: kind "video", count 1, play and pause,
// onFrame and draw. It has no length and can't seek. `live: true` tells a
// toy that the picture is live. Closing it lets go of the video element;
// the tracks belong to src/live/live.js, which ends them on Stop.

export function openStream({ stream, name = "Live" }) {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.srcObject = stream;
  const frameFns = new Set();
  let closed = false;
  const watch = () => {
    if (closed || !video.requestVideoFrameCallback) return;
    video.requestVideoFrameCallback(() => {
      for (const fn of frameFns) fn();
      watch();
    });
  };
  let timer = null;
  if (!video.requestVideoFrameCallback)
    timer = setInterval(() => frameFns.forEach((fn) => fn()), 1000 / 30);
  return new Promise((resolve, reject) => {
    const ready = () => {
      watch();
      resolve({
        kind: "video",
        live: true,
        name,
        url: null,
        count: 1,
        video,
        duration: 0,
        get playing() {
          return !video.paused;
        },
        aspect: () => (video.videoWidth || 16) / (video.videoHeight || 9),
        size: () => ({ width: video.videoWidth, height: video.videoHeight }),
        play: () => video.play().catch(() => {}),
        pause: () => video.pause(),
        seek() {},
        setMuted() {},
        onFrame(fn) {
          frameFns.add(fn);
          return () => frameFns.delete(fn);
        },
        async draw(i, w, h) {
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(w));
          c.height = Math.max(1, Math.round(h));
          c.getContext("2d").drawImage(video, 0, 0, c.width, c.height);
          return c;
        },
        close() {
          closed = true;
          clearInterval(timer);
          video.pause();
          video.srcObject = null;
        },
      });
    };
    video.addEventListener("loadeddata", ready, { once: true });
    video.play().catch(reject);
  });
}
