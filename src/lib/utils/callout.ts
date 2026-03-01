/**
 * Obsidian callout pre-processor.
 *
 * Transforms `> [!TYPE] Title` blockquote syntax into styled HTML divs
 * BEFORE the markdown is passed to marked(), so marked never sees them
 * as plain blockquotes.
 *
 * Supported types cover all Obsidian built-in callout types.
 * Any unknown type falls back to the 'note' style.
 *
 * Syntax:
 *   > [!note]
 *   > Content here.
 *
 *   > [!warning] Custom Title
 *   > Multiple lines
 *   > of body content.
 *
 *   > [!tip]+ Foldable expanded  (+ / - suffix ignored — always expanded)
 */

import { marked } from 'marked';

// ── Callout type registry ─────────────────────────────────────────────────────

interface CalloutMeta {
  icon: string;  // emoji
  color: string;  // hex
  defaultTitle: string;
}

const CALLOUT_META: Record<string, CalloutMeta> = {
  // Information
  note: { icon: '📝', color: '#4d9fff', defaultTitle: 'Note' },
  info: { icon: 'ℹ️', color: '#4d9fff', defaultTitle: 'Info' },
  abstract: { icon: '📄', color: '#4d9fff', defaultTitle: 'Abstract' },
  summary: { icon: '📄', color: '#4d9fff', defaultTitle: 'Summary' },
  tldr: { icon: '⚡', color: '#4d9fff', defaultTitle: 'TL;DR' },
  // Positive
  tip: { icon: '💡', color: '#4dffb8', defaultTitle: 'Tip' },
  hint: { icon: '💡', color: '#4dffb8', defaultTitle: 'Hint' },
  success: { icon: '✅', color: '#b8ff3a', defaultTitle: 'Success' },
  check: { icon: '✅', color: '#b8ff3a', defaultTitle: 'Check' },
  done: { icon: '✅', color: '#b8ff3a', defaultTitle: 'Done' },
  // Questions
  question: { icon: '❓', color: '#00f0ff', defaultTitle: 'Question' },
  help: { icon: '❓', color: '#00f0ff', defaultTitle: 'Help' },
  faq: { icon: '❓', color: '#00f0ff', defaultTitle: 'FAQ' },
  // Important / todo
  important: { icon: '❗', color: '#b44dff', defaultTitle: 'Important' },
  todo: { icon: '☑️', color: '#ffb84d', defaultTitle: 'Todo' },
  // Warnings
  warning: { icon: '⚠️', color: '#ffb84d', defaultTitle: 'Warning' },
  caution: { icon: '⚠️', color: '#ffb84d', defaultTitle: 'Caution' },
  attention: { icon: '⚠️', color: '#ffb84d', defaultTitle: 'Attention' },
  // Errors / failures
  failure: { icon: '✗', color: '#ff4d8b', defaultTitle: 'Failure' },
  fail: { icon: '✗', color: '#ff4d8b', defaultTitle: 'Fail' },
  missing: { icon: '✗', color: '#ff4d8b', defaultTitle: 'Missing' },
  danger: { icon: '🔥', color: '#ff5c3a', defaultTitle: 'Danger' },
  error: { icon: '🔥', color: '#ff5c3a', defaultTitle: 'Error' },
  bug: { icon: '🐛', color: '#ff5c3a', defaultTitle: 'Bug' },
  // Reference
  example: { icon: '📋', color: '#6b4dff', defaultTitle: 'Example' },
  definition: { icon: '📖', color: '#6b4dff', defaultTitle: 'Definition' },
  cite: { icon: '❝', color: '#8888aa', defaultTitle: 'Cite' },
  quote: { icon: '❝', color: '#8888aa', defaultTitle: 'Quote' },
};

const FALLBACK: CalloutMeta = { icon: '📝', color: '#4d9fff', defaultTitle: 'Note' };

// ── Pre-processor ─────────────────────────────────────────────────────────────

/**
 * Call this on raw markdown BEFORE passing to marked().
 * Returns markdown with callout blocks replaced by HTML divs.
 */
export function preprocessCallouts(markdown: string): string {
  const lines = markdown.split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Detect callout opening line: > [!TYPE] optional title
    // The +/- suffix (foldable) is stripped and ignored.
    const m = line.match(/^>\s*\[!([A-Za-z-]+)[+-]?\]\s*(.*)$/);

    if (m) {
      const rawType = m[1].toLowerCase().trim();
      const titleOverride = m[2].trim();
      const meta = CALLOUT_META[rawType] ?? FALLBACK;
      const title = titleOverride || meta.defaultTitle;

      // Consume all subsequent blockquote lines as body
      const bodyLines: string[] = [];
      i++;
      while (i < lines.length) {
        const next = lines[i];
        if (next.startsWith('> ') || next === '>') {
          bodyLines.push(next.replace(/^>\s?/, ''));
          i++;
        } else if (next.trim() === '' && i + 1 < lines.length && (lines[i + 1].startsWith('> ') || lines[i + 1] === '>')) {
          // Allow a blank line between blockquote lines (Obsidian does this)
          bodyLines.push('');
          i++;
        } else {
          break;
        }
      }

      // Render body as markdown (nested bold, links, code, etc.)
      const bodyMarkdown = bodyLines.join('\n').trim();
      const bodyHtml = bodyMarkdown ? (marked(bodyMarkdown) as string) : '';

      result.push(
        `<div class="callout callout-${rawType}" style="--callout-color:${meta.color}">` +
        `<div class="callout-title">` +
        `<span class="callout-icon" aria-hidden="true">${meta.icon}</span>` +
        `<span>${title}</span>` +
        `</div>` +
        (bodyHtml ? `<div class="callout-body">${bodyHtml}</div>` : '') +
        `</div>`
      );
    } else {
      result.push(line);
      i++;
    }
  }

  return result.join('\n');
}
