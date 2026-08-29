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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// ── Colour scheme ──────────────────────────────────────────────────────────
const COLORS = {
  safe:     { bg: "#0d2e1e", border: "#34D399", text: "#34D399" },
  risky:    { bg: "#2a0a0a", border: "#FF3B3B", text: "#FF3B3B" },
  mixer:    { bg: "#1a0a2a", border: "#a855f7", text: "#a855f7" },
  unknown:  { bg: "#12151c", border: "#FFB020", text: "#FFB020" },
  center:   { bg: "#0a0f1e", border: "#38BDF8", text: "#38BDF8" },
};

function getNodeColors(type: string, safe: boolean) {
  if (type === "MIXER")  return COLORS.mixer;
  if (type === "FRESH")  return COLORS.risky;
  if (safe)              return COLORS.safe;
  return COLORS.unknown;
}

// ── Custom Node ────────────────────────────────────────────────────────────
function WalletNode({ data }: NodeProps) {
  const d = data as any;
  const colors = d.isCenter ? COLORS.center : getNodeColors(d.entityType, d.safe);

  return (
    <div
      style={{
        background: colors.bg,
        border: `1.5px solid ${colors.border}`,
        boxShadow: `0 0 12px ${colors.border}33`,
      }}
      className="rounded-xl px-3 py-2 min-w-[140px] max-w-[200px] font-mono text-[10px] cursor-pointer hover:opacity-90 transition-opacity"
    >
      <Handle type="target" position={Position.Left} style={{ background: colors.border, width: 8, height: 8 }} />

      <div style={{ color: colors.border }} className="font-bold text-[11px] mb-0.5 truncate">
        {d.label}
      </div>
      <div className="text-[#7C8394] truncate">{d.address?.slice(0, 6)}...{d.address?.slice(-4)}</div>
      {d.amount && (
        <div className="mt-1" style={{ color: colors.text }}>{d.amount} ETH</div>
      )}
      {d.entityType && !d.isCenter && (
        <div
          className="mt-1 text-[9px] px-1.5 py-0.5 rounded-full inline-block"
          style={{ background: colors.border + "22", color: colors.border }}
        >
          {d.entityType}
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ background: colors.border, width: 8, height: 8 }} />
    </div>
  );
}

const nodeTypes = { wallet: WalletNode };

// ── Props ──────────────────────────────────────────────────────────────────
interface FlowNode {
  id: string;
  address: string;
  label: string;
  entityType?: string;
  safe?: boolean;
  amount?: string;
  isCenter?: boolean;
}

interface FlowEdge {
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

// ── Main Component ─────────────────────────────────────────────────────────
export default function TransactionFlowChart({
  centerAddress,
  nodes,
  edges,
}: TransactionFlowChartProps) {
  const rfNodes: Node[] = useMemo(() => {
    const total = nodes.filter((n) => !n.isCenter).length;
    return nodes.map((n, i) => {
      const angle = (i / total) * 2 * Math.PI - Math.PI / 2;
      const radius = 280;
      return {
        id: n.id,
        type: "wallet",
        position: n.isCenter
          ? { x: 0, y: 0 }
          : { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius },
        data: { ...n },
      };
    });
  }, [nodes]);

  const rfEdges: Edge[] = useMemo(() =>
    edges.map((e, i) => ({
      id: `e-${i}`,
      source: e.from,
      target: e.to,
      label: e.label,
      animated: e.isRisky,
      style: {
        stroke: e.isRisky ? "#FF3B3B" : "#34D39966",
        strokeWidth: e.isRisky ? 2 : 1.5,
      },
      labelStyle: { fill: "#7C8394", fontSize: 9, fontFamily: "monospace" },
      labelBgStyle: { fill: "#0d111a" },
    })),
  [edges]);

  if (nodes.length === 0) return null;

  return (
    <div className="w-full h-[420px] rounded-2xl overflow-hidden border border-white/10 bg-[#08090f]">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1a1f2e" gap={20} size={1} />
        <Controls
          style={{ background: "#12151c", border: "1px solid #ffffff15", borderRadius: 8 }}
          showInteractive={false}
        />
        <MiniMap
          nodeColor={(n) => {
            const d = n.data as any;
            return d.isCenter ? "#38BDF8" : d.safe ? "#34D399" : "#FF3B3B";
          }}
          style={{ background: "#08090f", border: "1px solid #ffffff10" }}
          maskColor="#08090f88"
        />
      </ReactFlow>
    </div>
  );
}
