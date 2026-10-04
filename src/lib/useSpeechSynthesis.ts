import { useCallback, useEffect, useRef, useState } from "react";

export function useSpeechSynthesis() {
  // false no primeiro render (server e hidratação) e verdadeiro após montar —
  // evita divergência de hidratação entre servidor e cliente.
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  /** Vozes em inglês disponíveis no navegador (para o seletor de Ajustes). */
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  /** Incrementa a cada cancelamento: callbacks de utterances antigas não disparam. */
  const tokenRef = useRef(0);

  useEffect(() => {
    setSupported("speechSynthesis" in window);
  }, []);

  useEffect(() => {
    if (!supported) return;
    const load = () =>
      setVoices(window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en")));
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [supported]);

  const cancel = useCallback(() => {
    if (!supported) return;
    tokenRef.current += 1;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    (text: string, rate = 1, onend?: () => void, voiceURI?: string) => {
      if (!supported || !text) return;
      tokenRef.current += 1;
      const token = tokenRef.current;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = rate;
      const voices = window.speechSynthesis.getVoices();
      const voice =
        (voiceURI ? voices.find((v) => v.voiceURI === voiceURI) : undefined) ??
        voices.find((v) => v.lang.replace("_", "-").startsWith("en-US")) ??
        voices.find((v) => v.lang.toLowerCase().startsWith("en"));
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }
      utterance.onend = () => {
        if (tokenRef.current !== token) return; // cancelado ou substituído
        setSpeaking(false);
        onend?.();
      };
      utterance.onerror = () => {
        if (tokenRef.current !== token) return;
        setSpeaking(false);
      };
      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [supported],
  );

  useEffect(() => cancel, [cancel]);

  return { supported, speaking, speak, cancel, voices };
}
