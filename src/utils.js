function placementLabel(score, total) {
  const pct = total > 0 ? (score / total) * 100 : 0;
  if (pct < 30) return "A1 (Beginner)";
  if (pct < 50) return "A2 (Elementary)";
  if (pct < 70) return "B1 (Intermediate)";
  if (pct < 85) return "B2 (Upper-Intermediate)";
  if (pct < 95) return "C1 (Advanced)";
  return "C2 (Proficiency)";
}

function chunkRows(items, perRow) {
  const rows = [];
  for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow));
  return rows;
}

module.exports = { placementLabel, chunkRows };
