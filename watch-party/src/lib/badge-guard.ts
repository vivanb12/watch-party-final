// Defensive guard: removes any third-party "made with / edit with" badge that a
// hosting platform injects into the page at runtime (after the app has rendered).
// It never touches elements the app itself renders. A matching CSS rule in
// styles.css hides them instantly, before this script has a chance to run.

const SELECTOR = [
  '[id*="lovable" i]',
  '[class*="lovable" i]',
  "[data-lovable]",
  'a[href*="lovable.dev" i]',
  'iframe[src*="lovable" i]',
  '[id*="gpt-engineer" i]',
  '[class*="gptengineer" i]',
].join(",");

function sweep() {
  document.querySelectorAll(SELECTOR).forEach((el) => {
    // Never remove the document skeleton or the app root, whatever their attributes say.
    if (el === document.documentElement || el === document.body || el === document.head) return;
    el.remove();
  });
}

export function startBadgeGuard(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};

  sweep();

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      sweep();
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  return () => observer.disconnect();
}
