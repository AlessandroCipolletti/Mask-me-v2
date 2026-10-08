import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const sampleShapes = [
  'eyeBlink_L',
  'eyeBlink_R',
  'jawOpen',
  'mouthSmile_L',
  'browInnerUp_L',
  'mouthFunnel',
  'mouthPucker',
];

function readObj(file) {
  const vertices = [];
  const faces = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line.startsWith('v ')) {
      const values = line.trim().split(/\s+/).slice(1, 4).map(Number);
      if (
        values.length !== 3 ||
        values.some((value) => !Number.isFinite(value))
      )
        throw new Error(`Invalid OBJ vertex in ${file}`);
      vertices.push(values);
    } else if (line.startsWith('f ')) {
      faces.push(
        line
          .trim()
          .split(/\s+/)
          .slice(1)
          .map((part) => Number(part.split('/')[0]) - 1),
      );
    }
  }
  return { vertices, faces };
}

function boundaryLoops(faces) {
  const edges = new Map();
  for (const face of faces) {
    for (let i = 0; i < face.length; i++) {
      const a = face[i],
        b = face[(i + 1) % face.length];
      const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
      const entry = edges.get(key);
      if (entry) entry.count++;
      else edges.set(key, { a, b, count: 1 });
    }
  }
  const neighbors = new Map();
  for (const { a, b, count } of edges.values()) {
    if (count !== 1) continue;
    if (!neighbors.has(a)) neighbors.set(a, new Set());
    if (!neighbors.has(b)) neighbors.set(b, new Set());
    neighbors.get(a).add(b);
    neighbors.get(b).add(a);
  }
  const seen = new Set();
  const loops = [];
  for (const start of neighbors.keys()) {
    if (seen.has(start)) continue;
    const stack = [start];
    const loop = [];
    seen.add(start);
    while (stack.length) {
      const current = stack.pop();
      loop.push(current);
      for (const next of neighbors.get(current)) {
        if (seen.has(next)) continue;
        seen.add(next);
        stack.push(next);
      }
    }
    loops.push(loop);
  }
  return loops.sort((a, b) => b.length - a.length);
}

/** Checks the real template files without copying their content into the project. */
export function inspectFaceKit(directory) {
  const neutral = readObj(join(directory, 'generic_neutral_mesh.obj'));
  const regions = [
    { name: 'narrow', faceCount: 6560 },
    { name: 'fullFace', faceCount: 9230 },
  ].map(({ name, faceCount }) => ({
    name,
    faceCount,
    boundaryLoops: boundaryLoops(neutral.faces.slice(0, faceCount)),
  }));
  const shapes = {};
  const neutralTopology = JSON.stringify(neutral.faces);
  for (const name of sampleShapes) {
    const shape = readObj(join(directory, `${name}.obj`));
    if (
      shape.vertices.length !== neutral.vertices.length ||
      JSON.stringify(shape.faces) !== neutralTopology
    )
      throw new Error(`${name} does not share neutral topology.`);
    shapes[name] = Object.fromEntries(
      regions.map((region) => {
        const outer = region.boundaryLoops[0];
        let maxDisplacement = 0;
        let verticesOverPointOne = 0;
        for (const id of outer) {
          const a = neutral.vertices[id],
            b = shape.vertices[id];
          const distance = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
          maxDisplacement = Math.max(maxDisplacement, distance);
          if (distance > 0.1) verticesOverPointOne++;
        }
        return [region.name, { maxDisplacement, verticesOverPointOne }];
      }),
    );
  }
  return {
    neutralVertices: neutral.vertices.length,
    neutralFaces: neutral.faces.length,
    regions: regions.map(({ name, faceCount, boundaryLoops: loops }) => ({
      name,
      faceCount,
      boundaryLoopSizes: loops.map((loop) => loop.length),
    })),
    shapes,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const directory = process.argv[2];
  if (!directory)
    throw new Error(
      'Usage: node scripts/m7-inspect-facekit.mjs <FaceXModel-dir>',
    );
  process.stdout.write(
    `${JSON.stringify(inspectFaceKit(directory), null, 2)}\n`,
  );
}
