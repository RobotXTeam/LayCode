import { animate, stagger } from 'motion';

// ---- Spring presets ----
const spring = { type: 'spring' as const, bounce: 0.15, duration: 0.35 };
const springSnappy = { type: 'spring' as const, bounce: 0.1, duration: 0.25 };
const springGentle = { type: 'spring' as const, bounce: 0.2, duration: 0.45 };

// ---- Panel slide up / down ----
export function panelIn(el: HTMLElement) {
  return animate(el, { opacity: [0, 1], y: [8, 0], scale: [0.98, 1] }, spring);
}

export function panelOut(el: HTMLElement) {
  return animate(el, { opacity: [1, 0], y: [0, 8], scale: [1, 0.98] }, { ...springSnappy, duration: 0.2 });
}

// ---- Bar entrance ----
export function barIn(el: HTMLElement) {
  return animate(el, { opacity: [0, 1], y: [16, 0], scale: [0.96, 1] }, springGentle);
}

// ---- Toast enter / exit ----
export function toastIn(el: HTMLElement) {
  return animate(el, { opacity: [0, 1], x: [60, 0] }, springSnappy);
}

export function toastOut(el: HTMLElement) {
  return animate(el, { opacity: [1, 0], x: [0, 40] }, { duration: 0.2 });
}

// ---- Highlight glow pulse ----
export function glowPulse(el: HTMLElement) {
  return animate(
    el,
    { boxShadow: [`0 0 0 0 rgba(161,161,170,0.25)`, `0 0 0 5px rgba(59,130,246,0)`, `0 0 0 0 rgba(161,161,170,0.25)`] },
    { duration: 2, repeat: Infinity }
  );
}

// ---- Dim overlay fade ----
export function dimIn(el: HTMLElement) {
  return animate(el, { opacity: [0, 1] }, { duration: 0.3 });
}

export function dimOut(el: HTMLElement) {
  return animate(el, { opacity: [1, 0] }, { duration: 0.3 });
}

// ---- Button press feedback ----
export function pressIn(el: HTMLElement) {
  return animate(el, { scale: 0.95 }, { duration: 0.1 });
}

export function pressOut(el: HTMLElement) {
  return animate(el, { scale: 1 }, spring);
}

// ---- Staggered list items ----
export function listIn(selector: string, parent: HTMLElement) {
  const items = parent.querySelectorAll(selector);
  if (items.length === 0) return;
  return animate(
    items as NodeListOf<HTMLElement>,
    { opacity: [0, 1], y: [6, 0] },
    { delay: stagger(0.04), duration: 0.25 }
  );
}

// ---- Confirm overlay ----
export function confirmIn(el: HTMLElement) {
  return animate(el, { opacity: [0, 1] }, { duration: 0.15 });
}

export function confirmOut(el: HTMLElement) {
  return animate(el, { opacity: [1, 0] }, { duration: 0.15 });
}

// ---- Spinner ----
export function spin(el: HTMLElement) {
  return animate(el, { rotate: 360 }, { duration: 0.5, repeat: Infinity, ease: 'linear' });
}

// ---- Loading pulse ----
export function pulse(el: HTMLElement) {
  return animate(el, { opacity: [1, 0.35, 1] }, { duration: 1.2, repeat: Infinity });
}
