import { defineConfig } from "@playwright/test";

const viewports = [
  { name: "compact-320", width: 320, height: 568 },
  { name: "android-360-640", width: 360, height: 640 },
  { name: "android-360-800", width: 360, height: 800 },
  { name: "iphone-375", width: 375, height: 667 },
  { name: "iphone-390", width: 390, height: 844 },
  { name: "android-393", width: 393, height: 852 },
  { name: "android-412", width: 412, height: 915 },
  { name: "iphone-430", width: 430, height: 932 },
  { name: "landscape-844", width: 844, height: 390 },
];

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: "http://127.0.0.1:3100",
    browserName: "chromium",
    channel: "chrome",
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    colorScheme: "light",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: viewports.map(({ name, width, height }) => ({
    name,
    use: {
      viewport: { width, height },
      hasTouch: true,
      isMobile: width < 600,
    },
  })),
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/brief-mobile-fixture",
    reuseExistingServer: true,
    timeout: 300_000,
    env: {
      ...process.env,
      BRIEF_E2E_FIXTURE: "1",
    },
  },
});
