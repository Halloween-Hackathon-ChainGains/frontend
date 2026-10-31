"use client";

import ForceGraph2D, { type ForceGraphMethods, type ForceGraphProps } from "react-force-graph-2d";
import type { MutableRefObject } from "react";
import type { SimLink, SimNode } from "./director";

export type FG = ForceGraphMethods<SimNode, SimLink>;

/** next/dynamic doesn't forward refs, so the ref travels as a prop. */
export default function ForceGraphClient({
  graphRef,
  ...props
}: ForceGraphProps<SimNode, SimLink> & { graphRef: MutableRefObject<FG | undefined> }) {
  return <ForceGraph2D ref={graphRef} {...props} />;
}
