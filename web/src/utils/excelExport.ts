/** 生成可被 Excel / WPS 打开的 SpreadsheetML（.xls），无需第三方依赖 */
export function downloadExcelRows(
  filename: string,
  sheetName: string,
  rows: Array<Array<string | number>>,
  opts?: { equalColumns?: boolean }
) {
  const escapeXml = (v: string | number) =>
    String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const colCount = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const equalW = Math.round(220 / Math.max(1, colCount));
  const colDefs =
    opts?.equalColumns && colCount > 0
      ? Array.from({ length: colCount }, () => `<Column ss:AutoFitWidth="0" ss:Width="${equalW}"/>`).join("")
      : "";

  const body = rows
    .map(
      (row) =>
        `<Row ss:AutoFitHeight="0" ss:Height="22">${row
          .map((cell) => {
            const isNum = typeof cell === "number" && Number.isFinite(cell);
            return `<Cell><Data ss:Type="${isNum ? "Number" : "String"}">${escapeXml(cell)}</Data></Cell>`;
          })
          .join("")}</Row>`
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="${escapeXml(sheetName)}">
  <Table>${colDefs}${body}</Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob(["\ufeff", xml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xls") || filename.endsWith(".xlsx") ? filename.replace(/\.xlsx$/i, ".xls") : `${filename}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** @deprecated 保留兼容；新导出请用 downloadPdfTable */
export function openPrintableTable(opts: {
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  void downloadPdfTable({
    filename: `${opts.title}.pdf`,
    title: opts.title,
    headers: opts.headers,
    rows: opts.rows,
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const raw = String(text ?? "").replace(/\r/g, "");
  if (!raw) return [""];
  const paragraphs = raw.split("\n");
  const lines: string[] = [];
  for (const para of paragraphs) {
    if (!para) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const ch of para) {
      const next = line + ch;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = ch;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [""];
}

function canvasToJpegBytes(canvas: HTMLCanvasElement, quality = 0.82): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error("无法生成图片"));
          return;
        }
        const buf = await blob.arrayBuffer();
        resolve(new Uint8Array(buf));
      },
      "image/jpeg",
      quality
    );
  });
}

/** 用页面图片拼成可下载的 PDF（支持中文，无第三方依赖） */
function buildPdfFromJpegPages(
  pages: Array<{ bytes: Uint8Array; width: number; height: number }>
): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let pos = 0;

  const push = (data: Uint8Array | string) => {
    const bytes = typeof data === "string" ? encoder.encode(data) : data;
    chunks.push(bytes);
    pos += bytes.length;
  };

  push("%PDF-1.4\n");

  const objStarts: number[] = [];
  const beginObj = (n: number) => {
    objStarts[n] = pos;
    push(`${n} 0 obj\n`);
  };
  const endObj = () => push("\nendobj\n");

  beginObj(1);
  push("<< /Type /Catalog /Pages 2 0 R >>");
  endObj();

  const pageCount = pages.length;
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  beginObj(2);
  push(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`);
  endObj();

  pages.forEach((page, i) => {
    const pageObj = 3 + i * 3;
    const contentObj = pageObj + 1;
    const imageObj = pageObj + 2;
    const w = page.width;
    const h = page.height;

    beginObj(pageObj);
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Contents ${contentObj} 0 R /Resources << /XObject << /Im${i} ${imageObj} 0 R >> >> >>`
    );
    endObj();

    const content = `q ${w} 0 0 ${h} 0 0 cm /Im${i} Do Q`;
    beginObj(contentObj);
    push(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`);
    endObj();

    beginObj(imageObj);
    push(
      `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`
    );
    push(page.bytes);
    push("\nendstream");
    endObj();
  });

  const xrefPos = pos;
  const maxObj = 2 + pageCount * 3;
  push(`xref\n0 ${maxObj + 1}\n`);
  push("0000000000 65535 f \n");
  for (let i = 1; i <= maxObj; i++) {
    push(`${String(objStarts[i] ?? 0).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${maxObj + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`);

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return new Blob([out], { type: "application/pdf" });
}

/**
 * 将表格渲染为 PDF 并直接下载 .pdf 文件（中文走浏览器字体，无额外依赖）
 */
export async function downloadPdfTable(opts: {
  filename: string;
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  const { title, headers, rows } = opts;
  const filename = opts.filename.endsWith(".pdf") ? opts.filename : `${opts.filename}.pdf`;

  const pageW = 794;
  const pageH = 1123;
  const margin = 36;
  const colCount = headers.length;
  const usable = pageW - margin * 2;
  // 等宽分列（音标/中文/英文）；若含「序号」则序号列略窄
  const hasIndex = headers[0] === "序号";
  const colWidths = (() => {
    if (!hasIndex) {
      const w = usable / Math.max(1, colCount);
      return headers.map(() => w);
    }
    const firstCol = Math.min(48, usable * 0.08);
    return headers.map((_, i) => (i === 0 ? firstCol : (usable - firstCol) / Math.max(1, colCount - 1)));
  })();

  const lineH = 18;
  const rowPad = 14;
  const font = '14px "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
  const fontBold = 'bold 14px "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
  const titleFont = 'bold 18px "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';

  const measureCtx = document.createElement("canvas").getContext("2d")!;
  measureCtx.font = font;

  const rowLineSets = rows.map((row) =>
    headers.map((_, ci) => wrapText(measureCtx, String(row[ci] ?? ""), colWidths[ci] - 12))
  );
  const rowHeights = rowLineSets.map((cells) =>
    Math.max(32, ...cells.map((ls) => ls.length * lineH + rowPad))
  );

  measureCtx.font = fontBold;
  const headerLines = headers.map((h, ci) => wrapText(measureCtx, h, colWidths[ci] - 12));
  const headerH = Math.max(32, ...headerLines.map((ls) => ls.length * lineH + rowPad));

  const pages: Array<{ bytes: Uint8Array; width: number; height: number }> = [];
  let rowIdx = 0;
  let isFirst = true;

  while (rowIdx < rows.length || isFirst) {
    const canvas = document.createElement("canvas");
    canvas.width = pageW;
    canvas.height = pageH;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageW, pageH);

    let y = margin;
    if (isFirst) {
      ctx.fillStyle = "#1a202c";
      ctx.font = titleFont;
      ctx.fillText(title, margin, y + 18);
      y += 36;
      isFirst = false;
    }

    const drawHeader = () => {
      let x = margin;
      ctx.fillStyle = "#edf2f7";
      ctx.fillRect(margin, y, usable, headerH);
      ctx.strokeStyle = "#cbd5e0";
      ctx.strokeRect(margin, y, usable, headerH);
      ctx.fillStyle = "#1a202c";
      ctx.font = fontBold;
      headers.forEach((_, ci) => {
        headerLines[ci].forEach((ln, li) => {
          ctx.fillText(ln, x + 6, y + 18 + li * lineH);
        });
        x += colWidths[ci];
      });
      y += headerH;
    };

    drawHeader();

    while (rowIdx < rows.length) {
      const rh = rowHeights[rowIdx];
      if (y + rh > pageH - margin) break;
      let x = margin;
      ctx.strokeStyle = "#cbd5e0";
      ctx.strokeRect(margin, y, usable, rh);
      ctx.fillStyle = "#1a202c";
      ctx.font = font;
      const cells = rowLineSets[rowIdx];
      cells.forEach((lines, ci) => {
        lines.forEach((ln, li) => {
          ctx.fillText(ln, x + 6, y + 18 + li * lineH);
        });
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + rh);
        ctx.stroke();
        x += colWidths[ci];
      });
      y += rh;
      rowIdx += 1;
    }

    const bytes = await canvasToJpegBytes(canvas);
    pages.push({ bytes, width: pageW, height: pageH });

    if (rowIdx >= rows.length) break;
  }

  const blob = buildPdfFromJpegPages(pages);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
