import { translateNotice } from './noticeKo';

/**
 * DOM-level notice translation — watches Obsidian's notice container and
 * swaps known English texts for Korean. Zero upstream diff; unmatched
 * notices stay English (fail-open). Structured notices (with buttons or
 * child elements) are left untouched.
 */
export class NoticeTranslator {
  private bodyObserver: MutationObserver | null = null;
  private containerObserver: MutationObserver | null = null;

  start(): void {
    if (this.bodyObserver) return;

    const existingContainer = document.body.querySelector('.notice-container');
    if (existingContainer) this.observeContainer(existingContainer);

    this.bodyObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (!(node.instanceOf(HTMLElement))) continue;
          if (node.classList.contains('notice')) {
            this.translate(node);
          } else if (node.classList.contains('notice-container')) {
            this.observeContainer(node);
            node.querySelectorAll('.notice').forEach((el) => this.translate(el));
          }
        }
      }
    });
    this.bodyObserver.observe(document.body, { childList: true });
  }

  stop(): void {
    this.bodyObserver?.disconnect();
    this.containerObserver?.disconnect();
    this.bodyObserver = null;
    this.containerObserver = null;
  }

  private observeContainer(container: Node): void {
    this.containerObserver?.disconnect();
    this.containerObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node.instanceOf(HTMLElement) && node.classList.contains('notice')) {
            this.translate(node);
          }
        }
      }
    });
    this.containerObserver.observe(container, { childList: true });
  }

  private translate(noticeEl: Element): void {
    try {
      if (noticeEl.childElementCount > 1) return; // structured notice — leave alone
      const messageEl = noticeEl.childElementCount === 1 ? noticeEl.firstElementChild! : noticeEl;
      if (messageEl.childElementCount > 0) return;
      const translated = translateNotice(messageEl.textContent ?? '');
      if (translated) messageEl.textContent = translated;
    } catch {
      // translation must never break notices
    }
  }
}
