// Task 72 uses native graphics with Chromium's sandbox and security checks.
export const ignoredDefaults = [
  "--enable-unsafe-swiftshader",
  "--unsafely-disable-devtools-self-xss-warnings",
  "--disable-client-side-phishing-detection",
  "--disable-ipc-flooding-protection",
  "--disable-popup-blocking",
];

export function safeLaunchOptions() {
  if (process.env.QR72_BACKEND)
    throw new Error("Task 72 validation uses the native backend; unset QR72_BACKEND.");
  return {
    executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
    chromiumSandbox: true,
    ignoreDefaultArgs: ignoredDefaults,
    args: [],
  };
}

export function assertSafeArguments(args) {
  const forbidden = args.filter(
    (arg) =>
      /^--(?:enable-unsafe-|unsafely-)/.test(arg) ||
      [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu-sandbox",
        "--disable-web-security",
        "--ignore-certificate-errors",
        "--allow-running-insecure-content",
        "--disable-site-isolation-trials",
        "--ignore-gpu-blocklist",
        "--disable-gpu-driver-bug-workarounds",
        ...ignoredDefaults,
      ].some((flag) => arg === flag || arg.startsWith(flag + "=")),
  );
  if (forbidden.length) throw new Error(`Unsafe browser launch arguments: ${forbidden.join(", ")}`);
}
