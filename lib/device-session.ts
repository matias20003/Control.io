export function parseDevice(userAgent: string): {
  deviceType: string;
  browser: string;
  os: string;
} {
  const ua = userAgent.toLowerCase();
  const deviceType = /ipad|tablet/.test(ua)
    ? "Tablet"
    : /android|iphone|mobile/.test(ua)
      ? "Celular"
      : "Computadora";

  const browser = /edg\//.test(ua)
    ? "Microsoft Edge"
    : /firefox\//.test(ua)
      ? "Firefox"
      : /crios\//.test(ua)
        ? "Chrome"
        : /chrome\//.test(ua)
          ? "Chrome"
          : /safari\//.test(ua)
            ? "Safari"
            : "Navegador";

  const os = /windows/.test(ua)
    ? "Windows"
    : /iphone|ipad|ios/.test(ua)
      ? "iOS"
      : /android/.test(ua)
        ? "Android"
        : /mac os|macintosh/.test(ua)
          ? "macOS"
          : /linux/.test(ua)
            ? "Linux"
            : "Sistema desconocido";

  return { deviceType, browser, os };
}
