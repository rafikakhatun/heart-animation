import { useEffect, useRef } from 'react';

const TRACE_POINTS = 400;
const TRACE_DURATION = 3600; // ms to draw full heart
const HOLD_DURATION = 1400; // ms pause once complete before retracing

function buildHeartPoints(n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y =
      13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push({ x, y });
  }
  return pts;
}

export default function NeonHeartTrace() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const dustRef = useRef([]);
  const ambientRef = useRef([]);
  const heartPtsRef = useRef(buildHeartPoints(TRACE_POINTS));

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';

      ambientRef.current = Array.from({ length: 160 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: (Math.random() * 1.2 + 0.4) * dpr,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.4 + 0.1,
      }));
    }
    resize();
    window.addEventListener('resize', resize);

    function spawnDust(x, y) {
      for (let i = 0; i < 9; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (Math.random() * 0.9 + 0.15) * dpr;
        dustRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.1 * dpr,
          life: 1,
          decay: 1 / (Math.random() * 40 + 45),
          size: (Math.random() * 1.8 + 0.6) * dpr,
          hue: Math.random() > 0.5 ? '#ff4fd8' : '#c07bff',
        });
      }
    }

    function frame(ts) {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const scale = (Math.min(w, h) / 34) * 0.82;

      ctx.fillStyle = '#050308';
      ctx.fillRect(0, 0, w, h);

      // ambient background dust
      ambientRef.current.forEach((a) => {
        const flicker = 0.25 + Math.sin(ts * 0.001 * a.speed + a.phase) * 0.2;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(180,120,255,${Math.max(flicker, 0.05)})`;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.size, 0, Math.PI * 2);
        ctx.fill();
      });

      const cycle = TRACE_DURATION + HOLD_DURATION;
      const cyclePos = elapsed % cycle;
      const progress = Math.min(cyclePos / TRACE_DURATION, 1);
      const pts = heartPtsRef.current;
      const count = Math.floor(progress * (pts.length - 1));

      // draw traced heart path with neon glow (layered strokes)
      ctx.globalCompositeOperation = 'lighter';
      const toCanvas = (p) => ({
        x: cx + p.x * scale,
        y: cy - p.y * scale,
      });

      if (count > 0) {
        [
          { width: 8 * dpr, alpha: 0.12, blur: 30 },
          { width: 4 * dpr, alpha: 0.35, blur: 16 },
          { width: 1.6 * dpr, alpha: 1, blur: 8 },
        ].forEach((layer) => {
          ctx.beginPath();
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.lineWidth = layer.width;
          ctx.strokeStyle = `rgba(255,90,220,${layer.alpha})`;
          ctx.shadowColor = '#ff5adc';
          ctx.shadowBlur = layer.blur;
          for (let i = 0; i <= count; i++) {
            const c = toCanvas(pts[i]);
            if (i === 0) ctx.moveTo(c.x, c.y);
            else ctx.lineTo(c.x, c.y);
          }
          ctx.stroke();
        });
        ctx.shadowBlur = 0;
      }

      // comet head + dust spawn while tracing
      if (progress < 1 && count < pts.length - 1) {
        const head = toCanvas(pts[count]);
        spawnDust(head.x, head.y);

        const headGrad = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 14 * dpr);
        headGrad.addColorStop(0, 'rgba(255,255,255,0.95)');
        headGrad.addColorStop(0.4, 'rgba(255,120,230,0.7)');
        headGrad.addColorStop(1, 'rgba(255,120,230,0)');
        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 14 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      // update + draw dust particles
      dustRef.current = dustRef.current.filter((d) => d.life > 0);
      dustRef.current.forEach((d) => {
        d.x += d.vx;
        d.y += d.vy;
        d.vy += 0.002 * dpr;
        d.life -= d.decay;
        const grad = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.size * 4);
        grad.addColorStop(0, d.hue);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = Math.max(d.life, 0);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      ctx.globalCompositeOperation = 'source-over';
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function handleClick() {
    startRef.current = null;
    dustRef.current = [];
  }

  return (
    <div
      className="relative w-full h-screen flex items-center justify-center overflow-hidden"
      style={{ minHeight: 520, background: '#050308' }}
      onClick={handleClick}
    >
      <div className="relative cursor-pointer" style={{ width: '100%', maxWidth: 480, height: 480 }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
    </div>
  );
}