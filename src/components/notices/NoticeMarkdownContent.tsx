import { Fragment, useMemo, type ReactNode } from 'react';
import type { JSONContent } from '@tiptap/core';
import { getSafeNoticeHref } from '../../utils/noticeContent';
import { parseNoticeMarkdown } from './noticeMarkdown';

/*
 * Markdown 공지 본문을 편집기와 같은 파서로 읽어 React 요소로 그립니다.
 * HTML 문자열을 삽입하지 않으므로 본문 속 태그·스크립트는 글자로만 보이고,
 * 링크는 허용한 주소(http·https·mailto·tel·사이트 안 경로)일 때만 만듭니다.
 */
function renderText(node: JSONContent, key: number): ReactNode {
  let element: ReactNode = node.text ?? '';

  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') element = <strong>{element}</strong>;
    else if (mark.type === 'italic') element = <em>{element}</em>;
    else if (mark.type === 'link') {
      const href = getSafeNoticeHref(mark.attrs?.href);
      if (href) {
        const external = !href.startsWith('/');
        element = (
          <a
            href={href}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}
          >
            {element}
          </a>
        );
      }
    }
  }

  return <Fragment key={key}>{element}</Fragment>;
}

function renderChildren(node: JSONContent) {
  return (node.content ?? []).map(renderNode);
}

function renderNode(node: JSONContent, key: number): ReactNode {
  switch (node.type) {
    case 'text':
      return renderText(node, key);
    case 'hardBreak':
      return <br key={key} />;
    case 'paragraph':
      return <p key={key}>{renderChildren(node)}</p>;
    case 'heading':
      return node.attrs?.level === 3 ? (
        <h3 key={key}>{renderChildren(node)}</h3>
      ) : (
        <h2 key={key}>{renderChildren(node)}</h2>
      );
    case 'bulletList':
      return <ul key={key}>{renderChildren(node)}</ul>;
    case 'orderedList': {
      const start = Number(node.attrs?.start ?? 1);
      return (
        <ol key={key} start={Number.isInteger(start) && start !== 1 ? start : undefined}>
          {renderChildren(node)}
        </ol>
      );
    }
    case 'listItem':
      return <li key={key}>{renderChildren(node)}</li>;
    case 'blockquote':
      return <blockquote key={key}>{renderChildren(node)}</blockquote>;
    default:
      // 지원하지 않는 블록은 글자만 남깁니다.
      return <Fragment key={key}>{renderChildren(node)}</Fragment>;
  }
}

export default function NoticeMarkdownContent({ markdown }: { markdown: string }) {
  const doc = useMemo(() => parseNoticeMarkdown(markdown), [markdown]);
  return <>{renderChildren(doc)}</>;
}
