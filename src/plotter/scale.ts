import { BoundingBox } from "./overall-bbox";

const MAX_X = 700;
const MAX_Y = 2600;

export function calculateScale(overallBBox: BoundingBox): number {
  const scaleX = MAX_X / Math.abs(overallBBox.x2 - overallBBox.x);
  const scaleY = MAX_Y / Math.abs(overallBBox.y2 - overallBBox.y);

  return Math.min(scaleX, scaleY);
}

/**
 * The plot coord system is from 0,0 - 100,100
 */
export function transformToPlotCoord(
  x: number,
  y: number,
  overallBBox: BoundingBox
) {
  if (
    x < overallBBox.x ||
    y < overallBBox.y ||
    x > overallBBox.x2 ||
    y > overallBBox.y2
  ) {
    throw Error("Point outside of bounding box");
  }

  const scale = calculateScale(overallBBox);

  return {
    x: (x - overallBBox.x) * scale,
    y: (y - overallBBox.y) * scale,
  };
}

export function transformLength(length: number, overallBBox: BoundingBox) {
  const scale = calculateScale(overallBBox);

  return length * Math.abs(scale);
}
