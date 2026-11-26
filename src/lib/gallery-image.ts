export const GALLERY_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const MAX_GALLERY_IMAGE_BYTES = 20_000_000;
const MAX_UPLOAD_BYTES = 2_000_000;
const IMAGE_TYPES = new Set(GALLERY_IMAGE_ACCEPT.split(","));

export function validateGalleryImage(file: File) {
  if (!IMAGE_TYPES.has(file.type)) {
    throw new Error("Choose a JPEG, PNG or WebP photo.");
  }
  if (!file.size) throw new Error("This file is empty. Choose another photo.");
  if (file.size > MAX_GALLERY_IMAGE_BYTES) {
    throw new Error("Choose a photo smaller than 20 MB.");
  }
}

function readDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("The photo could not be read. Please choose it again."));
    reader.onerror = reader.onabort = () =>
      reject(new Error("The photo could not be read. Please choose it again."));
    reader.readAsDataURL(file);
  });
}

/** Keep the existing server upload limit while accepting full-size computer photos. */
export async function prepareGalleryImage(file: File): Promise<string> {
  validateGalleryImage(file);
  if (file.size <= MAX_UPLOAD_BYTES) return readDataUrl(file);

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error("This photo could not be opened. Choose another file."));
      image.src = objectUrl;
    });
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error("This photo could not be opened. Choose another file.");
    }
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Choose a photo smaller than 2 MB in this browser.");
    let scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
    for (let attempt = 0; attempt < 5; attempt++) {
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", Math.max(0.6, 0.88 - attempt * 0.06)),
      );
      if (!blob) throw new Error("The photo could not be prepared. Choose another file.");
      if (blob.size <= MAX_UPLOAD_BYTES) return await readDataUrl(blob);
      scale *= 0.8;
    }
    throw new Error("This photo is still too large. Choose a smaller version.");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
