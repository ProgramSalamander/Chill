
import React, { useMemo } from 'react';
import { Commit } from '../types';
import { notify } from '../stores/notificationStore';

interface GitGraphProps {
  commits: Commit[];
}

interface GraphNode {
  x: number;
  y: number;
  color: string;
  commit: Commit;
  laneIndex: number;
}

interface GraphLink {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  type: 'straight' | 'merge' | 'fork';
}

const COLORS = [
  '#a371f7', // Purple
  '#22c55e', // Green
  '#f472b6', // Pink
  '#60a5fa', // Blue
  '#fbbf24', // Amber
  '#f87171', // Red
  '#2dd4bf', // Teal
];

const ROW_HEIGHT = 48;
const COL_WIDTH = 16;
const NODE_RADIUS = 5;
const PADDING_TOP = 20;
const PADDING_LEFT = 20;

export const GitGraph: React.FC<GitGraphProps> = ({ commits }) => {
  const { nodes, links, width, height } = useMemo(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    // Map OID to the visual lane it is "expected" in
    const lanes: (string | null)[] = []; 
    const mapOidToNode = new Map<string, GraphNode>();

    commits.forEach((commit, index) => {
      // 1. Determine Lane
      let laneIndex = lanes.indexOf(commit.oid);
      
      if (laneIndex === -1) {
        // Find first empty lane or create new
        laneIndex = lanes.findIndex(l => l === null);
        if (laneIndex === -1) {
          laneIndex = lanes.length;
          lanes.push(commit.oid);
        } else {
          lanes[laneIndex] = commit.oid;
        }
      }

      // 2. Create Node
      const x = laneIndex;
      const y = index;
      const color = COLORS[laneIndex % COLORS.length];
      
      const node = { x, y, color, commit, laneIndex };
      nodes.push(node);
      mapOidToNode.set(commit.oid, node);

      // 3. Process Parents
      const parents = commit.commit.parent || [];
      
      parents.forEach((parentOid, pIdx) => {
        // If it's the first parent, we typically continue the lane
        if (pIdx === 0) {
          lanes[laneIndex] = parentOid;
        } else {
          // It's a merge parent. We don't "reserve" a lane here for it necessarily,
          // because it might already be active or will be picked up later.
          // But to ensure it has a lane if it comes later...
          let parentLane = lanes.indexOf(parentOid);
          if (parentLane === -1) {
             // Reserve a spot if possible, but simpler visualizers usually verify this
             // We'll just let the next iteration handle the lane assignment for the parent
          }
        }
      });

      // Cleanup
      if (parents.length === 0) {
        lanes[laneIndex] = null;
      }
    });

    // 4. Generate Links
    // We do this after nodes are created so we can link to existing coords.
    // NOTE: This visualizer is "optimistic". If history is shallow, parents might be missing.
    nodes.forEach(node => {
      const parents = node.commit.commit.parent || [];
      parents.forEach(parentOid => {
        const parentNode = mapOidToNode.get(parentOid);
        if (parentNode) {
          links.push({
            x1: node.x,
            y1: node.y,
            x2: parentNode.x,
            y2: parentNode.y,
            color: node.color,
            type: 'straight' // Simplification
          });
        }
      });
    });

    const maxLane = Math.max(...nodes.map(n => n.x), 0) + 1;
    // Removed Math.max(..., 100) to allow the graph to shrink horizontally for simple histories
    const width = maxLane * COL_WIDTH + PADDING_LEFT; 
    const height = nodes.length * ROW_HEIGHT + PADDING_TOP;

    return { nodes, links, width, height };
  }, [commits]);

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    notify('Commit hash copied', 'success');
  };

  if (commits.length === 0) return null;

  return (
    <div className="relative w-full overflow-auto custom-scrollbar bg-[#0a0a0f]/50 h-full">
      <div className="absolute top-0 left-0 min-h-full" style={{ width: '100%' }}>
        <svg 
          width={width + 20} 
          height={height} 
          className="absolute top-0 left-0 pointer-events-none"
          style={{ zIndex: 10 }}
        >
          <defs>
             <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
               <feGaussianBlur stdDeviation="2" result="blur" />
               <feComposite in="SourceGraphic" in2="blur" operator="over" />
             </filter>
          </defs>
          {/* Edges */}
          {links.map((link, i) => {
            const sx = PADDING_LEFT + link.x1 * COL_WIDTH;
            const sy = PADDING_TOP + link.y1 * ROW_HEIGHT;
            const ex = PADDING_LEFT + link.x2 * COL_WIDTH;
            const ey = PADDING_TOP + link.y2 * ROW_HEIGHT;
            
            // Bezier curve for smoother connections
            const c1y = sy + ROW_HEIGHT / 2;
            const c2y = ey - ROW_HEIGHT / 2;
            const d = `M ${sx} ${sy} C ${sx} ${c1y}, ${ex} ${c2y}, ${ex} ${ey}`;

            return (
              <path 
                key={`link-${i}`} 
                d={d} 
                stroke={link.color} 
                strokeWidth="2" 
                fill="none" 
                opacity="0.5" 
              />
            );
          })}
          
          {/* Nodes */}
          {nodes.map((node, i) => (
            <circle
              key={`node-${node.commit.oid}`}
              cx={PADDING_LEFT + node.x * COL_WIDTH}
              cy={PADDING_TOP + node.y * ROW_HEIGHT}
              r={NODE_RADIUS}
              fill={node.color}
              stroke="#0f0f16"
              strokeWidth="2"
              className="drop-shadow-md"
            />
          ))}
        </svg>

        {/* Commit Details Overlay */}
        <div className="relative pt-[12px]" style={{ paddingLeft: `${width + 12}px` }}>
          {nodes.map((node) => (
            <div 
              key={node.commit.oid}
              className="flex flex-col justify-center h-[48px] pr-4 group relative"
            >
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-xs text-slate-200 font-medium truncate" title={node.commit.commit.message}>
                  {node.commit.commit.message}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                  <span 
                    className="cursor-pointer hover:text-vibe-glow hover:underline decoration-vibe-glow/50" 
                    onClick={() => copyHash(node.commit.oid)}
                    title="Copy full hash"
                  >
                    {node.commit.oid.slice(0, 7)}
                  </span>
                  <span>•</span>
                  <span>{node.commit.commit.author.name}</span>
                  <span>•</span>
                  <span>{new Date(node.commit.commit.author.timestamp * 1000).toLocaleDateString()}</span>
                </div>
              </div>
              
              {/* Hover effect connecting text back to graph node */}
              <div 
                className="absolute top-1/2 h-[1px] bg-white/10 -translate-x-full group-hover:bg-white/30 transition-colors"
                style={{ left: '-6px', width: '10px' }} 
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
