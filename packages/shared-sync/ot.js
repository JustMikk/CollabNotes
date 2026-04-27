function opLength(op) {
  if (op.insert) return String(op.insert).length;
  if (op.delete) return Number(op.delete) || 0;
  return Number(op.retain) || 0;
}

function normalize(ops = []) {
  return ops
    .map((op) => {
      if (op.insert != null) return { insert: String(op.insert) };
      if (op.delete != null) return { delete: Number(op.delete) || 0 };
      return { retain: Number(op.retain) || 0 };
    })
    .filter((op) => (op.insert ? op.insert.length : opLength(op) > 0));
}

function transformOperations(localOps = [], remoteOps = []) {
  const local = normalize(localOps);
  const remote = normalize(remoteOps);
  const transformed = [];

  let i = 0;
  let j = 0;

  while (i < local.length || j < remote.length) {
    const l = local[i];
    const r = remote[j];

    if (!r) {
      transformed.push(l);
      i += 1;
      continue;
    }
    if (!l) {
      if (r.insert) transformed.push({ retain: r.insert.length });
      j += 1;
      continue;
    }

    if (r.insert) {
      transformed.push({ retain: r.insert.length });
      j += 1;
      continue;
    }

    if (l.insert) {
      transformed.push(l);
      i += 1;
      continue;
    }

    const len = Math.min(opLength(l), opLength(r));
    if (l.retain) transformed.push({ retain: len });
    if (l.delete) transformed.push({ delete: len });

    if (l.retain) l.retain -= len;
    if (l.delete) l.delete -= len;
    if (r.retain) r.retain -= len;
    if (r.delete) r.delete -= len;

    if (opLength(l) === 0) i += 1;
    if (opLength(r) === 0) j += 1;
  }

  return normalize(transformed);
}

function applyOperations(content, operations = []) {
  let index = 0;
  let output = '';
  normalize(operations).forEach((op) => {
    if (op.retain) {
      output += content.slice(index, index + op.retain);
      index += op.retain;
      return;
    }
    if (op.insert) {
      output += op.insert;
      return;
    }
    if (op.delete) {
      index += op.delete;
    }
  });
  output += content.slice(index);
  return output;
}

module.exports = {
  transformOperations,
  applyOperations,
};
