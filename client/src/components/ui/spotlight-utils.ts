export type Placement = 'top' | 'bottom' | 'left' | 'right';

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface PlacementScore {
  placement: Placement;
  score: number;
  position: Point;
}

export function getElementRect(element: HTMLElement): Rect {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    right: rect.right,
    bottom: rect.bottom,
  };
}

export function getPaddedRect(rect: Rect, padding: number): Rect {
  return {
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
    right: rect.right + padding,
    bottom: rect.bottom + padding,
  };
}

export function fitsInViewport(rect: Rect, margin = 12): boolean {
  return (
    rect.left >= margin &&
    rect.top >= margin &&
    rect.right <= window.innerWidth - margin &&
    rect.bottom <= window.innerHeight - margin
  );
}

export function getAvailableSpace(
  targetRect: Rect,
  placement: Placement,
  margin = 12
): number {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  switch (placement) {
    case 'top':
      return targetRect.top - margin;
    case 'bottom':
      return viewportHeight - targetRect.bottom - margin;
    case 'left':
      return targetRect.left - margin;
    case 'right':
      return viewportWidth - targetRect.right - margin;
    default:
      return 0;
  }
}

export function calculateTooltipPosition(
  targetRect: Rect,
  placement: Placement,
  tooltipWidth: number,
  tooltipHeight: number,
  spacing = 20
): Point {
  let x = 0;
  let y = 0;

  const centerX = targetRect.left + targetRect.width / 2;
  const centerY = targetRect.top + targetRect.height / 2;

  switch (placement) {
    case 'bottom':
      x = centerX - tooltipWidth / 2;
      y = targetRect.bottom + spacing;
      break;
    case 'top':
      x = centerX - tooltipWidth / 2;
      y = targetRect.top - tooltipHeight - spacing;
      break;
    case 'left':
      x = targetRect.left - tooltipWidth - spacing;
      y = centerY - tooltipHeight / 2;
      break;
    case 'right':
      x = targetRect.right + spacing;
      y = centerY - tooltipHeight / 2;
      break;
  }

  return { x, y };
}

export function checkOverlap(rect1: Rect, rect2: Rect): boolean {
  return !(
    rect1.right < rect2.left ||
    rect1.left > rect2.right ||
    rect1.bottom < rect2.top ||
    rect1.top > rect2.bottom
  );
}

export function scorePlacement(
  targetRect: Rect,
  placement: Placement,
  tooltipWidth: number,
  tooltipHeight: number,
  spacing = 20,
  margin = 12
): PlacementScore {
  const position = calculateTooltipPosition(
    targetRect,
    placement,
    tooltipWidth,
    tooltipHeight,
    spacing
  );

  const tooltipRect: Rect = {
    left: position.x,
    top: position.y,
    width: tooltipWidth,
    height: tooltipHeight,
    right: position.x + tooltipWidth,
    bottom: position.y + tooltipHeight,
  };

  const fits = fitsInViewport(tooltipRect, margin);
  const availableSpace = getAvailableSpace(targetRect, placement, margin);

  let score = availableSpace;
  if (!fits) {
    score = score * 0.1;
  }

  const overlapsSpotlight = checkOverlap(tooltipRect, targetRect);
  if (overlapsSpotlight) {
    score = score * 0.5;
  }

  return { placement, score, position };
}

export function findBestPlacement(
  targetRect: Rect,
  tooltipWidth: number,
  tooltipHeight: number,
  preferredPlacement?: Placement,
  spacing = 20,
  margin = 12
): { placement: Placement; position: Point } {
  const placements: Placement[] = preferredPlacement
    ? [preferredPlacement, 'bottom', 'top', 'right', 'left']
    : ['bottom', 'top', 'right', 'left'];

  const uniquePlacements = Array.from(new Set(placements));

  const scores = uniquePlacements.map((placement) =>
    scorePlacement(targetRect, placement, tooltipWidth, tooltipHeight, spacing, margin)
  );

  const best = scores.reduce((prev, current) =>
    current.score > prev.score ? current : prev
  );

  return { placement: best.placement, position: best.position };
}

export function clampPositionToViewport(
  position: Point,
  width: number,
  height: number,
  margin = 12
): Point {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  return {
    x: Math.max(margin, Math.min(position.x, viewportWidth - width - margin)),
    y: Math.max(margin, Math.min(position.y, viewportHeight - height - margin)),
  };
}

export function getBorderRadius(element: HTMLElement): string {
  try {
    const computed = window.getComputedStyle(element);
    const radius = computed.borderRadius;
    return radius && radius !== '0px' ? radius : '12px';
  } catch {
    return '12px';
  }
}

export function resolveTarget(
  target: string | React.RefObject<HTMLElement>
): HTMLElement | null {
  if (typeof target === 'string') {
    return document.querySelector(target) as HTMLElement;
  }
  return target.current;
}

export function isElementVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.top < window.innerHeight &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.right > 0
  );
}

export function scrollIntoViewIfNeeded(element: HTMLElement, smooth = true): void {
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  const isInView =
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= viewportHeight &&
    rect.right <= viewportWidth;

  if (!isInView) {
    element.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      block: 'center',
      inline: 'center',
    });
  }
}
