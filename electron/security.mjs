import path from "node:path";
export const APP_URL = "caviard://app/";
export function isAppUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "caviard:" &&
      url.hostname === "app" &&
      !url.port &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
export function assetPath(value, root) {
  if (!isAppUrl(value)) throw new Error("Untrusted origin");
  const pathname = decodeURIComponent(new URL(value).pathname);
  if (
    pathname.includes("\\") ||
    pathname.includes("\0") ||
    pathname.split("/").includes("..")
  )
    throw new Error("Invalid asset path");
  const file = path.resolve(
    root,
    `.${pathname === "/" ? "/index.html" : pathname}`,
  );
  const relative = path.relative(root, file);
  if (relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("Asset outside application");
  return file;
}
export function externalUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "mailto:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function safePdfName(value) {
  if (typeof value !== "string") throw new TypeError("Invalid filename");
  const base = value
    .split(/[\\/]/)
    .pop()
    .replace(/[\x00-\x1f<>:"|?*]/g, "_")
    .slice(0, 180);
  return `${base.replace(/\.pdf$/i, "") || "document"}\.pdf`;
}
export function pdfBuffer(data) {
  if (
    !(data instanceof Uint8Array) ||
    data.byteLength < 5 ||
    data.byteLength > 512 * 1024 * 1024
  )
    throw new TypeError("Invalid PDF data");
  const bytes = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-")
    throw new TypeError("Only PDF files can be saved");
  return bytes;
}
