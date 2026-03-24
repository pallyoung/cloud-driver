import { useMemo } from 'react';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import type { Extension } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { xml } from '@codemirror/lang-xml';
import { python } from '@codemirror/lang-python';
import { sql } from '@codemirror/lang-sql';
import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { search, highlightSelectionMatches } from '@codemirror/search';
import { tags } from '@lezer/highlight';
import { yaml as yamlMode } from '@codemirror/legacy-modes/mode/yaml';
import { properties } from '@codemirror/legacy-modes/mode/properties';
import { shell as shellMode } from '@codemirror/legacy-modes/mode/shell';
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile';

type CodeEditorProps = {
  ariaLabel: string;
  fileName: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  wrap?: boolean;
  autoFocus?: boolean;
  minHeight?: string;
  maxHeight?: string;
  placeholder?: string;
  testId?: string;
};

type SupportedFormatParser =
  | 'json'
  | 'babel'
  | 'typescript'
  | 'css'
  | 'html'
  | 'markdown'
  | 'yaml';

const languageLabels: Record<string, string> = {
  '.bash': 'Shell',
  '.bashrc': 'Shell',
  '.conf': 'Config',
  '.css': 'CSS',
  '.dockerfile': 'Dockerfile',
  '.env': 'Env',
  '.html': 'HTML',
  '.htm': 'HTML',
  '.ini': 'INI',
  '.java': 'Java',
  '.js': 'JavaScript',
  '.json': 'JSON',
  '.jsx': 'React JSX',
  '.log': 'Log',
  '.md': 'Markdown',
  '.py': 'Python',
  '.sh': 'Shell',
  '.sql': 'SQL',
  '.svg': 'SVG',
  '.ts': 'TypeScript',
  '.tsx': 'React TSX',
  '.txt': 'Plain Text',
  '.xml': 'XML',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.zsh': 'Shell',
  '.zshrc': 'Shell',
};

const editorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    color: '#1C1917',
    fontSize: '13px',
  },
  '.cm-editor': {
    backgroundColor: 'transparent',
  },
  '.cm-scroller': {
    fontFamily: 'IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    lineHeight: '1.7',
    overflow: 'auto',
  },
  '.cm-content': {
    caretColor: '#0F766E',
    padding: '16px',
  },
  '.cm-focused': {
    outline: 'none',
  },
  '.cm-line': {
    paddingInline: '4px',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(15, 118, 110, 0.08)',
  },
  '.cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'rgba(15, 118, 110, 0.18) !important',
  },
  '.cm-gutters': {
    backgroundColor: 'rgba(255, 253, 248, 0.96)',
    color: '#8A7F71',
    borderRight: '1px solid #D9D1C3',
    minWidth: '56px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(15, 118, 110, 0.08)',
    color: '#0F766E',
  },
  '.cm-panel': {
    backgroundColor: '#FFFDF8',
    color: '#1C1917',
    borderColor: '#D9D1C3',
  },
  '.cm-search': {
    padding: '10px 12px',
  },
  '.cm-search input': {
    borderRadius: '12px',
    border: '1px solid #D9D1C3',
    padding: '6px 10px',
  },
  '.cm-button': {
    borderRadius: '999px',
    border: '1px solid #D9D1C3',
    backgroundColor: '#F4F0E8',
  },
});

const editorHighlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier], color: '#0F766E', fontWeight: '700' },
  { tag: [tags.string, tags.special(tags.string)], color: '#B45309' },
  { tag: [tags.number, tags.bool, tags.null], color: '#C96B32', fontWeight: '600' },
  { tag: [tags.comment], color: '#8A7F71', fontStyle: 'italic' },
  { tag: [tags.propertyName, tags.attributeName], color: '#1D4ED8' },
  { tag: [tags.typeName, tags.className], color: '#7C3AED', fontWeight: '600' },
  { tag: [tags.operator, tags.punctuation], color: '#57534E' },
  { tag: [tags.heading], color: '#1C1917', fontWeight: '700' },
  { tag: [tags.link], color: '#0F766E', textDecoration: 'underline' },
]);

function getFileTypeKey(fileName: string): string {
  const normalized = fileName.toLowerCase();

  if (normalized === 'dockerfile') {
    return '.dockerfile';
  }

  const lastDotIndex = normalized.lastIndexOf('.');
  return lastDotIndex >= 0 ? normalized.slice(lastDotIndex) : '';
}

function getLanguageExtension(fileName: string): Extension | null {
  switch (getFileTypeKey(fileName)) {
    case '.md':
      return markdown();
    case '.json':
      return json();
    case '.js':
      return javascript();
    case '.jsx':
      return javascript({ jsx: true });
    case '.ts':
      return javascript({ typescript: true });
    case '.tsx':
      return javascript({ jsx: true, typescript: true });
    case '.html':
    case '.htm':
      return html();
    case '.css':
      return css();
    case '.xml':
    case '.svg':
      return xml();
    case '.py':
      return python();
    case '.yaml':
    case '.yml':
      return StreamLanguage.define(yamlMode);
    case '.ini':
    case '.conf':
    case '.env':
      return StreamLanguage.define(properties);
    case '.sh':
    case '.bash':
    case '.zsh':
    case '.bashrc':
    case '.zshrc':
      return StreamLanguage.define(shellMode);
    case '.dockerfile':
      return StreamLanguage.define(dockerFile);
    case '.sql':
      return sql();
    default:
      return null;
  }
}

export function getEditorLanguageLabel(fileName: string): string {
  return languageLabels[getFileTypeKey(fileName)] ?? 'Plain Text';
}

export function getDefaultWrapMode(fileName: string): boolean {
  return ['.md', '.txt', '.log', '.yaml', '.yml', '.ini', '.conf', '.env'].includes(
    getFileTypeKey(fileName),
  );
}

export function canFormatInBrowser(fileName: string): boolean {
  return Boolean(getFormatConfig(fileName));
}

export function getEditorFormatLabel(fileName: string): string {
  return `Format ${getEditorLanguageLabel(fileName)}`;
}

function getFormatConfig(fileName: string): { parser: SupportedFormatParser } | null {
  switch (getFileTypeKey(fileName)) {
    case '.json':
      return { parser: 'json' };
    case '.js':
    case '.jsx':
      return { parser: 'babel' };
    case '.ts':
    case '.tsx':
      return { parser: 'typescript' };
    case '.css':
      return { parser: 'css' };
    case '.html':
    case '.htm':
      return { parser: 'html' };
    case '.md':
      return { parser: 'markdown' };
    case '.yaml':
    case '.yml':
      return { parser: 'yaml' };
    default:
      return null;
  }
}

let prettierLoader:
  | Promise<{
      prettier: { format: (source: string, options: Record<string, unknown>) => Promise<string> };
      plugins: Array<Record<string, unknown>>;
    }>
  | null = null;

async function loadPrettierModules() {
  if (!prettierLoader) {
    prettierLoader = (async () => {
      const [
        prettierModule,
        babelPlugin,
        estreePlugin,
        htmlPlugin,
        markdownPlugin,
        postcssPlugin,
        typescriptPlugin,
        yamlPlugin,
      ] = await Promise.all([
        import('prettier/standalone'),
        import('prettier/plugins/babel'),
        import('prettier/plugins/estree'),
        import('prettier/plugins/html'),
        import('prettier/plugins/markdown'),
        import('prettier/plugins/postcss'),
        import('prettier/plugins/typescript'),
        import('prettier/plugins/yaml'),
      ]);

      return {
        prettier: (prettierModule.default ?? prettierModule) as {
          format: (source: string, options: Record<string, unknown>) => Promise<string>;
        },
        plugins: [
          babelPlugin.default ?? babelPlugin,
          estreePlugin.default ?? estreePlugin,
          htmlPlugin.default ?? htmlPlugin,
          markdownPlugin.default ?? markdownPlugin,
          postcssPlugin.default ?? postcssPlugin,
          typescriptPlugin.default ?? typescriptPlugin,
          yamlPlugin.default ?? yamlPlugin,
        ],
      };
    })();
  }

  return prettierLoader;
}

export async function formatContentInBrowser(input: {
  fileName: string;
  content: string;
  lineEnding?: 'lf' | 'crlf' | null;
}): Promise<string> {
  const config = getFormatConfig(input.fileName);

  if (!config) {
    return input.content;
  }

  const { plugins, prettier } = await loadPrettierModules();

  return prettier.format(input.content, {
    parser: config.parser,
    plugins,
    endOfLine: input.lineEnding === 'crlf' ? 'crlf' : 'lf',
    proseWrap: 'preserve',
    tabWidth: 2,
    singleQuote: true,
  });
}

export function CodeEditor({
  ariaLabel,
  autoFocus = false,
  fileName,
  maxHeight,
  minHeight = '320px',
  onChange,
  placeholder,
  readOnly = false,
  testId,
  value,
  wrap = false,
}: CodeEditorProps) {
  const extensions = useMemo(() => {
    const languageExtension = getLanguageExtension(fileName);

    return [
      editorTheme,
      syntaxHighlighting(editorHighlightStyle),
      search({ top: true }),
      highlightSelectionMatches(),
      EditorView.contentAttributes.of({
        'aria-label': ariaLabel,
        'data-testid': testId ?? '',
        spellcheck: 'false',
      }),
      wrap ? EditorView.lineWrapping : [],
      languageExtension ?? [],
    ];
  }, [ariaLabel, fileName, testId, wrap]);

  return (
    <CodeMirror
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      basicSetup={{
        autocompletion: !readOnly,
        bracketMatching: true,
        closeBrackets: !readOnly,
        closeBracketsKeymap: !readOnly,
        defaultKeymap: true,
        dropCursor: !readOnly,
        foldGutter: false,
        highlightActiveLine: !readOnly,
        highlightActiveLineGutter: !readOnly,
        history: !readOnly,
        indentOnInput: !readOnly,
        lineNumbers: true,
        searchKeymap: true,
      }}
      editable={!readOnly}
      extensions={extensions}
      maxHeight={maxHeight}
      minHeight={minHeight}
      onChange={onChange}
      placeholder={placeholder}
      readOnly={readOnly}
      theme="none"
      value={value}
    />
  );
}
