export const MAX_GLB_BYTES = 150_000_000;

/** Check container before giving untrusted bytes to the glTF parser. */
export function validateGlbContainer(bytes: ArrayBuffer): void {
  if (bytes.byteLength < 20 || bytes.byteLength > MAX_GLB_BYTES)
    throw new Error('The GLB file has an invalid or excessive size.');
  const view = new DataView(bytes);
  if (
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== bytes.byteLength
  )
    throw new Error('The file is not a valid GLB 2.0 container.');
  const jsonLength = view.getUint32(12, true);
  if (
    view.getUint32(16, true) !== 0x4e4f534a ||
    jsonLength < 2 ||
    20 + jsonLength > bytes.byteLength
  )
    throw new Error('The GLB is missing its scene description.');
}
