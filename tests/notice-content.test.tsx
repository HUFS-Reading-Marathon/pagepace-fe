import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import NoticeBody from '../src/components/notices/NoticeBody';
import NoticeMarkdownContent from '../src/components/notices/NoticeMarkdownContent';
import { parseNoticeMarkdown, serializeNoticeDoc } from '../src/components/notices/noticeMarkdown';
import {
  NOTICE_MARKDOWN_MARKER,
  getNoticeContentFormat,
  getSafeNoticeHref,
  plainTextToNoticeDoc,
  stripNoticeMarker,
  toStoredNoticeContent,
} from '../src/utils/noticeContent';

/** 비교용: 블록 종류와 글자·서식만 남깁니다(빈 content 배열 표기 차이는 무시). */
function outline(node: JSONContent): unknown {
  if (node.type === 'text') {
    return [node.text, (node.marks ?? []).map((mark) => [mark.type, mark.attrs?.href ?? null])];
  }
  return [node.type, node.attrs?.level ?? null, (node.content ?? []).map(outline)];
}

const roundTrip = (doc: JSONContent) => parseNoticeMarkdown(serializeNoticeDoc(doc));
const text = (value: string) => ({ type: 'text', text: value });
const paragraph = (...content: JSONContent[]) => ({ type: 'paragraph', content });

describe('공지 본문 형식', () => {
  it('표식이 있는 본문만 Markdown으로 보고, 저장·읽기에서 표식을 붙이고 뗀다', () => {
    const stored = toStoredNoticeContent('## 안내');
    expect(stored.startsWith(NOTICE_MARKDOWN_MARKER)).toBe(true);
    expect(getNoticeContentFormat(stored)).toBe('markdown');
    expect(stripNoticeMarker(stored)).toBe('## 안내');
    expect(getNoticeContentFormat('## 예전 일반 텍스트')).toBe('plain');
  });

  it('예전 일반 텍스트 공지를 편집기로 옮겨 저장해도 글자·줄·빈 줄·들여쓰기가 그대로 돌아온다', () => {
    const legacy = [
      '제6회 독서마라톤 안내',
      '    들여쓰기 네 칸',
      '  두 칸   가운데   공백',
      '- 대시로 시작',
      '+ 더하기로 시작',
      '1. 숫자로 시작',
      '2) 괄호 숫자',
      '# 샵으로 시작',
      '> 꺾쇠로 시작',
      '---',
      '`백틱` ```세 개',
      '*별* _밑줄_ **굵게** ~~취소~~',
      '<script>alert(1)</script> &amp; &lt;',
      'https://lib.hufs.ac.kr/global/very/long/url?with=params&and=more',
      '',
      '',
      '',
      '마지막 줄 😀',
    ].join('\n');
    const doc = plainTextToNoticeDoc(legacy);
    const restored = roundTrip(doc);

    expect(outline(restored)).toEqual(outline(doc));
    const lines = (restored.content ?? []).map((node) =>
      (node.content ?? [])
        .map((child) => child.text ?? '')
        .join('')
        .replace(/\u00a0/g, ' '),
    );
    expect(lines.join('\n')).toBe(legacy);
  });

  it('줄바꿈 뒤에 오는 목록·제목 기호도 서식으로 바뀌지 않는다', () => {
    const doc = {
      type: 'doc',
      content: [
        paragraph(
          text('첫 줄'),
          { type: 'hardBreak' },
          text('- 둘째 줄'),
          { type: 'hardBreak' },
          text('3. 셋째'),
        ),
      ],
    };
    expect(outline(roundTrip(doc))).toEqual(outline(doc));
  });

  it('제목·굵게·기울임·링크·목록·인용문·줄바꿈·연속 빈 줄을 저장 후 같은 구조로 읽는다', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [text('신청 안내')] },
        { type: 'heading', attrs: { level: 3 }, content: [text('세부 일정')] },
        paragraph(
          { ...text('굵게'), marks: [{ type: 'bold' }] },
          text(' 그리고 '),
          { ...text('기울임'), marks: [{ type: 'italic' }] },
          text(' '),
          {
            ...text('도서관'),
            marks: [{ type: 'link', attrs: { href: 'https://lib.hufs.ac.kr/global/' } }],
          },
        ),
        paragraph(text('한 문단 안'), { type: 'hardBreak' }, text('둘째 줄')),
        { type: 'paragraph' },
        { type: 'paragraph' },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [paragraph(text('하나'))] },
            { type: 'listItem', content: [paragraph(text('둘'))] },
          ],
        },
        {
          type: 'orderedList',
          content: [
            { type: 'listItem', content: [paragraph(text('첫째'))] },
            { type: 'listItem', content: [paragraph(text('둘째'))] },
          ],
        },
        { type: 'blockquote', content: [paragraph(text('인용문'))] },
        paragraph(text('끝')),
      ],
    };
    expect(outline(roundTrip(doc))).toEqual(outline(doc));
  });
});

describe('공지 링크 주소', () => {
  it('http·https·mailto·tel과 사이트 안 경로만 허용한다', () => {
    expect(getSafeNoticeHref('https://lib.hufs.ac.kr/global/')).toBe(
      'https://lib.hufs.ac.kr/global/',
    );
    expect(getSafeNoticeHref('mailto:library@hufs.ac.kr')).toBe('mailto:library@hufs.ac.kr');
    expect(getSafeNoticeHref('tel:02-2173-2969')).toBe('tel:02-2173-2969');
    expect(getSafeNoticeHref('/notices/3')).toBe('/notices/3');
    for (const unsafe of [
      'javascript:alert(1)',
      ' JavaScript:alert(1)',
      'java\tscript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      '//evil.example',
      'file:///etc/passwd',
      '',
    ]) {
      expect(getSafeNoticeHref(unsafe)).toBeNull();
    }
  });
});

describe('공지 본문 표시', () => {
  it('예전 일반 텍스트 공지는 입력한 그대로 보여 주고 태그는 글자로 둔다', () => {
    const html = renderToStaticMarkup(
      <NoticeBody content={'첫 줄\n\n- 목록 아님\n<script>alert(1)</script>'} color="RED" />,
    );
    expect(html).toContain('class="notice-body" data-color="RED"');
    expect(html).toContain('- 목록 아님');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('Markdown 공지는 서식을 그리되 HTML은 글자로, 위험한 링크는 링크 없이 보여 준다', () => {
    const markdown = [
      '## 신청 안내',
      '',
      '**굵게** *기울임* [도서관](https://lib.hufs.ac.kr/global/) [위험](javascript:alert(1)) [내부](/notices)',
      '',
      '&lt;img src=x onerror=alert(1)&gt; <b>태그</b>',
      '',
      '- 하나',
      '- 둘',
      '',
      '1. 첫째',
      '',
      '> 인용',
    ].join('\n');
    const html = renderToStaticMarkup(<NoticeMarkdownContent markdown={markdown} />);

    expect(html).toContain('<h2>신청 안내</h2>');
    expect(html).toContain('<strong>굵게</strong>');
    expect(html).toContain('<em>기울임</em>');
    expect(html).toContain(
      '<a href="https://lib.hufs.ac.kr/global/" target="_blank" rel="noopener noreferrer nofollow">도서관</a>',
    );
    expect(html).toContain('<a href="/notices">내부</a>');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>');
    expect(html).toContain('<ul><li><p>하나</p></li><li><p>둘</p></li></ul>');
    expect(html).toContain('<ol><li><p>첫째</p></li></ol>');
    expect(html).toContain('<blockquote><p>인용</p></blockquote>');
  });

  it('연속 빈 줄은 빈 문단으로 그려 게시 화면에서도 유지된다', () => {
    const doc = {
      type: 'doc',
      content: [
        paragraph(text('위')),
        { type: 'paragraph' },
        { type: 'paragraph' },
        paragraph(text('아래')),
      ],
    };
    const html = renderToStaticMarkup(<NoticeMarkdownContent markdown={serializeNoticeDoc(doc)} />);
    expect(html).toBe('<p>위</p><p></p><p></p><p>아래</p>');
  });
});
