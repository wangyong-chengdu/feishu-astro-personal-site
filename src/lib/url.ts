export function withBase(path: string) {
  if (/^(https?:|mailto:|tel:|#)/.test(path)) {
    return path;
  }

  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (!normalizedBase) {
    return normalizedPath;
  }

  if (normalizedPath === "/") {
    return `${normalizedBase}/`;
  }

  return `${normalizedBase}${normalizedPath}`;
}
