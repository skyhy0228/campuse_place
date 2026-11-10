// 올릴 사진을 브라우저에서 다시 그린다. (교통여지도 spots.js 의 shrink)
// - 긴 변 1600px 이하, webp(안 되면 jpeg), 2MB 이하가 될 때까지 화질을 낮춘다.
// - 캔버스로 다시 그리므로 촬영 위치 같은 EXIF 정보가 남지 않는다.
const MAX_SIDE = 1600;
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const encode = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  for (const quality of [0.82, 0.72, 0.62, 0.5]) {
    let blob = await encode("image/webp", quality);
    // webp 를 못 만드는 브라우저는 png 로 돌려주므로 jpeg 로 바꾼다.
    if (!blob || blob.type !== "image/webp") blob = await encode("image/jpeg", quality);
    if (blob && blob.size <= MAX_PHOTO_BYTES) return blob;
  }
  throw new Error("too-large");
}

// 이메일·전화번호처럼 보이는 글자 (개인정보를 적지 않게 막는다)
export const CONTACT = /[\w.+-]+@[\w-]+\.[\w.]+|01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/;
