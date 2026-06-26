export function downloadTextFile(
  filename: string,
  contents: string,
  mimeType = 'text/plain',
): void {
  const blob = new Blob([contents], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, data: unknown): void {
  downloadTextFile(filename, JSON.stringify(data, null, 2), 'application/json');
}

export function downloadCsv(filename: string, csv: string): void {
  downloadTextFile(filename, csv, 'text/csv');
}
