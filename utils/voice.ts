
export const speak = (text: string, force: boolean = false) => {
  if (!window.speechSynthesis) return;
  
  // Cancel current speech to avoid queue buildup, unless we want overlapping (rare)
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 0.9; // Slightly lower for cyberpunk feel
  utterance.volume = 1.0;

  // Try to find a good voice
  const voices = window.speechSynthesis.getVoices();
  // Prefer a robotic or Google voice if available
  const preferredVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Zira') || v.name.includes('Samantha'));
  if (preferredVoice) utterance.voice = preferredVoice;

  window.speechSynthesis.speak(utterance);
};

export const stopSpeech = () => {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
};
