"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Handle,
  Position,
  NodeProps,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// ── Colour scheme by entity type ──────────────────────────────────────────
const COLORS: Record<string, { bg: string; border: string; text: string }> = {
  CEX:     { bg: "#0d2e1e", border: "#34D399", text: "#34D399" },
  DEFI:    { bg: "#0a1e30", border: "#38BDF8", text: "#38BDF8" },
  BRIDGE:  { bg: "#12201a", border: "#6EE7B7", text: "#6EE7B7" },
  MIXER:   { bg: "#1a0a2a", border: "#a855f7", text: "#a855f7" },
  FRESH:   { bg: "#2a0a0a", border: "#FF3B3B", text: "#FF3B3B" },
  UNKNOWN: { bg: "#12151c", border: "#FFB020", text: "#FFB020" },
  CENTER:  { bg: "#0a0f1e", border: "#38BDF8", text: "#38BDF8" },
  SAFE:    { bg: "#0d2e1e", border: "#34D399", text: "#34D399" },
};

function getColors(entityType: string, safe: boolean, isCenter: boolean) {
  if (isCenter) return COLORS.CENTER;
  if (COLORS[entityType]) return COLORS[entityType];
  if (safe) return COLORS.SAFE;
  return COLORS.UNKNOWN;
}

// ── Custom Wallet Node ────────────────────────────────────────────────────
function WalletNode({ data }: NodeProps) {
  const d = data as any;
  const colors = getColors(d.entityType || "UNKNOWN", d.safe, d.isCenter);

  return (
    <div
      style={{
        background: colors.bg,
        border: `1.5px solid ${colors.border}`,
        boxShadow: `0 0 14px ${colors.border}28`,
      }}
      className="rounded-xl px-3 py-2.5 min-w-[150px] max-w-[210px] font-mono text-[10px] cursor-pointer hover:opacity-90 transition-all"
    >
      <Handle type="target" position={Position.Left} style={{ background: colors.border, width: 8, height: 8, border: "none" }} />

      {/* Entity badge */}
      {d.entityType && !d.isCenter && (
        <div
          className="text-[9px] px-1.5 py-0.5 rounded-full inline-block mb-1"
          style={{ background: colors.border + "22", color: colors.border }}
        >
          {d.entityType}
        </div>
      )}

      {/* Label */}
      <div style={{ color: d.isCenter ? "#38BDF8" : colors.border }} className="font-bold text-[11px] truncate">
        {d.label || "Unknown Wallet"}
      </div>

      {/* Address */}
      <div className="text-[#7C8394] truncate mt-0.5">
        {d.address?.slice(0, 6)}...{d.address?.slice(-4)}
      </div>

      {/* ETH amount */}
      {d.amount && d.amount !== "?" && (
        <div className="mt-1.5 text-[10px] font-bold" style={{ color: colors.text }}>
          ↑ {d.amount} ETH received
        </div>
      )}

      {/* Fresh warning */}
      {d.isFresh && (
        <div className="mt-1 text-[9px] text-[#FF3B3B] font-bold animate-pulse">
          ⚠ FRESH WALLET
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ background: colors.border, width: 8, height: 8, border: "none" }} />
    </div>
  );
}

const nodeTypes = { wallet: WalletNode };

// ── Props ──────────────────────────────────────────────────────────────────
export interface FlowNode {
  id: string;
  address: string;
  label: string;
  entityType?: string;
  safe?: boolean;
  isFresh?: boolean;
  amount?: string;
  isCenter?: boolean;
}

export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  isRisky?: boolean;
}

interface TransactionFlowChartProps {
  centerAddress: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

// ── Left-to-right layered layout ──────────────────────────────────────────
function buildLayout(nodes: FlowNode[]) {
  // Group nodes into layers by their depth from the center
  const X_SPACING = 260;
  const Y_SPACING = 140;

  const positioned: Node[] = [];
  const layerCounts: Record<number, number> = {};

  nodes.forEach((n, i) => {
    const layer = n.isCenter ? 0 : i; // simple left-to-right assignment
    layerCounts[layer] = (layerCounts[layer] || 0) + 1;
  });

  // Assign positions: center at layer 0, each hop at layer i
  nodes.forEach((n, i) => {
    const layer = n.isCenter ? 0 : i;
    const countInLayer = 1; // one node per layer in a chain
    const yOffset = 0;

    positioned.push({
      id: n.id,
      type: "wallet",
      position: {
        x: layer * X_SPACING,
        y: yOffset,
      },
      data: { ...n },
    });
  });

  return positioned;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function TransactionFlowChart({
  centerAddress,
  nodes,
  edges,
}: TransactionFlowChartProps) {
  const rfNodes: Node[] = useMemo(() => buildLayout(nodes), [nodes]);

  const rfEdges: Edge[] = useMemo(() =>
    edges.map((e, i) => ({
      id: `e-${i}`,
      source: e.from,
      target: e.to,
      label: e.label,
      animated: e.isRisky,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: e.isRisky ? "#FF3B3B" : "#34D39966",
        width: 18,
        height: 18,
      },
      style: {
        stroke: e.isRisky ? "#FF3B3B" : "#34D39966",
        strokeWidth: e.isRisky ? 2 : 1.5,
      },
      labelStyle: { fill: "#7C8394", fontSize: 9, fontFamily: "monospace" },
      labelBgStyle: { fill: "#0d111a", fillOpacity: 0.8 },
      labelBgPadding: [4, 4] as [number, number],
      labelBgBorderRadius: 4,
    })),
  [edges]);

  if (nodes.length < 2) return null;

  return (
    <div className="w-full h-[340px] rounded-2xl overflow-hidden border border-white/10 bg-[#08090f]">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.35 }}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
        nodesDraggable={true}
        panOnScroll={true}
        zoomOnScroll={true}
      >
        <Background color="#1a1f2e" gap={24} size={1} />
        <Controls
          style={{ background: "#12151c", border: "1px solid #ffffff15", borderRadius: 8 }}
          showInteractive={false}
        />
        <MiniMap
          nodeColor={(n) => {
            const d = n.data as any;
            if (d.isCenter) return "#38BDF8";
            if (d.entityType === "MIXER") return "#a855f7";
            if (d.safe) return "#34D399";
            if (d.isFresh) return "#FF3B3B";
            return "#FFB020";
          }}
          style={{ background: "#08090f", border: "1px solid #ffffff10" }}
          maskColor="#08090f88"
        />
      </ReactFlow>
    </div>
  );
}
