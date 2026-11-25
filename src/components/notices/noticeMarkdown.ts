import type { JSONContent } from '@tiptap/core';
import { MarkdownManager } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';
import { getSafeNoticeHref } from '../../utils/noticeContent';

/**
 * 공지 편집기와 공지 본문 표시가 함께 쓰는 Tiptap 구성.
 * 같은 구성으로 Markdown을 읽고 쓰므로 편집 화면·미리보기·게시 화면의 해석이 일치합니다.
 * 지원 서식: 문단, 제목(H2·H3), 굵게, 기울임, 글머리·번호 목록, 인용문, 링크, 줄바꿈.
 * 밑줄·취소선·코드·구분선은 표준 Markdown(CommonMark)으로 저장할 수 없거나 범위 밖이라 끕니다.
 */
export function createNoticeStarterKit() {
  return StarterKit.configure({
    heading: { levels: [2, 3] },
    code: false,
    codeBlock: false,
    strike: false,
    underline: false,
    horizontalRule: false,
    link: {
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      defaultProtocol: 'https',
      isAllowedUri: (url) => getSafeNoticeHref(url) !== null,
      HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
    },
  });
}

let manager: MarkdownManager | null = null;

function getManager() {
  // 표·취소선 등 GFM 확장은 쓰지 않고, 본문 속 주소가 저절로 링크로 바뀌지 않도록 CommonMark로만 읽습니다.
  manager ??= new MarkdownManager({
    extensions: [createNoticeStarterKit()],
    markedOptions: { gfm: false },
  });
  return manager;
}

export function parseNoticeMarkdown(markdown: string): JSONContent {
  return getManager().parse(markdown);
}

/*
 * 문단 첫 글자(또는 줄바꿈 바로 뒤 글자)가 '- ', '+ ', '1. ', '# '처럼 Markdown 블록 표시로 읽히면
 * 다시 불러올 때 목록·제목으로 바뀝니다. 직렬화 전에 그 글자만 임시 문자로 바꿔 두었다가
 * HTML 문자 참조(&#45; 등)로 저장해, 읽을 때는 같은 글자로 돌아오고 서식으로는 해석되지 않게 합니다.
 */
const LINE_START_ESCAPES: Record<string, string> = {
  '\ue001': '&#35;',
  '\ue002': '&#45;',
  '\ue003': '&#43;',
  '\ue004': '&#46;',
  '\ue005': '&#41;',
};
const PLACEHOLDER = { '#': '\ue001', '-': '\ue002', '+': '\ue003', '.': '\ue004', ')': '\ue005' };

function protectLineStart(text: string) {
  // 줄 앞 공백 4칸은 코드 블록으로 읽히므로 줄바꿈 없는 공백으로 바꿔 모양만 유지합니다.
  const value = text.replace(/^ +/, (spaces) => '\u00a0'.repeat(spaces.length));
  const marker = value.match(/^[#+-]/);

  if (marker) {
    return PLACEHOLDER[marker[0] as '#' | '+' | '-'] + value.slice(1);
  }

  return value.replace(
    /^(\d{1,9})([.)])/,
    (_, digits: string, mark: '.' | ')') => digits + PLACEHOLDER[mark],
  );
}

function protectBlockSyntax(node: JSONContent): JSONContent {
  if (node.type === 'paragraph' && node.content) {
    let lineStart = true;

    return {
      ...node,
      content: node.content.map((child) => {
        const next =
          lineStart && child.type === 'text' && child.text
            ? { ...child, text: protectLineStart(child.text) }
            : child;
        lineStart = child.type === 'hardBreak';
        return next;
      }),
    };
  }

  return node.content ? { ...node, content: node.content.map(protectBlockSyntax) } : node;
}

export function serializeNoticeDoc(doc: JSONContent): string {
  return getManager()
    .serialize(protectBlockSyntax(doc))
    .replace(/[\ue001-\ue005]/g, (placeholder) => LINE_START_ESCAPES[placeholder]);
}
