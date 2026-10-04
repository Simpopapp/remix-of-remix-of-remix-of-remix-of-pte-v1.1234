import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Captura do microfone para o treino: mede o nível do sinal (AnalyserNode)
 * e grava a própria voz (MediaRecorder) para o replay "Ouvir minha leitura".
 */
export function useMicCapture() {
  const [level, setLevel] = useState(0);
  const [recording, setRecording] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const urlRef = useRef<string | null>(null);

  const teardownLevel = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLevel(0);
  }, []);

  const start = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor) {
      const ctx = new Ctor();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (let i = 0; i < data.length; i++) {
          const v = Math.abs(data[i]! - 128) / 128;
          if (v > peak) peak = v;
        }
        setLevel(Math.min(1, peak * 2.5));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      ctxRef.current = ctx;
    }

    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.("audio/webm")) {
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size > 0) {
          const next = URL.createObjectURL(blob);
          urlRef.current = next;
          setUrl(next);
        }
      };
      rec.start();
      recorderRef.current = rec;
    }
    setRecording(true);
  }, []);

  const stop = useCallback(() => {
    try {
      recorderRef.current?.stop();
    } catch {
      /* já parado */
    }
    recorderRef.current = null;
    setRecording(false);
    teardownLevel();
  }, [teardownLevel]);

  /** Descarta o áudio gravado anteriormente (chamado ao iniciar nova leitura). */
  const clear = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setUrl(null);
  }, []);

  useEffect(
    () => () => {
      try {
        recorderRef.current?.stop();
      } catch {
        /* ignora */
      }
      teardownLevel();
    },
    [teardownLevel],
  );

  return { level, recording, url, start, stop, clear };
}
