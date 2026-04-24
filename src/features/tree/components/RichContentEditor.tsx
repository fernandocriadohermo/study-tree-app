import { Extension } from '@tiptap/core';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useMemo, useRef, useState } from 'react';

interface RichContentEditorProps {
    value: string;
    disabled: boolean;
    placeholder?: string;
    ariaLabelledBy?: string;
    onChange: (nextHtml: string) => void;
}

const FontStyleExtension = Extension.create({
    name: 'fontStyleExtension',

    addGlobalAttributes() {
        return [
            {
                types: ['textStyle'],
                attributes: {
                    fontSize: {
                        default: null,
                        parseHTML: (element) => element.style.fontSize || null,
                        renderHTML: (attributes) => {
                            if (!attributes.fontSize) {
                                return {};
                            }

                            return {
                                style: `font-size: ${attributes.fontSize}`,
                            };
                        },
                    },
                    fontFamily: {
                        default: null,
                        parseHTML: (element) => element.style.fontFamily || null,
                        renderHTML: (attributes) => {
                            if (!attributes.fontFamily) {
                                return {};
                            }

                            return {
                                style: `font-family: ${attributes.fontFamily}`,
                            };
                        },
                    },
                },
            },
        ];
    },
});

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function looksLikeHtml(value: string): boolean {
    const trimmed = value.trim();

    if (!trimmed) {
        return false;
    }

    return /<\/?(p|div|br|strong|b|em|i|u|ul|ol|li|h1|h2|h3|span|blockquote)\b/i.test(trimmed);
}

function textToSimpleHtml(value: string): string {
    const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const paragraphs = normalized
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter((paragraph) => paragraph.length > 0);

    if (paragraphs.length === 0) {
        return '<p></p>';
    }

    return paragraphs
        .map((paragraph) => {
            const escapedParagraph = escapeHtml(paragraph).replace(/\n/g, '<br />');

            return `<p>${escapedParagraph}</p>`;
        })
        .join('');
}

function normalizeIncomingContent(value: string): string {
    const trimmed = value.trim();

    if (!trimmed) {
        return '<p></p>';
    }

    if (looksLikeHtml(trimmed)) {
        return trimmed;
    }

    return textToSimpleHtml(value);
}

export function RichContentEditor({
    value,
    disabled,
    placeholder,
    ariaLabelledBy,
    onChange,
}: RichContentEditorProps) {
    const [isEditorFocused, setIsEditorFocused] = useState(false);
    const [, setEditorStateVersion] = useState(0);
    const refreshFrameRef = useRef<number | null>(null);

    const normalizedInitialContent = useMemo(() => {
        return normalizeIncomingContent(value);
    }, [value]);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                underline: false,
            }),
            TextStyle,
            FontStyleExtension,
            Color,
            Highlight,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Underline,
        ],
        editorProps: {
            attributes: {
                class: 'rich-content-editor__content',
                'data-placeholder': placeholder ?? '',
                'aria-labelledby': ariaLabelledBy ?? '',
                role: 'textbox',
                spellcheck: 'false',
            },
        },
        content: normalizedInitialContent,
        editable: !disabled,
        onFocus: () => {
            setIsEditorFocused(true);
        },
        onBlur: () => {
            setIsEditorFocused(false);
        },
        onUpdate: ({ editor: currentEditor }) => {
            onChange(currentEditor.getHTML());
        },
    });

    useEffect(() => {
        if (!editor) {
            return;
        }

        const refreshToolbarState = () => {
            if (refreshFrameRef.current !== null) {
                window.cancelAnimationFrame(refreshFrameRef.current);
            }

            refreshFrameRef.current = window.requestAnimationFrame(() => {
                refreshFrameRef.current = null;
                setEditorStateVersion((currentVersion) => currentVersion + 1);
            });
        };

        editor.on('selectionUpdate', refreshToolbarState);
        editor.on('transaction', refreshToolbarState);
        editor.on('focus', refreshToolbarState);
        editor.on('blur', refreshToolbarState);

        return () => {
            editor.off('selectionUpdate', refreshToolbarState);
            editor.off('transaction', refreshToolbarState);
            editor.off('focus', refreshToolbarState);
            editor.off('blur', refreshToolbarState);

            if (refreshFrameRef.current !== null) {
                window.cancelAnimationFrame(refreshFrameRef.current);
                refreshFrameRef.current = null;
            }
        };
    }, [editor]);

    useEffect(() => {
        if (!editor) {
            return;
        }

        editor.setEditable(!disabled);
    }, [disabled, editor]);

    useEffect(() => {
        if (!editor) {
            return;
        }

        const nextNormalizedContent = normalizeIncomingContent(value);
        const currentHtml = editor.getHTML();

        if (currentHtml === nextNormalizedContent) {
            return;
        }

        editor.commands.setContent(nextNormalizedContent, {
            emitUpdate: false,
        });
    }, [editor, value]);

    if (!editor) {
        return null;
    }

    const getToolbarButtonClassName = (isActive: boolean): string => {
        return `rich-content-editor__toolbar-button${isEditorFocused && isActive ? ' is-active' : ''}`;
    };

    return (
        <div className="rich-content-editor">
            <div className="rich-content-editor__toolbar" aria-label="Formato del contenido">
                <button
                    type="button"
                    className={getToolbarButtonClassName(editor.isActive('bold'))}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    disabled={disabled}
                    title="Negrita"
                    aria-label="Negrita"
                >
                    <strong>N</strong>
                </button>

                <button
                    type="button"
                    className={getToolbarButtonClassName(editor.isActive('italic'))}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    disabled={disabled}
                    title="Cursiva"
                    aria-label="Cursiva"
                >
                    <em>K</em>
                </button>

                <button
                    type="button"
                    className={getToolbarButtonClassName(editor.isActive('underline'))}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    disabled={disabled}
                    title="Subrayado"
                    aria-label="Subrayado"
                >
                    <span className="rich-content-editor__toolbar-underlined">S</span>
                </button>

                <button
                    type="button"
                    className={getToolbarButtonClassName(editor.isActive('bulletList'))}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    disabled={disabled}
                    title="Lista con viñetas"
                    aria-label="Lista con viñetas"
                >
                    • Lista
                </button>

                <button
                    type="button"
                    className={getToolbarButtonClassName(editor.isActive('orderedList'))}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    disabled={disabled}
                    title="Lista numerada"
                    aria-label="Lista numerada"
                >
                    1. Lista
                </button>

                <button
                    type="button"
                    className={getToolbarButtonClassName(editor.isActive({ textAlign: 'left' }))}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    disabled={disabled}
                    title="Alinear a la izquierda"
                    aria-label="Alinear a la izquierda"
                >
                    Izq.
                </button>

                <button
                    type="button"
                    className={getToolbarButtonClassName(editor.isActive({ textAlign: 'center' }))}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    disabled={disabled}
                    title="Centrar"
                    aria-label="Centrar"
                >
                    Centro
                </button>

                <button
                    type="button"
                    className={getToolbarButtonClassName(editor.isActive({ textAlign: 'right' }))}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    disabled={disabled}
                    title="Alinear a la derecha"
                    aria-label="Alinear a la derecha"
                >
                    Dcha.
                </button>
            </div>

            <div className="rich-content-editor__surface">
                <EditorContent editor={editor} />
            </div>
        </div>
    );
}