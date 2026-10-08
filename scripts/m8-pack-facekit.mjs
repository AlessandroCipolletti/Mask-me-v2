import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

const controls = {
  'eyes.left.blink': ['eyeBlink_L'],
  'eyes.right.blink': ['eyeBlink_R'],
  'brows.leftUp': ['browOuterUp_L'],
  'brows.rightUp': ['browOuterUp_R'],
  'brows.leftDown': ['browDown_L'],
  'brows.rightDown': ['browDown_R'],
  'brows.innerUp': ['browInnerUp_L', 'browInnerUp_R'],
  'jaw.open': ['jawOpen'],
  'mouth.close': ['mouthClose'],
  'mouth.smileLeft': ['mouthSmile_L'],
  'mouth.smileRight': ['mouthSmile_R'],
  'mouth.frownLeft': ['mouthFrown_L'],
  'mouth.frownRight': ['mouthFrown_R'],
  'mouth.funnel': ['mouthFunnel'],
  'mouth.pucker': ['mouthPucker'],
  'mouth.left': ['mouthLeft'],
  'mouth.right': ['mouthRight'],
  'mouth.upperUpLeft': ['mouthUpperUp_L'],
  'mouth.upperUpRight': ['mouthUpperUp_R'],
  'mouth.lowerDownLeft': ['mouthLowerDown_L'],
  'mouth.lowerDownRight': ['mouthLowerDown_R'],
  'cheeks.leftSquint': ['cheekSquint_L'],
  'cheeks.rightSquint': ['cheekSquint_R'],
};

function parseObj(file, withFaces) {
  const positions = [];
  const groups = new Map();
  let material = '';
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line.startsWith('v ')) {
      const point = line.trim().split(/\s+/).slice(1, 4).map(Number);
      if (
        point.length !== 3 ||
        point.some((number) => !Number.isFinite(number))
      )
        throw new Error(`Invalid vertex in ${file}`);
      positions.push(...point);
    } else if (withFaces && line.startsWith('usemtl ')) {
      material = line.slice(7).trim();
      if (!groups.has(material)) groups.set(material, []);
    } else if (withFaces && line.startsWith('f ')) {
      const face = line
        .trim()
        .split(/\s+/)
        .slice(1)
        .map((part) => Number(part.split('/')[0]) - 1);
      if (
        face.length < 3 ||
        face.some((index) => !Number.isInteger(index) || index < 0)
      )
        throw new Error(`Invalid face in ${file}`);
      const triangles = groups.get(material);
      if (!triangles) throw new Error(`Face without material in ${file}`);
      for (let i = 1; i < face.length - 1; i++)
        triangles.push(face[0], face[i], face[i + 1]);
    }
  }
  return { positions: Float32Array.from(positions), groups };
}

function packedBytes(facekitDirectory) {
  const license = readFileSync(join(facekitDirectory, '..', 'LICENSE'), 'utf8');
  if (
    !license.startsWith('MIT License') ||
    !license.includes('USC Institute for Creative Technologies')
  )
    throw new Error(
      'Expected the official MIT-licensed ICT FaceKit Light checkout.',
    );
  const neutral = parseObj(
    join(facekitDirectory, 'generic_neutral_mesh.obj'),
    true,
  );
  const vertexCount = neutral.positions.length / 3;
  const groups = [...neutral.groups].map(([name, indices]) => ({
    name,
    indices: Uint32Array.from(indices),
  }));
  const faceIndices = neutral.groups.get('M_Face');
  if (!faceIndices || faceIndices.length / 3 < 9000)
    throw new Error('ICT full-face material region is missing.');
  for (const { indices } of groups)
    if (indices.some((id) => id >= vertexCount))
      throw new Error('ICT mesh references an out-of-range vertex.');
  const faceVertexIds = Uint32Array.from(new Set(faceIndices).values());
  const shapeCache = new Map();
  function shape(name) {
    if (!shapeCache.has(name)) {
      const parsed = parseObj(join(facekitDirectory, `${name}.obj`), true);
      if (
        parsed.positions.length !== neutral.positions.length ||
        parsed.groups.size !== neutral.groups.size ||
        [...neutral.groups].some(([groupName, neutralIndices]) => {
          const indices = parsed.groups.get(groupName);
          return (
            !indices ||
            indices.length !== neutralIndices.length ||
            indices.some(
              (index, position) => index !== neutralIndices[position],
            )
          );
        })
      )
        throw new Error(`${name} does not share the neutral topology.`);
      shapeCache.set(name, parsed.positions);
    }
    return shapeCache.get(name);
  }
  const morphs = Object.entries(controls).map(([semantic, names]) => {
    const targets = names.map(shape);
    const delta = new Float32Array(faceVertexIds.length * 3);
    for (let i = 0; i < faceVertexIds.length; i++)
      for (let axis = 0; axis < 3; axis++) {
        const index = faceVertexIds[i] * 3 + axis;
        for (const target of targets)
          delta[i * 3 + axis] += target[index] - neutral.positions[index];
      }
    return { semantic, delta };
  });
  const landmarkIds = JSON.parse(
    readFileSync(join(facekitDirectory, 'vertex_indices.json'), 'utf8'),
  ).idx_to_landmark_verts;
  if (
    !Array.isArray(landmarkIds) ||
    landmarkIds.length !== 68 ||
    landmarkIds.some((id) => !Number.isInteger(id) || id >= vertexCount)
  )
    throw new Error('ICT 68-landmark map is invalid.');
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: join(facekitDirectory, '..'),
    encoding: 'utf8',
  }).trim();
  const header = {
    version: 1,
    source: 'USC-ICT/ICT-FaceKit Light',
    sourceCommit: commit,
    license: 'MIT',
    vertexCount,
    groups: groups.map(({ name, indices }) => ({
      name,
      triangleCount: indices.length / 3,
    })),
    faceVertexCount: faceVertexIds.length,
    morphNames: morphs.map(({ semantic }) => semantic),
    landmarkIds,
  };
  const json = Buffer.from(JSON.stringify(header));
  const padding = (4 - (json.length % 4)) % 4;
  const chunks = [
    neutral.positions,
    ...groups.map((group) => group.indices),
    faceVertexIds,
    ...morphs.map((morph) => morph.delta),
  ];
  const total =
    8 +
    json.length +
    padding +
    chunks.reduce((bytes, chunk) => bytes + chunk.byteLength, 0);
  const output = Buffer.alloc(total);
  output.write('FCT1', 0, 4, 'ascii');
  output.writeUInt32LE(json.length, 4);
  json.copy(output, 8);
  let offset = 8 + json.length + padding;
  for (const chunk of chunks) {
    Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength).copy(
      output,
      offset,
    );
    offset += chunk.byteLength;
  }
  return { output, header };
}

const source = process.argv[2];
const destination = process.argv[3];
if (!source || !destination)
  throw new Error(
    'Usage: node scripts/m8-pack-facekit.mjs <FaceXModel directory> <output.bin>',
  );
const { output, header } = packedBytes(source);
mkdirSync(dirname(destination), { recursive: true });
writeFileSync(destination, output);
const digest = createHash('sha256').update(output).digest('hex');
process.stdout.write(
  JSON.stringify({ bytes: output.length, sha256: digest, ...header }, null, 2) +
    '\n',
);
