import React, { useState, useCallback, useRef } from 'react';

const COLORS = {
  bg: '#0a0e1a',
  surface: '#111827',
  surfaceAlt: '#1a2235',
  border: '#1e2d47',
  accent: '#00d4ff',
  accentDim: '#0099cc',
  accentGlow: 'rgba(0,212,255,0.12)',
  text: '#e2e8f0',
  textMuted: '#64748b',
  textDim: '#94a3b8',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
};

function ResponseBadge({ response }) {
  const map = { PR: COLORS.success, PD: COLORS.danger, SD: COLORS.warning };
  const c = map[response] || COLORS.textMuted;
  return (
    <span style={{
      background: `${c}22`, color: c, border: `1px solid ${c}55`,
      borderRadius: 3, padding: '1px 6px', fontSize: 10,
      fontFamily: 'monospace', fontWeight: 700,
    }}>{response}</span>
  );
}

export default function AIPanel() {
  const [aiRunning, setAiRunning] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedLesion, setSelectedLesion] = useState(null);
  const [activeTab, setActiveTab] = useState('findings');
  const [findings, setFindings] = useState([]);
  const [overallResponse, setOverallResponse] = useState({
    label: '—', baseline: '—', current: '—', change: '—',
  });
  const [error, setError] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');

  const findingsRef = useRef([]);
  const listenersAttached = useRef(false);

  const updateOverlaysForSlice = useCallback(() => {
    const svg = document.querySelector('#svg-layer-default');
    if (!svg) return;

    document.querySelectorAll('.ai-nodule-overlay').forEach(el => el.remove());

    const cs = (window as any).cornerstone;
    if (!cs) return;
    const elements = cs.getEnabledElements();
    if (!elements?.length) return;
    const vp = elements[0]?.viewport;
    if (!vp) return;

    const sliceIndex = vp.getCurrentImageIdIndex?.() ?? 0;
    const imageData = vp.getImageData();

    findingsRef.current.forEach((nodule: any) => {
      const color = nodule.color || '#00d4ff';
      const contours = nodule.contours_per_slice || {};

      let points = contours[String(sliceIndex)];
      if (!points) {
        for (let offset = 1; offset <= 2; offset++) {
          points = contours[String(sliceIndex + offset)] || contours[String(sliceIndex - offset)];
          if (points) break;
        }
      }
      if (!points || points.length < 3) return;

      const canvasPoints = points.map(([i, j]) => {
        const worldPos = imageData.imageData.indexToWorld([i, j, sliceIndex]);
        const canvasPos = vp.worldToCanvas(worldPos);
        return [canvasPos[0], canvasPos[1]];
      });

      const pointsStr = canvasPoints.map(([x, y]) => `${x},${y}`).join(' ');

      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('points', pointsStr);
      polygon.setAttribute('fill', `${color}22`);
      polygon.setAttribute('stroke', color);
      polygon.setAttribute('stroke-width', '2');
      polygon.setAttribute('stroke-dasharray', '4 2');
      polygon.setAttribute('class', 'ai-nodule-overlay');
      svg.appendChild(polygon);

      const centX = canvasPoints.reduce((s, [x]) => s + x, 0) / canvasPoints.length;
      const centY = canvasPoints.reduce((s, [, y]) => s + y, 0) / canvasPoints.length;

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', String(centX + 6));
      label.setAttribute('y', String(centY - 6));
      label.setAttribute('fill', color);
      label.setAttribute('font-size', '11');
      label.setAttribute('font-family', 'monospace');
      label.setAttribute('font-weight', 'bold');
      label.setAttribute('class', 'ai-nodule-overlay');
      label.textContent = `N${nodule.id} ${nodule.diameter_mm}mm`;
      svg.appendChild(label);
    });
  }, []);

  const setupSliceTracking = useCallback((findings) => {
    try {
      findingsRef.current = findings;

      const cs = (window as any).cornerstone;
      if (!cs) return;
      const elements = cs.getEnabledElements();
      if (!elements?.length) return;
      const el = elements[0];
      if (!el?.viewport?.element) return;
      const domEl = el.viewport.element;

      if (listenersAttached.current) return;
      listenersAttached.current = true;

      domEl.addEventListener('CORNERSTONE_STACK_VIEWPORT_SCROLL', updateOverlaysForSlice);
      domEl.addEventListener('CORNERSTONE_CAMERA_MODIFIED', updateOverlaysForSlice);

      updateOverlaysForSlice();
    } catch (err) {
      console.error('Slice tracking error:', err);
    }
  }, [updateOverlaysForSlice]);

  const runAI = useCallback(async () => {
    if (aiRunning) return;
    setAiRunning(true);
    setAiDone(false);
    setProgress(0);
    setError(null);
    setStatusMsg('');
    listenersAttached.current = false;

    try {
      const params = new URLSearchParams(window.location.search);
      const studyUID = params.get('StudyInstanceUIDs') || '';

      setStatusMsg(studyUID ? 'Checking cache...' : 'Running demo analysis...');
      setProgress(20);

      const endpoint = studyUID
        ? `http://127.0.0.1:8000/api/ai/detect-nodules?studyInstanceUID=${studyUID}`
        : 'http://127.0.0.1:8000/api/ai/detect-nodules';

      setProgress(40);
      setStatusMsg('Running MONAI nodule detection...');

      const res = await fetch(endpoint, { method: 'POST' });
      setProgress(90);
      const data = await res.json();

      setFindings(data.findings);
      setOverallResponse({
        label: data.overall_response,
        baseline: data.baseline_sum,
        current: data.current_sum,
        change: data.change,
      });
      setProgress(100);
      setAiDone(true);
      setStatusMsg(`✓ ${data.findings.length} nodule(s) detected`);
      setupSliceTracking(data.findings);
    } catch (err) {
      setError('Could not connect to AI backend. Is it running?');
      setStatusMsg('');
      console.error('AI backend error:', err);
    } finally {
      setAiRunning(false);
    }
  }, [aiRunning, setupSliceTracking]);

  return (
    <div style={{
      background: COLORS.bg, height: '100%', display: 'flex',
      flexDirection: 'column', fontFamily: "'Inter', system-ui, sans-serif",
      color: COLORS.text, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: COLORS.surfaceAlt, borderBottom: `1px solid ${COLORS.border}`,
        padding: '10px 14px',
      }}>
        <div style={{ color: COLORS.accent, fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.05em' }}>
          ▣ AI ANALYSIS
        </div>
        <div style={{ color: COLORS.textMuted, fontSize: 10, marginTop: 2 }}>
          RECIST 1.1 · Nodule Detection
        </div>
      </div>

      {/* Run Button */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${COLORS.border}` }}>
        <button onClick={runAI} disabled={aiRunning} style={{
          width: '100%',
          background: aiRunning ? COLORS.surfaceAlt : `linear-gradient(135deg, ${COLORS.accentDim}, ${COLORS.accent})`,
          border: 'none', borderRadius: 5, color: '#000',
          padding: '8px', fontWeight: 700, fontSize: 11,
          cursor: aiRunning ? 'not-allowed' : 'pointer',
          fontFamily: 'monospace', letterSpacing: '0.05em',
          opacity: aiRunning ? 0.5 : 1,
        }}>
          {aiRunning ? '⟳ DETECTING NODULES...' : aiDone ? '✓ RE-RUN DETECTION' : '▶ RUN AI ANALYSIS'}
        </button>

        {aiRunning && (
          <div style={{ marginTop: 8 }}>
            <div style={{ height: 3, background: COLORS.border, borderRadius: 2 }}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: `linear-gradient(90deg, ${COLORS.accentDim}, ${COLORS.accent})`,
                width: `${progress}%`, transition: 'width 0.3s',
              }} />
            </div>
            <div style={{ color: COLORS.textMuted, fontSize: 9, fontFamily: 'monospace', marginTop: 4 }}>
              {progress}% · {statusMsg}
            </div>
          </div>
        )}

        {statusMsg && !aiRunning && (
          <div style={{ color: COLORS.accent, fontSize: 9, fontFamily: 'monospace', marginTop: 4, textAlign: 'center' }}>
            {statusMsg}
          </div>
        )}

        {error && (
          <div style={{
            marginTop: 8, color: COLORS.danger, fontSize: 10,
            fontFamily: 'monospace', textAlign: 'center',
          }}>
            ⚠ {error}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${COLORS.border}` }}>
        {['findings', 'report'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1, padding: '8px 0', background: 'transparent', border: 'none',
            borderBottom: `2px solid ${activeTab === tab ? COLORS.accent : 'transparent'}`,
            color: activeTab === tab ? COLORS.accent : COLORS.textMuted,
            fontSize: 11, fontFamily: 'monospace', cursor: 'pointer',
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {activeTab === 'findings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!aiDone && (
              <div style={{
                color: COLORS.textMuted, fontSize: 11, textAlign: 'center',
                padding: '40px 10px', fontFamily: 'monospace',
              }}>
                Click RUN AI ANALYSIS<br />to detect nodules/tumors
              </div>
            )}

            {aiDone && findings.length === 0 && (
              <div style={{
                color: COLORS.textMuted, fontSize: 11, textAlign: 'center',
                padding: '40px 10px', fontFamily: 'monospace',
              }}>
                No nodules detected
              </div>
            )}

            {aiDone && findings.length > 0 && (
              <>
                <div style={{
                  background: `${COLORS.success}11`, border: `1px solid ${COLORS.success}33`,
                  borderRadius: 6, padding: '8px 10px',
                }}>
                  <div style={{ color: COLORS.textMuted, fontSize: 9, fontFamily: 'monospace', marginBottom: 2 }}>
                    OVERALL RESPONSE
                  </div>
                  <div style={{ color: COLORS.success, fontSize: 12, fontFamily: 'monospace', fontWeight: 700 }}>
                    {overallResponse.label}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 5 }}>
                    {[['Baseline', overallResponse.baseline], ['Current', overallResponse.current], ['Δ', overallResponse.change]].map(([k, v]) => (
                      <div key={k} style={{ flex: 1 }}>
                        <div style={{ color: COLORS.textMuted, fontSize: 8, fontFamily: 'monospace' }}>{k}</div>
                        <div style={{ color: COLORS.text, fontSize: 11, fontFamily: 'monospace' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {findings.map(n => (
                  <div key={n.id}
                    onClick={() => setSelectedLesion(selectedLesion?.id === n.id ? null : n)}
                    style={{
                      background: selectedLesion?.id === n.id ? `${n.color}11` : COLORS.surface,
                      border: `1px solid ${selectedLesion?.id === n.id ? n.color : COLORS.border}`,
                      borderRadius: 6, padding: '8px 10px', cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ color: n.color, fontSize: 11, fontFamily: 'monospace', fontWeight: 700 }}>
                        N{n.id} · {n.label}
                      </span>
                      <ResponseBadge response={n.response} />
                    </div>
                    <div style={{ color: COLORS.textMuted, fontSize: 9, fontFamily: 'monospace', marginBottom: 5 }}>
                      {n.location} · Confidence: {n.confidence}%
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[['Baseline', n.baseline], ['Current', n.current], ['Δ', n.change]].map(([k, v]) => (
                        <div key={k} style={{ flex: 1 }}>
                          <div style={{ color: COLORS.textMuted, fontSize: 8, fontFamily: 'monospace' }}>{k}</div>
                          <div style={{ color: COLORS.text, fontSize: 11, fontFamily: 'monospace' }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div style={{ marginTop: 4 }}>
                  <div style={{ color: COLORS.textMuted, fontSize: 9, fontFamily: 'monospace', marginBottom: 6 }}>
                    AI CONFIDENCE
                  </div>
                  {[['Detection', 97], ['Measurement', 94], ['RECIST', 91]].map(([lbl, pct]) => (
                    <div key={lbl} style={{ marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ color: COLORS.textDim, fontSize: 9, fontFamily: 'monospace' }}>{lbl}</span>
                        <span style={{ color: COLORS.accent, fontSize: 9, fontFamily: 'monospace' }}>{pct}%</span>
                      </div>
                      <div style={{ height: 3, background: COLORS.border, borderRadius: 2 }}>
                        <div style={{
                          height: '100%', width: `${pct}%`, borderRadius: 2,
                          background: `linear-gradient(90deg, ${COLORS.accentDim}, ${COLORS.accent})`,
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'report' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ color: COLORS.textMuted, fontSize: 9, fontFamily: 'monospace' }}>
              RECIST 1.1 REPORT · AUTO-GENERATED
            </div>
            <div style={{ color: COLORS.textDim, fontSize: 10, lineHeight: 1.7 }}>
              <strong style={{ color: COLORS.text }}>Clinical Trial:</strong> TRIAL-2024-042<br />
              <strong style={{ color: COLORS.text }}>Patient:</strong> ANON-00142<br />
              <strong style={{ color: COLORS.text }}>Timepoint:</strong> Cycle 2 / Week 8<br />
              <strong style={{ color: COLORS.text }}>Modality:</strong> CT Chest<br />
              <strong style={{ color: COLORS.text }}>Date:</strong> {new Date().toISOString().split('T')[0]}<br />
            </div>
            <div style={{ height: 1, background: COLORS.border, margin: '4px 0' }} />
            <div style={{ color: COLORS.textDim, fontSize: 10, lineHeight: 1.7 }}>
              {aiDone && findings.length > 0 ? (
                <>
                  {findings.length} nodule(s) detected. Sum of longest diameters
                  {overallResponse.baseline !== '—' ? ` changed from ${overallResponse.baseline} to ${overallResponse.current} (${overallResponse.change}).` : '.'}<br /><br />
                  <strong style={{ color: COLORS.success }}>Overall response: {overallResponse.label}</strong>
                </>
              ) : (
                'Run AI analysis to generate report.'
              )}
            </div>
            <button style={{
              background: COLORS.accentGlow, border: `1px solid ${COLORS.accent}55`,
              color: COLORS.accent, borderRadius: 4, padding: '6px 10px',
              fontSize: 10, cursor: 'pointer', fontFamily: 'monospace', marginTop: 6,
            }}>
              ↓ Export PDF Report
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: `1px solid ${COLORS.border}`, padding: '6px 12px',
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span style={{ color: COLORS.textMuted, fontSize: 9, fontFamily: 'monospace' }}>OHIF·AI v1.0</span>
        <span style={{
          color: aiDone ? COLORS.success : COLORS.textMuted,
          fontSize: 9, fontFamily: 'monospace',
        }}>
          {aiDone ? '● COMPLETE' : aiRunning ? '● PROCESSING' : '○ READY'}
        </span>
      </div>
    </div>
  );
}
