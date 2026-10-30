export function toCsv(rows: ReadonlyArray<ReadonlyArray<string | number>>) {
  const cell = (value: string | number) => {
    let text = String(value);
    if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}
export function downloadCsv(filename: string, rows: ReadonlyArray<ReadonlyArray<string | number>>) {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], {type:'text/csv;charset=utf-8'}));
  const link = document.createElement('a'); link.href=url; link.download=filename; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
