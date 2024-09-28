import { ElementNode } from "svg-parser";
import SVGPathCommander, { PathArray } from "svg-path-commander";
import { Path } from "./types";

export interface BoundingBox {
  x: number;
  y: number;
  x2: number;
  y2: number;
}

export function getOverallBBox(paths: Path[]): BoundingBox | undefined {
  let overallBBox: BoundingBox | undefined = undefined;

  for (const path of paths) {
    const pathBBox = SVGPathCommander.getPathBBox(path.path);
    if (overallBBox) {
      overallBBox = {
        x: Math.min(pathBBox.x, overallBBox.x),
        y: Math.min(pathBBox.y, overallBBox.y),
        x2: Math.max(pathBBox.x2, overallBBox.x2),
        y2: Math.max(pathBBox.y2, overallBBox.y2),
      };
    } else {
      overallBBox = {
        x: pathBBox.x,
        y: pathBBox.y,
        x2: pathBBox.x2,
        y2: pathBBox.y2,
      };
    }
  }

  if (overallBBox) {
    overallBBox.x = Math.floor(overallBBox.x);
    overallBBox.y = Math.floor(overallBBox.y);
    overallBBox.x2 = Math.ceil(overallBBox.x2);
    overallBBox.y2 = Math.ceil(overallBBox.y2);
  }

  return overallBBox;
}
