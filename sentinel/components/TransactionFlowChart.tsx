"use client";

import { useCallback, useMemo } from "react";
import dagre from "dagre";
import {
  ReactFlow,
  Background,
  Controls,
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
  CEX:     { bg: "#001100", border: "#00FF66", text: "#00FF66" },
  DEFI:    { bg: "#000B1A", border: "#00E5FF", text: "#00E5FF" },
  BRIDGE:  { bg: "#0A1F1A", border: "#6EE7B7", text: "#6EE7B7" },
  MIXER:   { bg: "#1A0030", border: "#c084fc", text: "#c084fc" },
  FRESH:   { bg: "#2A0000", border: "#FF3333", text: "#FF3333" },
  UNKNOWN: { bg: "#0D0D0D", border: "#FFB020", text: "#FFB020" },
  CENTER:  { bg: "#050505", border: "#00E5FF", text: "#00E5FF" },
  SAFE:    { bg: "#001100", border: "#00FF66", text: "#00FF66" },
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
        border: `1px solid ${colors.border}`,
        boxShadow: `0 0 12px ${colors.border}20, 0 0 2px ${colors.border}60`,
      }}
      className="rounded-none px-3 py-2.5 min-w-[155px] max-w-[215px] font-mono text-[10px] cursor-pointer hover:brightness-125 transition-all"
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: colors.border, width: 6, height: 6, border: "none", borderRadius: 0 }}
      />

      {/* Entity / Center badge */}
      {d.isCenter ? (
        <div className="text-[8px] px-1.5 py-0.5 inline-block mb-2 font-bold tracking-[0.15em] uppercase bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/30">
          TARGET
        </div>
      ) : d.entityType && d.entityType !== "UNKNOWN" ? (
        <div
          className="text-[8px] px-1.5 py-0.5 inline-block mb-2 font-bold tracking-[0.15em] uppercase border"
          style={{ background: colors.border + "10", color: colors.border, borderColor: colors.border + "40" }}
        >
          {d.entityType}
        </div>
      ) : (
        <div className="text-[8px] px-1.5 py-0.5 inline-block mb-2 font-bold tracking-[0.15em] uppercase border border-[#FFB020]/30 text-[#FFB020] bg-[#FFB020]/5">
          UNKNOWN
        </div>
      )}

      {/* Label */}
      <div style={{ color: "white" }} className="font-bold text-[11px] truncate uppercase tracking-wide leading-tight">
        {d.label || "UNKNOWN_ENTITY"}
      </div>

      {/* Address */}
      <div className="text-[#555555] truncate mt-0.5 tracking-widest text-[9px]">
        {d.address?.slice(0, 7)}…{d.address?.slice(-5)}
      </div>

      {/* ETH amount badge */}
      {d.amount && d.amount !== "?" && (
        <div className="mt-2 text-[10px] font-bold border-t border-white/5 pt-1.5" style={{ color: colors.text }}>
          ↳ {d.amount} ETH
        </div>
      )}

      {/* Fresh wallet warning */}
      {d.isFresh && (
        <div className="mt-1.5 text-[8px] text-[#FF3333] font-bold animate-pulse tracking-widest uppercase border border-[#FF3333]/30 px-1 py-0.5 inline-block">
          ⚠ FRESH_WALLET
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: colors.border, width: 6, height: 6, border: "none", borderRadius: 0 }}
      />
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

// ── Dagre tree layout ──────────────────────────────────────────────────────
const NODE_WIDTH = 220;
const NODE_HEIGHT = 110;

function buildDagreLayout(nodes: FlowNode[], edges: FlowEdge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "LR",      // Left → Right
    ranksep: 100,       // Horizontal gap between columns
    nodesep: 40,        // Vertical gap between nodes in same column
    marginx: 20,
    marginy: 20,
  });

  nodes.forEach((n) => {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((e) => {
    if (g.hasNode(e.from) && g.hasNode(e.to)) {
      g.setEdge(e.from, e.to);
    }
  });

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      id: n.id,
      type: "wallet",
      position: {
        x: pos ? pos.x - NODE_WIDTH / 2 : 0,
        y: pos ? pos.y - NODE_HEIGHT / 2 : 0,
      },
      data: { ...n },
    };
  });
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function TransactionFlowChart({
  centerAddress,
  nodes,
  edges,
}: TransactionFlowChartProps) {
  const rfNodes: Node[] = useMemo(() => buildDagreLayout(nodes, edges), [nodes, edges]);

  const rfEdges: Edge[] = useMemo(() =>
    edges
      .filter((e) => nodes.some((n) => n.id === e.from) && nodes.some((n) => n.id === e.to))
      .map((e, i) => ({
        id: `e-${i}-${e.from}-${e.to}`,
        source: e.from,
        target: e.to,
        label: e.label,
        animated: e.isRisky,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: e.isRisky ? "#FF3333" : "#00FF6660",
          width: 14,
          height: 14,
        },
        style: {
          stroke: e.isRisky ? "#FF3333" : "#00FF6640",
          strokeWidth: e.isRisky ? 1.5 : 1,
        },
        labelStyle: { fill: "#888888", fontSize: 9, fontFamily: "monospace", letterSpacing: "1px" },
        labelBgStyle: { fill: "#000000", fillOpacity: 0.95, stroke: "#222222", strokeWidth: 1 },
        labelBgPadding: [6, 4] as [number, number],
        labelBgBorderRadius: 0,
      })),
  [edges, nodes]);

  if (nodes.length < 2) return null;

  const nodeCount = nodes.length;
  const edgeCount = edges.length;

  return (
    <div className="w-full h-full rounded-none overflow-hidden bg-black relative">
      {/* Header bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 py-1.5 bg-black/80 border-b border-white/5 backdrop-blur-sm">
        <span className="font-[family-name:var(--font-mono)] text-[8px] text-[#00E5FF] tracking-[0.2em] uppercase font-bold">
          GRAPH_ENGINE · LIVE
        </span>
        <div className="flex items-center gap-3 font-[family-name:var(--font-mono)] text-[8px] text-[#4a5063] tracking-widest">
          <span>{nodeCount} NODES</span>
          <span className="text-[#333]">·</span>
          <span>{edgeCount} EDGES</span>
          <span className="text-[#333]">·</span>
          <span className="text-[#00E5FF]">BFS_DEPTH_2</span>
        </div>
      </div>

      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
        nodesDraggable={true}
        panOnScroll={true}
        zoomOnScroll={true}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background color="#0a0a0a" gap={24} size={1} />
        <Controls
          style={{
            background: "black",
            border: "1px solid #222222",
            borderRadius: 0,
            marginTop: "36px",
          }}
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
}
