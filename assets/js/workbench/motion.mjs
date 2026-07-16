const SURFACE_CLASS = "workbench-transition-surface";
const ROOT_CLASS = "workbench-local-transition";

export function transitionWorkspace(update, activeSelector, animate = true) {
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!animate || reducedMotion || typeof document.startViewTransition !== "function") {
    update();
    return null;
  }

  const root = document.documentElement;
  const current = document.querySelector(activeSelector);
  root.classList.add(ROOT_CLASS);
  current?.classList.add(SURFACE_CLASS);

  const cleanup = () => {
    root.classList.remove(ROOT_CLASS);
    document.querySelectorAll(`.${SURFACE_CLASS}`).forEach((surface) => surface.classList.remove(SURFACE_CLASS));
  };

  try {
    const transition = document.startViewTransition(() => {
      update();
      document.querySelector(activeSelector)?.classList.add(SURFACE_CLASS);
    });
    transition.finished.then(cleanup, cleanup);
    return transition;
  } catch {
    cleanup();
    update();
    return null;
  }
}
