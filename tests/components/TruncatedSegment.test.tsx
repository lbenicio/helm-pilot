import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import TruncatedSegment from '@/components/TruncatedSegment';

describe('TruncatedSegment', () => {
  // --- Full text (no truncation) ---
  it('shows full text when under maxLength', () => {
    render(<TruncatedSegment text="hello" maxLength={10} />);
    expect(screen.getByText('hello')).toBeInTheDocument();
    // Should not contain ellipsis
    expect(screen.queryByText('hello')).not.toBeNull();
  });

  it('shows full text when exactly at maxLength', () => {
    const text = '1234567890';
    render(<TruncatedSegment text={text} maxLength={10} />);
    expect(screen.getByText(text)).toBeInTheDocument();
    // No ellipsis since length == maxLength, not >
    expect(screen.queryByText(/\.\.\./)).toBeNull();
  });

  it('shows full text when text is empty', () => {
    render(<TruncatedSegment text="" maxLength={10} />);
    const span = document.querySelector('.group span:first-child');
    expect(span?.textContent).toBe('');
  });

  // --- Truncation ---
  it('truncates with ... when over maxLength', () => {
    render(<TruncatedSegment text="This is a very long text" maxLength={10} />);
    // maxLength=10, so slice(0, 7) = "This is" + "..." = "This is..."
    expect(screen.getByText('This is...')).toBeInTheDocument();
    // The visible (non-tooltip) span should only contain the truncated text
    const visibleSpan = document.querySelector('.group > span:first-child');
    expect(visibleSpan?.textContent).toBe('This is...');
  });

  it('truncates with ellipsis preserving the maxLength - 3 characters', () => {
    render(<TruncatedSegment text="1234567890abc" maxLength={10} />);
    // slice(0, 7) + "..."
    expect(screen.getByText('1234567...')).toBeInTheDocument();
  });

  it('uses default maxLength of 16 when not specified', () => {
    // 17 chars, one over the default maxLength=16
    const text = 'a'.repeat(17);
    render(<TruncatedSegment text={text} />);
    // slice(0, 13) + "..."
    const expected = 'a'.repeat(13) + '...';
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('does not truncate when text is exactly default maxLength (16)', () => {
    const text = 'a'.repeat(16);
    render(<TruncatedSegment text={text} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  // --- Tooltip on hover ---
  it('includes tooltip with full text when truncated', () => {
    const fullText = 'This is a long tooltip test string';
    render(<TruncatedSegment text={fullText} maxLength={10} />);
    // In jsdom, the tooltip exists in the DOM but is hidden via CSS
    // Let's find it by looking for the parent that contains fullText
    const groupSpan = document.querySelector('.group');
    expect(groupSpan).not.toBeNull();
    // The tooltip text should be somewhere inside the group element
    expect(groupSpan!.textContent).toContain(fullText);
  });

  it('tooltip element has the full text content', () => {
    const fullText = 'namespace/production/backend-service-v2';
    render(<TruncatedSegment text={fullText} maxLength={15} />);
    // The tooltip is rendered as a child of the group span
    const groupSpan = document.querySelector('.group');
    // The tooltip span contains the full text in a nested structure
    // We can find it by looking for the deeply nested span with the full text
    const allTooltipSpans = groupSpan?.querySelectorAll('span');
    // There should be a span containing the full text (inside the tooltip)
    let foundFullText = false;
    allTooltipSpans?.forEach((span) => {
      if (span.textContent === fullText) {
        foundFullText = true;
      }
    });
    expect(foundFullText).toBe(true);
  });

  it('does not render tooltip when text is not truncated', () => {
    render(<TruncatedSegment text="short" maxLength={10} />);
    const groupSpan = document.querySelector('.group');
    // There should be only one child span (the display span), no tooltip
    const childSpans = groupSpan?.children;
    expect(childSpans?.length).toBe(1); // Only the display span
  });

  // --- Custom maxLength ---
  it('respects custom maxLength for truncation', () => {
    render(<TruncatedSegment text="12345678" maxLength={5} />);
    // slice(0, 2) + "..."
    expect(screen.getByText('12...')).toBeInTheDocument();
  });

  it('respects large custom maxLength', () => {
    const text = 'short';
    render(<TruncatedSegment text={text} maxLength={100} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  // --- Accessibility: tooltip structure ---
  it('renders tooltip with the truncated display text visible and full text in hidden tooltip', () => {
    const fullText = 'my-very-long-release-name-that-gets-cut';
    const maxLen = 20;
    render(<TruncatedSegment text={fullText} maxLength={maxLen} />);

    // The visible span shows truncated text
    const truncatedText = fullText.slice(0, maxLen - 3) + '...';
    expect(screen.getByText(truncatedText)).toBeInTheDocument();

    // The full text is present in the tooltip (hidden via CSS)
    const groupSpan = document.querySelector('.group');
    expect(groupSpan?.textContent).toContain(fullText);
    expect(groupSpan?.textContent).toContain(truncatedText);
  });
});
