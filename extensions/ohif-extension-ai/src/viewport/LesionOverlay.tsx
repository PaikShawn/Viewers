import React, { useEffect, useState } from 'react';

const LESION_COLORS = {
  PR: '#22c55e',
  PD: '#ef4444',
  SD: '#f59e0b',
};

export default function LesionOverlay({ viewportData }) {
  const [findings, setFindings] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      if (e.detail && e.detail.findings) {
        setFindings(e.detail.findings);
      }
    };
    window.addEventListener('ohif-ai-findings', handler);
    return () => window.removeEventListener('ohif-ai-findings', handler);
  }, []);

  if (!findings.length) return null;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 100,
      }}
    >
      {findings.map((lesion) => {
        const x = lesion.coordinates?.x ?? 100;
        const y = lesion.coordinates?.y ?? 100;
        const r = parseInt(lesion.current) * 1.5 || 20;
        const color = LESION_COLORS[lesion.response] || '#00d4ff';
        return (
          <g key={lesion.id}>
            <circle
              cx={x}
              cy={y}
              r={r}
              fill={`${color}22`}
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray="4 2"
            />
            <line x1={x - r} y1={y} x2={x + r} y2={y} stroke={color} strokeWidth={1} opacity={0.6} />
            <line x1={x} y1={y - r} x2={x} y2={y + r} stroke={color} strokeWidth={1} opacity={0.6} />
            <rect x={x + r + 2} y={y - 10} width={28} height={14} fill="#0a0e1acc" rx={2} />
            <text x={x + r + 6} y={y + 1} fill={color} fontSize={10} fontFamily="monospace" fontWeight="700">
              {`L${lesion.id}`}
            </text>
            <text x={x + r + 2} y={y + 18} fill={color} fontSize={9} fontFamily="monospace" opacity={0.8}>
              {lesion.current}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
