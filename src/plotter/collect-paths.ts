import { Node, ElementNode } from "svg-parser";

export function collectPaths(
  paths: ElementNode[],
  children: (Node | string)[]
) {
  for (const child of children) {
    if (typeof child === "string") {
      // todo
    } else if (child.type === "element") {
      if (child.tagName === "path") {
        paths.push(child);
      }
      if (child.children.length > 0) {
        collectPaths(paths, child.children);
      }
    }
  }
}
