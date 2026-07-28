function printable(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrap(value, length = 78) {
  const words = String(value).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const proposed = line ? `${line} ${word}` : word;
    if (proposed.length > length && line) {
      lines.push(line);
      line = word;
    } else {
      line = proposed;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function pageStream(lines) {
  const commands = ["BT", "/F1 10 Tf", "46 752 Td", "14 TL"];
  for (const line of lines) {
    commands.push(`(${printable(line)}) Tj`, "T*");
  }
  commands.push("ET");
  return commands.join("\n");
}

export function trustedSourcesPdf({ sources, version, updatedAt }) {
  const lines = [
    "Fact-Check — Approved Trusted Sources",
    `Registry version ${version} · Updated ${new Date(updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`,
    "",
    "This directory lists the sources currently approved by Fact-Check. A source being listed does not make every claim automatically true; each result shows its own evidence.",
    "Fact-Check links to original material and does not republish source text, images, logos, or database copies. Where source-use terms were reviewed, the official policy or licence is listed below.",
    "",
  ];

  sources.forEach((source, index) => {
    lines.push(`${String(index + 1).padStart(3, "0")}. ${source.name} [${source.category}]`);
    lines.push(...wrap(`     ${source.url}`, 88));
    lines.push(...wrap(`     Why it is listed: ${source.rationale}`, 88));
    if (source.usagePolicyUrl && source.usageStatus !== "legacy-review-pending") {
      const usageLabel = source.usageStatus === "reviewed-open-license"
        ? "Published reuse terms"
        : "Published source terms";
      lines.push(...wrap(`     ${usageLabel}: ${source.usagePolicyUrl}`, 88));
    }
    lines.push("");
  });

  const pages = [];
  for (let index = 0; index < lines.length; index += 47) pages.push(lines.slice(index, index + 47));

  const objects = [];
  const add = (body) => { objects.push(body); return objects.length; };
  const catalogId = add("");
  const pagesId = add("");
  const fontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds = [];

  for (const page of pages) {
    const stream = pageStream(page);
    const contentId = add(`<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let output = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output, "latin1"));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(output, "latin1");
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) output += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(output, "latin1");
}
