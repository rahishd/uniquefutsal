"use client";

import { useEffect, useRef } from "react";

type Point = { x: number; y: number };

interface WaveConfig {
  offset: number;
  amplitude: number;
  frequency: number;
  color: string;
  opacity: number;
}

interface GlowyWavesCanvasProps {
  light?: boolean;
}

// Hardcoded to match your BRAND palette
const DARK_WAVE_PALETTE: WaveConfig[] = [
  { offset: 0,              amplitude: 70, frequency: 0.003,  color: "rgba(12, 11, 93, 1)",  opacity: 0.15 },
  { offset: Math.PI / 2,   amplitude: 90, frequency: 0.0026, color: "rgba(250, 100, 0, 1)", opacity: 0.38 },
  { offset: Math.PI,       amplitude: 60, frequency: 0.0034, color: "rgba(12, 11, 93, 1)",  opacity: 0.30 },
  { offset: Math.PI * 1.5, amplitude: 80, frequency: 0.0022, color: "rgba(250, 100, 0, 1)",   opacity: 0.25 },
  { offset: Math.PI * 2,   amplitude: 55, frequency: 0.004,  color: "rgba(241, 245, 249, 1)", opacity: 0.18 },
];

const LIGHT_WAVE_PALETTE: WaveConfig[] = [
  { offset: 0,              amplitude: 70, frequency: 0.003,  color: "rgba(12, 11, 93, 1)",  opacity: 0.08 },
  { offset: Math.PI / 2,   amplitude: 90, frequency: 0.0026, color: "rgba(250, 100, 0, 1)", opacity: 0.15 },
  { offset: Math.PI,       amplitude: 60, frequency: 0.0034, color: "rgba(12, 11, 93, 1)",  opacity: 0.12 },
  { offset: Math.PI * 1.5, amplitude: 80, frequency: 0.0022, color: "rgba(250, 100, 0, 1)",   opacity: 0.10 },
  { offset: Math.PI * 2,   amplitude: 55, frequency: 0.004,  color: "rgba(12, 11, 93, 1)", opacity: 0.05 },
];

const BG_TOP_DARK    = "#0d1117";
const BG_BOTTOM_DARK = "#050426";

const BG_TOP_LIGHT    = "#F0F4FA"; // Less sharp white
const BG_BOTTOM_LIGHT = "#E2E8F0";


export default function GlowyWavesCanvas({ light = false }: GlowyWavesCanvasProps) {
  const canvasRef      = useRef<HTMLCanvasElement | null>(null);
  const mouseRef       = useRef<Point>({ x: 0, y: 0 });
  const targetMouseRef = useRef<Point>({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const currentPalette = light ? LIGHT_WAVE_PALETTE : DARK_WAVE_PALETTE;
    const currentBgTop   = light ? BG_TOP_LIGHT : BG_TOP_DARK;
    const currentBgBottom = light ? BG_BOTTOM_LIGHT : BG_BOTTOM_DARK;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const mouseInfluence  = prefersReducedMotion ? 10  : 70;
    const influenceRadius = prefersReducedMotion ? 160 : 320;
    const smoothing       = prefersReducedMotion ? 0.04 : 0.1;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const w   = window.innerWidth;
      const h   = window.innerHeight;

      canvas.width         = w * dpr;
      canvas.height        = h * dpr;
      canvas.style.width   = `${w}px`;
      canvas.style.height  = `${h}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    const recenterMouse = () => {
      const c = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      mouseRef.current       = c;
      targetMouseRef.current = c;
    };

    const handleResize     = () => { resizeCanvas(); recenterMouse(); };
    const handleMouseMove  = (e: MouseEvent) => { targetMouseRef.current = { x: e.clientX, y: e.clientY }; };
    const handleMouseLeave = () => { recenterMouse(); };

    resizeCanvas();
    recenterMouse();

    window.addEventListener("resize",     handleResize);
    window.addEventListener("mousemove",  handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    const drawWave = (wave: WaveConfig) => {
      const W = window.innerWidth;
      const H = window.innerHeight;

      ctx.save();
      ctx.beginPath();

      for (let x = 0; x <= W; x += 4) {
        const dx       = x - mouseRef.current.x;
        const dy       = H / 2 - mouseRef.current.y;
        const dist     = Math.sqrt(dx * dx + dy * dy);
        const infl     = Math.max(0, 1 - dist / influenceRadius);
        const mouseEff = infl * mouseInfluence * Math.sin(time * 0.001 + x * 0.01 + wave.offset);

        const y =
          H / 2 +
          Math.sin(x * wave.frequency + time * 0.002 + wave.offset) * wave.amplitude +
          Math.sin(x * wave.frequency * 0.4 + time * 0.003)          * (wave.amplitude * 0.45) +
          mouseEff;

        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }

      ctx.lineWidth   = 2.5;
      ctx.strokeStyle = wave.color;
      ctx.globalAlpha = wave.opacity;
      if (!light) {
        ctx.shadowBlur  = 38;
        ctx.shadowColor = wave.color;
      }
      ctx.stroke();
      ctx.restore();
    };

    const animate = () => {
      time += 1;

      mouseRef.current.x += (targetMouseRef.current.x - mouseRef.current.x) * smoothing;
      mouseRef.current.y += (targetMouseRef.current.y - mouseRef.current.y) * smoothing;

      const W = window.innerWidth;
      const H = window.innerHeight;

      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, currentBgTop);
      grad.addColorStop(1, currentBgBottom);

      ctx.fillStyle   = grad;
      ctx.globalAlpha = 1;
      ctx.shadowBlur  = 0;
      ctx.fillRect(0, 0, W, H);

      currentPalette.forEach(drawWave);

      animationId = window.requestAnimationFrame(animate);
    };

    animationId = window.requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize",     handleResize);
      window.removeEventListener("mousemove",  handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationId);
    };
  }, [light]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0 h-full w-full pointer-events-none"
      aria-hidden="true"
    />
  );
}
