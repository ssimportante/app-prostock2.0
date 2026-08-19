import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

/**
 * Rounds a number to a specific number of decimal places.
 * Essential for inventory stock to avoid IEEE 754 floating point errors.
 */
export function roundTo(value: number, decimals: number = 4): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

/**
 * NUCLEAR INTERACTIVITY RESET
 * Forcefully restores pointer events and scrolling to the document body.
 * This is used to recover from Radix UI / Shadcn overlays that fail to clean up.
 */
export const forceInteractivity = () => {
  if (typeof document === 'undefined') return;
  
  const reset = () => {
    const body = document.body;
    const html = document.documentElement;
    
    // Reset styles
    body.style.pointerEvents = 'auto';
    body.style.overflow = 'auto';
    body.style.userSelect = 'auto';
    html.style.pointerEvents = 'auto';
    html.style.overflow = 'auto';
    
    // Remove specific lock attributes often left behind by UI libraries
    body.removeAttribute('data-radix-scroll-lock');
    body.removeAttribute('aria-hidden');
    html.removeAttribute('data-radix-scroll-lock');
    
    // Force a repaint/reflow check
    void body.offsetHeight;
  };

  // Immediate reset
  reset();
  
  // Run at increasing intervals to catch delayed style injections from transitions
  setTimeout(reset, 50);
  setTimeout(reset, 150);
  setTimeout(reset, 400);
  setTimeout(reset, 800);
};
