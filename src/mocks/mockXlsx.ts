/**
 * 목데이터 모드 전용 최소 xlsx(Office Open XML) 생성기.
 * 결과 보고서 화면을 로컬에서 확인할 때 엑셀에서 실제로 열리는 파일을 내려받게 합니다.
 * 압축 없이(STORE) ZIP으로 묶으며, 문자열은 inlineStr 셀로 저장해 학번·연락처의 앞자리 0이 숫자로 바뀌지 않습니다.
 * 운영 빌드에는 포함되지 않습니다(apiClient가 개발 서버의 목데이터 모드에서만 목 API를 불러옵니다).
 */

export type XlsxCell = string | number | null;

export type XlsxSheet = {
  name: string;
  rows: XlsxCell[][];
  /** 예: 'A1:I1' */
  merges?: string[];
  /** 셀 하이퍼링크. 예: { ref: 'B6', url: 'https://…' } */
  links?: { ref: string; url: string }[];
  /** 열 너비(문자 수 기준) */
  widths?: number[];
};

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 0부터 시작하는 열 번호를 A, B, …, AA 형식으로 바꿉니다. */
export function columnName(index: number) {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

function cellXml(value: XlsxCell, ref: string) {
  if (value === null || value === '') return '';
  if (typeof value === 'number') return `<c r="${ref}"><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function sheetXml(sheet: XlsxSheet) {
  const rows = sheet.rows
    .map((row, rowIndex) => {
      const cells = row.map((value, col) => cellXml(value, `${columnName(col)}${rowIndex + 1}`));
      return `<row r="${rowIndex + 1}">${cells.join('')}</row>`;
    })
    .join('');
  const cols = sheet.widths?.length
    ? `<cols>${sheet.widths
        .map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`)
        .join('')}</cols>`
    : '';
  const merges = sheet.merges?.length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges
        .map((ref) => `<mergeCell ref="${ref}"/>`)
        .join('')}</mergeCells>`
    : '';
  const links = sheet.links?.length
    ? `<hyperlinks>${sheet.links
        .map((link, i) => `<hyperlink ref="${link.ref}" r:id="rId${i + 1}"/>`)
        .join('')}</hyperlinks>`
    : '';
  return `${XML_HEAD}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">${cols}<sheetData>${rows}</sheetData>${merges}${links}</worksheet>`;
}

function sheetRelsXml(sheet: XlsxSheet) {
  const items = (sheet.links ?? [])
    .map(
      (link, i) =>
        `<Relationship Id="rId${i + 1}" Type="${NS_REL}/hyperlink" Target="${escapeXml(link.url)}" TargetMode="External"/>`,
    )
    .join('');
  return `${XML_HEAD}<Relationships xmlns="${NS_PKG_REL}">${items}</Relationships>`;
}

/** 시트 하나짜리 통합 문서의 파일 목록을 만듭니다. */
function workbookEntries(sheet: XlsxSheet): [string, string][] {
  const entries: [string, string][] = [
    [
      '[Content_Types].xml',
      `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>',
    ],
    [
      '_rels/.rels',
      `${XML_HEAD}<Relationships xmlns="${NS_PKG_REL}"><Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      'xl/workbook.xml',
      `${XML_HEAD}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets><sheet name="${escapeXml(sheet.name)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ],
    [
      'xl/_rels/workbook.xml.rels',
      `${XML_HEAD}<Relationships xmlns="${NS_PKG_REL}">` +
        `<Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="${NS_REL}/styles" Target="styles.xml"/>` +
        '</Relationships>',
    ],
    [
      'xl/styles.xml',
      `${XML_HEAD}<styleSheet xmlns="${NS_MAIN}">` +
        '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
        '</styleSheet>',
    ],
    ['xl/worksheets/sheet1.xml', sheetXml(sheet)],
  ];
  if (sheet.links?.length) {
    entries.push(['xl/worksheets/_rels/sheet1.xml.rels', sheetRelsXml(sheet)]);
  }
  return entries;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** 압축하지 않는(STORE) ZIP 파일을 만듭니다. */
function storeZip(files: [string, Uint8Array][]) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const [name, data] of files) {
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 파일 이름
    local.setUint16(8, 0, true); // STORE
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    chunks.push(new Uint8Array(local.buffer), nameBytes, data);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint16(10, 0, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, nameBytes.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), nameBytes);

    offset += 30 + nameBytes.length + data.length;
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const parts = [...chunks, ...central, new Uint8Array(end.buffer)];
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let position = 0;
  for (const part of parts) {
    output.set(part, position);
    position += part.length;
  }
  return output;
}

/** 시트 하나짜리 xlsx 파일 바이트를 만듭니다. */
export function buildXlsx(sheet: XlsxSheet) {
  const encoder = new TextEncoder();
  return storeZip(
    workbookEntries(sheet).map(
      ([name, xml]) => [name, encoder.encode(xml)] as [string, Uint8Array],
    ),
  );
}

/**
 * 업로드한 파일이 xlsx(ZIP 안에 xl/workbook.xml이 있는 파일)처럼 보이는지 확인합니다.
 * 목데이터 모드는 내용을 해석하지 않고 형식만 확인합니다.
 */
export function looksLikeXlsx(bytes: Uint8Array) {
  if (
    bytes.length < 4 ||
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b ||
    bytes[2] !== 3 ||
    bytes[3] !== 4
  ) {
    return false;
  }
  const marker = new TextEncoder().encode('xl/workbook.xml');
  outer: for (let i = 0; i + marker.length <= bytes.length; i += 1) {
    for (let j = 0; j < marker.length; j += 1) if (bytes[i + j] !== marker[j]) continue outer;
    return true;
  }
  return false;
}
