

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  preview_url: string;
}

export interface SharedVoice {
  voice_id: string;
  name: string;
  category: string;
  preview_url: string;
  public_owner_id: string;
  description?: string;
  use_count?: number;
}

export const DEFAULT_VOICES: ElevenLabsVoice[] = [
  { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', category: 'premade', preview_url: '' },
  { voice_id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', category: 'premade', preview_url: '' },
  { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', category: 'premade', preview_url: '' },
  { voice_id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', category: 'premade', preview_url: '' },
  { voice_id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', category: 'premade', preview_url: '' },
  { voice_id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', category: 'premade', preview_url: '' },
  { voice_id: 'VR6AewLTigWg4xSOukaG', name: 'Arnold', category: 'premade', preview_url: '' },
  { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', category: 'premade', preview_url: '' },
  { voice_id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', category: 'premade', preview_url: '' }
];

export const fetchVoices = async (apiKey: string): Promise<ElevenLabsVoice[]> => {
  const cleanKey = apiKey?.trim();
  if (!cleanKey) throw new Error("API Key is empty");

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': cleanKey,
      },
    });
    
    if (response.status === 401 || response.status === 403) {
        throw new Error("Invalid API key");
    }

    if (!response.ok) {
       const errData = await response.json().catch(() => ({}));
       // Only log full error if it's not a common auth error to keep console clean
       if (response.status !== 401) {
           console.error("ElevenLabs Fetch Error Body:", JSON.stringify(errData, null, 2));
       }
       const errMsg = errData.detail?.message || `API Error: ${response.statusText} (${response.status})`;
       throw new Error(errMsg);
    }
    
    const data = await response.json();
    return data.voices.map((v: any) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category,
      preview_url: v.preview_url
    }));
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Invalid API key") || error.message.includes("401"))) {
        throw new Error("Invalid API key");
    }
    console.error("ElevenLabs Fetch Error:", error);
    throw error; 
  }
};

export const fetchSharedVoices = async (apiKey: string): Promise<SharedVoice[]> => {
  const cleanKey = apiKey?.trim();
  if (!cleanKey) throw new Error("API Key is empty");

  try {
    // Fetch high quality, popular voices
    const response = await fetch('https://api.elevenlabs.io/v1/shared-voices?page_size=50&category=high_quality', {
      headers: {
        'xi-api-key': cleanKey,
      },
    });

    if (response.status === 401 || response.status === 403) {
        throw new Error("Invalid API key");
    }

    if (!response.ok) {
       throw new Error(`Failed to fetch library: ${response.statusText}`);
    }

    const data = await response.json();
    return data.voices.map((v: any) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category,
      preview_url: v.preview_url,
      public_owner_id: v.public_owner_id,
      description: v.description,
      use_count: v.use_count
    }));
  } catch (error) {
    console.error("Shared Voices Fetch Error:", error);
    return [];
  }
};

export const addSharedVoice = async (apiKey: string, publicOwnerId: string, voiceId: string, name: string): Promise<boolean> => {
  const cleanKey = apiKey?.trim();
  if (!cleanKey) return false;

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/voices/add/${publicOwnerId}/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': cleanKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ new_name: name })
    });

    if (!response.ok) {
       const err = await response.json();
       console.error("Add Voice Error:", err);
       return false;
    }
    return true;
  } catch (error) {
    console.error("Add Voice Exception:", error);
    return false;
  }
};

export const generateSpeech = async (
  apiKey: string, 
  voiceId: string, 
  text: string
): Promise<string | null> => {
  const cleanKey = apiKey?.trim();
  if (!cleanKey) {
     console.error("Missing API Key");
     return null;
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': cleanKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (response.status === 401 || response.status === 403) {
        alert("Speech Generation Failed: Invalid API Key. Please check settings.");
        return null;
    }

    if (!response.ok) {
       const err = await response.json().catch(() => ({ detail: { message: response.statusText } }));
       console.error("ElevenLabs API Error:", JSON.stringify(err, null, 2));
       alert(`Speech Generation Failed: ${err.detail?.message || err.message || response.status}`);
       return null;
    }

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Speech generation error:', error);
    return null;
  }
};

export const generateSpeechToSpeech = async (
  apiKey: string,
  voiceId: string,
  audioBlob: Blob
): Promise<string | null> => {
  const cleanKey = apiKey?.trim();
  if (!cleanKey) return null;

  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  formData.append('model_id', 'eleven_multilingual_sts_v2'); 
  formData.append('voice_settings', JSON.stringify({
    stability: 0.5,
    similarity_boost: 0.75,
  }));

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/speech-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': cleanKey,
        // Content-Type is set automatically by fetch when using FormData
      },
      body: formData,
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: { message: response.statusText } }));
        console.error("ElevenLabs STS API Error:", JSON.stringify(err, null, 2));
        alert(`Speech-to-Speech Failed: ${err.detail?.message || err.message || response.status}`);
        return null;
    }

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('STS generation error:', error);
    return null;
  }
};