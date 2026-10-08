import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** M7-only GLB topology probe. It reads bytes, never rewrites the original. */
export function inspectGlbBytes(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    bytes.length < 20 ||
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== bytes.length
  ) {
    throw new Error('Expected a complete GLB 2.0 container.');
  }
  const jsonLength = view.getUint32(12, true);
  if (
    view.getUint32(16, true) !== 0x4e4f534a ||
    20 + jsonLength + 8 > bytes.length
  )
    throw new Error('Invalid GLB JSON chunk.');
  const gltf = JSON.parse(
    new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)),
  );
  const binOffset = 20 + jsonLength;
  const binLength = view.getUint32(binOffset, true);
  if (
    view.getUint32(binOffset + 4, true) !== 0x004e4942 ||
    binOffset + 8 + binLength > bytes.length
  )
    throw new Error('Invalid GLB binary chunk.');
  const binaryStart = binOffset + 8;
  const accessors = gltf.accessors ?? [];
  const bufferViews = gltf.bufferViews ?? [];

  function accessor(id, expectedType) {
    const item = accessors[id];
    if (
      !item ||
      item.type !== expectedType ||
      item.sparse ||
      item.bufferView === undefined
    )
      throw new Error(`Unsupported ${expectedType} accessor.`);
    const source = bufferViews[item.bufferView];
    const components = expectedType === 'VEC3' ? 3 : 1;
    const size = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[item.componentType];
    if (!source || !size) throw new Error('Unsupported GLB component type.');
    const stride = source.byteStride ?? components * size;
    const start =
      binaryStart + (source.byteOffset ?? 0) + (item.byteOffset ?? 0);
    const end = start + (item.count - 1) * stride + components * size;
    if (item.count < 1 || end > binaryStart + binLength)
      throw new Error('Accessor exceeds the GLB binary chunk.');
    return (index, component = 0) => {
      const offset = start + index * stride + component * size;
      switch (item.componentType) {
        case 5121:
          return view.getUint8(offset);
        case 5123:
          return view.getUint16(offset, true);
        case 5125:
          return view.getUint32(offset, true);
        case 5126:
          return view.getFloat32(offset, true);
      }
    };
  }

  let vertices = 0;
  let triangles = 0;
  let morphTargets = 0;
  let indexedPrimitives = 0;
  const attributeSets = [];
  const positionBounds = [];
  let uniquePositions = 0;
  let rawComponents = 0;
  let weldedComponents = 0;
  const rawEdgeCounts = { boundary: 0, nonManifold: 0 };
  const weldedEdgeCounts = { boundary: 0, nonManifold: 0 };

  function unionFind(count) {
    const parent = new Uint32Array(count);
    for (let i = 0; i < count; i++) parent[i] = i;
    let components = count;
    const find = (value) => {
      while (parent[value] !== value) {
        parent[value] = parent[parent[value]];
        value = parent[value];
      }
      return value;
    };
    return {
      connect(a, b) {
        const aa = find(a);
        const bb = find(b);
        if (aa !== bb) {
          parent[bb] = aa;
          components--;
        }
      },
      get components() {
        return components;
      },
    };
  }

  function edge(map, a, b, vertexCount) {
    const key = Math.min(a, b) * vertexCount + Math.max(a, b);
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  function accumulateEdges(map, result) {
    for (const count of map.values()) {
      if (count === 1) result.boundary++;
      if (count > 2) result.nonManifold++;
    }
  }

  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      if (
        (primitive.mode ?? 4) !== 4 ||
        primitive.attributes?.POSITION === undefined
      )
        continue;
      const positions = accessors[primitive.attributes.POSITION],
        count = positions.count;
      attributeSets.push(Object.keys(primitive.attributes).sort());
      positionBounds.push({
        min: positions.min ?? null,
        max: positions.max ?? null,
      });
      const readPosition = accessor(primitive.attributes.POSITION, 'VEC3');
      const positionIds = new Map();
      const rawEdges = new Map();
      const weldedEdges = new Map();
      const localWeldIds = new Uint32Array(count);
      for (let i = 0; i < count; i++) {
        const key = `${readPosition(i, 0)},${readPosition(i, 1)},${readPosition(i, 2)}`;
        let id = positionIds.get(key);
        if (id === undefined) {
          id = positionIds.size;
          positionIds.set(key, id);
        }
        localWeldIds[i] = id;
      }
      const indices =
        primitive.indices === undefined ? null : accessors[primitive.indices];
      const readIndex = indices
        ? accessor(primitive.indices, 'SCALAR')
        : (i) => i;
      const indexCount = indices?.count ?? count;
      if (indexCount % 3)
        throw new Error('Triangle index count is not divisible by three.');
      const raw = unionFind(count);
      const welded = unionFind(positionIds.size);
      for (let i = 0; i < indexCount; i += 3) {
        const a = readIndex(i),
          b = readIndex(i + 1),
          c = readIndex(i + 2);
        if (a >= count || b >= count || c >= count)
          throw new Error('Triangle index exceeds the vertex count.');
        raw.connect(a, b);
        raw.connect(b, c);
        welded.connect(localWeldIds[a], localWeldIds[b]);
        welded.connect(localWeldIds[b], localWeldIds[c]);
        for (const [x, y] of [
          [a, b],
          [b, c],
          [c, a],
        ]) {
          edge(rawEdges, x, y, count);
          edge(weldedEdges, localWeldIds[x], localWeldIds[y], positionIds.size);
        }
      }
      vertices += count;
      uniquePositions += positionIds.size;
      triangles += indexCount / 3;
      morphTargets += primitive.targets?.length ?? 0;
      indexedPrimitives += Number(Boolean(indices));
      rawComponents += raw.components;
      weldedComponents += welded.components;
      accumulateEdges(rawEdges, rawEdgeCounts);
      accumulateEdges(weldedEdges, weldedEdgeCounts);
    }
  }
  return {
    bytes: bytes.length,
    generator: gltf.asset?.generator ?? null,
    meshCount: gltf.meshes?.length ?? 0,
    vertexCount: vertices,
    uniquePositionCount: uniquePositions,
    triangleCount: triangles,
    indexedPrimitives,
    morphTargets,
    skins: gltf.skins?.length ?? 0,
    animations: gltf.animations?.length ?? 0,
    images: gltf.images?.length ?? 0,
    imageDimensions: (gltf.images ?? []).map((image) => {
      if (image.bufferView === undefined) return null;
      const source = bufferViews[image.bufferView];
      if (!source) return null;
      const offset = binaryStart + (source.byteOffset ?? 0);
      const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
      if (
        image.mimeType !== 'image/png' ||
        source.byteLength < 24 ||
        offset + source.byteLength > binaryStart + binLength ||
        pngSignature.some(
          (byte, index) => view.getUint8(offset + index) !== byte,
        )
      )
        return null;
      return {
        width: view.getUint32(offset + 16, false),
        height: view.getUint32(offset + 20, false),
        compressedBytes: source.byteLength,
      };
    }),
    materials: gltf.materials?.length ?? 0,
    attributeSets,
    positionBounds,
    nodeRotations: (gltf.nodes ?? []).map((node) => node.rotation ?? null),
    rawComponents,
    weldedComponents,
    rawEdges: rawEdgeCounts,
    weldedEdges: weldedEdgeCounts,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const file = process.argv[2];
  if (!file)
    throw new Error('Usage: node scripts/m7-inspect-glb.mjs <path.glb>');
  process.stdout.write(
    `${JSON.stringify(inspectGlbBytes(readFileSync(file)), null, 2)}\n`,
  );
}
