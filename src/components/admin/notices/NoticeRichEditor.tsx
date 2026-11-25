import { useState, type ReactNode } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import { Placeholder } from '@tiptap/extensions';
import type { NoticeColor } from '../../../api/noticeApi';
import {
  createNoticeStarterKit,
  parseNoticeMarkdown,
  serializeNoticeDoc,
} from '../../notices/noticeMarkdown';
import {
  getNoticeContentFormat,
  getSafeNoticeHref,
  plainTextToNoticeDoc,
  stripNoticeMarker,
  toStoredNoticeContent,
} from '../../../utils/noticeContent';
import '../../notices/notice-body.css';

export type NoticeEditorChange = { content: string; isEmpty: boolean };

function initialDoc(content: string) {
  if (!content) return '';
  return getNoticeContentFormat(content) === 'markdown'
    ? parseNoticeMarkdown(stripNoticeMarker(content))
    : plainTextToNoticeDoc(content);
}

function toChange(editor: Editor): NoticeEditorChange {
  const doc = editor.getJSON();
  const blocks = [...(doc.content ?? [])];

  // 편집기가 목록·인용문 뒤에 자동으로 두는 빈 줄 등, 본문 끝의 빈 문단은 저장하지 않습니다.
  while (blocks.length > 1 && blocks.at(-1)?.type === 'paragraph' && !blocks.at(-1)?.content) {
    blocks.pop();
  }

  return {
    content: toStoredNoticeContent(serializeNoticeDoc({ ...doc, content: blocks })),
    isEmpty: !editor.getText().trim(),
  };
}

/** 'lib.hufs.ac.kr'처럼 프로토콜 없이 입력한 주소는 https로 봅니다. */
function normalizeLinkInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const ICON = { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': true } as const;
const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="notice-editor__tool"
      aria-label={label}
      title={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      // 버튼을 눌러도 본문 선택 영역이 풀리지 않게 합니다.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/**
 * 공지 본문 편집기. 툴바나 Markdown 단축 입력(## , - , 1. , > , **굵게**, *기울임*)으로 서식을 넣고,
 * 저장할 때는 Markdown 문자열로 바꿉니다. Enter는 새 줄, 빈 줄은 빈 줄로 남아 예전 입력창과 같게 동작합니다.
 */
export default function NoticeRichEditor({
  initialContent,
  color,
  hidden,
  onChange,
}: {
  initialContent: string;
  color: NoticeColor;
  hidden?: boolean;
  onChange: (change: NoticeEditorChange) => void;
}) {
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  const [linkError, setLinkError] = useState('');
  const editor = useEditor({
    extensions: [
      createNoticeStarterKit(),
      Placeholder.configure({ placeholder: '공지 내용을 입력하세요.' }),
    ],
    content: initialDoc(initialContent),
    editorProps: {
      attributes: {
        class: 'notice-editor__content',
        'aria-label': '공지 본문',
        'aria-multiline': 'true',
        role: 'textbox',
      },
    },
    onUpdate: ({ editor: current }) => onChange(toChange(current)),
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      paragraph: current.isActive('paragraph'),
      h2: current.isActive('heading', { level: 2 }),
      h3: current.isActive('heading', { level: 3 }),
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      bulletList: current.isActive('bulletList'),
      orderedList: current.isActive('orderedList'),
      blockquote: current.isActive('blockquote'),
      link: current.isActive('link'),
      href: (current.getAttributes('link').href as string | undefined) ?? '',
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });

  const chain = () => editor.chain().focus();

  const openLinkForm = () => {
    setLinkError('');
    setLinkDraft(state.href || '');
  };

  // 공지 작성 화면 전체가 <form>이라, 링크 입력은 중첩 form 없이 Enter·버튼으로 적용합니다.
  const applyLink = () => {
    const raw = normalizeLinkInput(linkDraft ?? '');
    const href = getSafeNoticeHref(raw);

    if (!href) {
      setLinkError('http(s)·mailto·tel 주소나 /로 시작하는 사이트 안 경로만 연결할 수 있습니다.');
      return;
    }

    if (editor.state.selection.empty && !editor.isActive('link')) {
      chain()
        .insertContent({ type: 'text', text: raw, marks: [{ type: 'link', attrs: { href } }] })
        .run();
    } else {
      chain().extendMarkRange('link').setLink({ href }).run();
    }
    setLinkDraft(null);
  };

  const removeLink = () => {
    chain().extendMarkRange('link').unsetLink().run();
    setLinkDraft(null);
  };

  return (
    <div className="notice-editor" hidden={hidden}>
      <div className="notice-editor__toolbar" role="toolbar" aria-label="본문 서식">
        <ToolButton
          label="일반 본문"
          active={state.paragraph && !state.bulletList && !state.orderedList && !state.blockquote}
          onClick={() => chain().setParagraph().run()}
        >
          <svg {...ICON}>
            <path {...STROKE} d="M3 4h10M3 8h10M3 12h6" />
          </svg>
        </ToolButton>
        <ToolButton
          label="제목 2"
          active={state.h2}
          onClick={() => chain().toggleHeading({ level: 2 }).run()}
        >
          <span className="notice-editor__tool-text">H2</span>
        </ToolButton>
        <ToolButton
          label="제목 3"
          active={state.h3}
          onClick={() => chain().toggleHeading({ level: 3 }).run()}
        >
          <span className="notice-editor__tool-text">H3</span>
        </ToolButton>
        <span className="notice-editor__divider" aria-hidden="true" />
        <ToolButton label="굵게" active={state.bold} onClick={() => chain().toggleBold().run()}>
          <svg {...ICON}>
            <path
              {...STROKE}
              strokeWidth={1.9}
              d="M5 3h4a2.5 2.5 0 0 1 0 5H5zM5 8h4.6a2.5 2.5 0 0 1 0 5H5z"
            />
          </svg>
        </ToolButton>
        <ToolButton
          label="기울임"
          active={state.italic}
          onClick={() => chain().toggleItalic().run()}
        >
          <svg {...ICON}>
            <path {...STROKE} d="M10 3H6.5M9.5 13H6M9 3 7 13" />
          </svg>
        </ToolButton>
        <ToolButton label="링크" active={state.link} onClick={openLinkForm}>
          <svg {...ICON}>
            <path
              {...STROKE}
              d="M6.5 9.5a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-.8.8M9.5 6.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l.8-.8"
            />
          </svg>
        </ToolButton>
        <span className="notice-editor__divider" aria-hidden="true" />
        <ToolButton
          label="글머리 기호 목록"
          active={state.bulletList}
          onClick={() => chain().toggleBulletList().run()}
        >
          <svg {...ICON}>
            <path {...STROKE} d="M6.5 4H13M6.5 8H13M6.5 12H13" />
            <circle cx="3.2" cy="4" r="1" fill="currentColor" />
            <circle cx="3.2" cy="8" r="1" fill="currentColor" />
            <circle cx="3.2" cy="12" r="1" fill="currentColor" />
          </svg>
        </ToolButton>
        <ToolButton
          label="번호 목록"
          active={state.orderedList}
          onClick={() => chain().toggleOrderedList().run()}
        >
          <svg {...ICON}>
            <path
              {...STROKE}
              d="M7 4h6M7 8h6M7 12h6M2.5 3l1-.5V6M2.3 9.2a1 1 0 0 1 1.8.5c0 .8-1.8 1.6-1.8 2.3h2"
            />
          </svg>
        </ToolButton>
        <ToolButton
          label="인용문"
          active={state.blockquote}
          onClick={() => chain().toggleBlockquote().run()}
        >
          <svg {...ICON}>
            <path {...STROKE} d="M3 3v10M6.5 5H13M6.5 8H13M6.5 11H11" />
          </svg>
        </ToolButton>
        <span className="notice-editor__divider" aria-hidden="true" />
        <ToolButton
          label="실행 취소"
          disabled={!state.canUndo}
          onClick={() => chain().undo().run()}
        >
          <svg {...ICON}>
            <path {...STROKE} d="M5.5 4 2.5 7l3 3M2.5 7H10a3.5 3.5 0 0 1 0 7H8" />
          </svg>
        </ToolButton>
        <ToolButton
          label="다시 실행"
          disabled={!state.canRedo}
          onClick={() => chain().redo().run()}
        >
          <svg {...ICON}>
            <path {...STROKE} d="m10.5 4 3 3-3 3M13.5 7H6a3.5 3.5 0 0 0 0 7h2" />
          </svg>
        </ToolButton>
      </div>

      {linkDraft !== null && (
        <div className="notice-editor__link" role="group" aria-label="링크 주소 입력">
          <input
            type="text"
            inputMode="url"
            aria-label="링크 주소"
            placeholder="https://lib.hufs.ac.kr/…"
            value={linkDraft}
            autoFocus
            onChange={(event) => {
              setLinkDraft(event.target.value);
              setLinkError('');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                applyLink();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                setLinkDraft(null);
                editor.commands.focus();
              }
            }}
          />
          <button type="button" className="admin-button" onClick={applyLink}>
            적용
          </button>
          {state.link && (
            <button type="button" className="admin-button" onClick={removeLink}>
              링크 해제
            </button>
          )}
          <button type="button" className="admin-button" onClick={() => setLinkDraft(null)}>
            취소
          </button>
          {linkError && (
            <p className="notice-editor__link-error" role="alert">
              {linkError}
            </p>
          )}
        </div>
      )}

      <div className="notice-editor__surface notice-body notice-body--rich" data-color={color}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
