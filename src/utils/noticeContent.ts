/**
 * 공지 본문 형식 판별.
 *
 * 공지 API의 content는 문자열 하나뿐이라, 새 편집기로 저장한 Markdown 본문은 첫 줄에 이 표식을 붙여
 * 기존 일반 텍스트 공지와 구분합니다. 표식이 없는 본문은 예전처럼 입력한 그대로(줄바꿈·공백 유지) 보여 주며,
 * '*', '#', '1.' 같은 글자가 뜻하지 않은 서식으로 바뀌지 않습니다.
 */
export const NOTICE_MARKDOWN_MARKER = '<!-- pagepace:markdown -->';

export type NoticeContentFormat = 'markdown' | 'plain';

export function getNoticeContentFormat(content: string): NoticeContentFormat {
  return content.startsWith(NOTICE_MARKDOWN_MARKER) ? 'markdown' : 'plain';
}

/** 표식을 뗀 Markdown 본문 */
export function stripNoticeMarker(content: string) {
  return content.startsWith(NOTICE_MARKDOWN_MARKER)
    ? content.slice(NOTICE_MARKDOWN_MARKER.length).replace(/^\r?\n/, '')
    : content;
}

/** 편집기에서 만든 Markdown을 저장할 본문으로 */
export function toStoredNoticeContent(markdown: string) {
  return `${NOTICE_MARKDOWN_MARKER}\n${markdown}`;
}

type PlainParagraph = { type: 'paragraph'; content?: { type: 'text'; text: string }[] };

/**
 * 기존 일반 텍스트 공지를 편집기 문서로 바꿉니다. 한 줄은 한 문단, 빈 줄은 빈 문단이 되어
 * 예전 화면(pre-wrap)과 같은 줄 구성을 유지합니다. 줄 앞 공백은 Markdown에서 코드 블록으로
 * 해석되지 않도록 줄바꿈 없는 공백(U+00A0)으로 바꿔 들여쓰기 모양만 남깁니다.
 */
export function plainTextToNoticeDoc(text: string): { type: 'doc'; content: PlainParagraph[] } {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');

  return {
    type: 'doc',
    content: lines.map((line) => {
      const value = line
        .replace(/\t/g, '    ')
        .replace(/^ +/, (spaces) => '\u00a0'.repeat(spaces.length));

      return value
        ? { type: 'paragraph', content: [{ type: 'text', text: value }] }
        : { type: 'paragraph' };
    }),
  };
}

const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * 공지 링크로 허용할 주소만 돌려줍니다. http(s)·mailto·tel과 사이트 안 경로(/...)만 허용하고
 * javascript:, data: 같은 주소는 null을 돌려줘 링크로 만들지 않습니다.
 */
export function getSafeNoticeHref(href: unknown): string | null {
  if (typeof href !== 'string') return null;

  const value = href.trim();

  // 제어 문자(탭·줄바꿈 등)가 섞인 주소는 'java\tscript:'처럼 검사를 우회할 수 있어 거절합니다.
  const hasControlCharacter = [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
  if (!value || hasControlCharacter) return null;
  if (value.startsWith('/') && !value.startsWith('//')) return value;

  try {
    const url = new URL(value);
    return SAFE_LINK_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
