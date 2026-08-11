/** 生成可被 Excel / WPS 打开的 SpreadsheetML（.xls），无需第三方依赖 */
export function downloadExcelRows(filename: string, sheetName: string, rows: Array<Array<string | number>>) {
  const escapeXml = (v: string | number) =>
    String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const body = rows
    .map(
      (row) =>
        `<Row>${row
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
  <Table>${body}</Table>
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
