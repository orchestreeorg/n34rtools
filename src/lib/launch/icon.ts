export const ICON_PX = 64;
export const MAX_ICON_CHARS = 12_000;
export const MAX_SOURCE_BYTES = 400_000;

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

export function isTokenIconDataUrl(value: string): boolean {
  return /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml)/i.test(value);
}

export async function fileToTokenIcon(file: File): Promise<string> {
  const namedOk = /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);
  if (!ALLOWED_TYPES.has(file.type) && !namedOk) {
    throw new Error("Use PNG, JPEG, WebP, GIF, or SVG.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("Image is too large. Use a file under 400 KB.");
  }

  if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
    return svgFileToDataUrl(file);
  }

  return rasterFileToPngDataUrl(file);
}

function assertIconSize(icon: string) {
  if (!isTokenIconDataUrl(icon)) {
    throw new Error("Icon must be an on-chain image data URL.");
  }
  if (icon.length > MAX_ICON_CHARS) {
    throw new Error("That image is still too big after shrink. Try a simpler PNG or SVG.");
  }
}

async function svgFileToDataUrl(file: File): Promise<string> {
  const text = await file.text();
  if (/<script/i.test(text) || /\son\w+=/i.test(text)) {
    throw new Error("SVG cannot contain scripts.");
  }
  const icon = `data:image/svg+xml;utf8,${encodeURIComponent(text.trim())}`;
  assertIconSize(icon);
  return icon;
}

async function rasterFileToPngDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = ICON_PX;
  canvas.height = ICON_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image.");

  const scale = Math.max(ICON_PX / bitmap.width, ICON_PX / bitmap.height);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  ctx.drawImage(bitmap, (ICON_PX - width) / 2, (ICON_PX - height) / 2, width, height);
  bitmap.close();

  const png = canvas.toDataURL("image/png");
  if (png.length <= MAX_ICON_CHARS && isTokenIconDataUrl(png)) return png;

  const jpeg = canvas.toDataURL("image/jpeg", 0.72);
  assertIconSize(jpeg);
  return jpeg;
}
