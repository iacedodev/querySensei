/**
 * Running a local relay server will allow you to hide your API key
 * and run custom logic on the server
 *
 * Set the local relay server address to:
 * REACT_APP_LOCAL_RELAY_SERVER_URL=http://localhost:8081
 *
 * This will also require you to set OPENAI_API_KEY= in a `.env` file
 * You can run it with `npm run relay`, in parallel with `npm start`
 */
const LOCAL_RELAY_SERVER_URL: string = process.env.REACT_APP_LOCAL_RELAY_SERVER_URL || '';
const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY || localStorage.getItem('tmp::voice_api_key');

import { useEffect, useRef, useCallback, useState, memo } from 'react';
import { IgsLineChart } from '../components/IgsLineChart';

import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { WavRecorder, WavStreamPlayer } from '../lib/wavtools/index.js';
import { instructions } from '../utils/conversation_config.js';
import { WavRenderer } from '../utils/wav_renderer';

import { X, Edit, Zap, ArrowUp, ArrowDown } from 'react-feather';
import { Button } from '../components/button/Button';
import { Toggle } from '../components/toggle/Toggle';
import { Map } from '../components/Map';

import './ConsolePage.scss';
import { Radar } from 'react-chartjs-2';
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import { parseCSV, getPatientDataByRmId, getHealthDataForChart, getAllIgsScores } from '../utils/csvParser';
import ReactMarkdown from 'react-markdown';
import { TypewriterText } from '../components/typewriter/TypewriterText';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as showdown from 'showdown';

// Al inicio del componente ConsolePage
const markdownConverter = new showdown.Converter({
  tables: true,
  tasklists: true,
  emoji: true,
  simpleLineBreaks: true,
  ghCodeBlocks: true,
  strikethrough: true,
  ghMentions: true
});

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface HealthData {
  current: {
    alimentacion: number;
    psicosalud: number;
    cancer: number;
    corazon: number;
    tabaco: number;
    hepatico: number;
    osteomuscular: number;
    patientName: string;
    igs: number;
  };
  future: {
    alimentacion: number;
    psicosalud: number;
    cancer: number;
    corazon: number;
    tabaco: number;
    hepatico: number;
    osteomuscular: number;
    igs: number;
  };
}

// Add these functions after the existing imports
const HEALTH_DATA_STORAGE_KEY = 'health_assistant_data';

const saveHealthDataToStorage = (data: HealthData) => {
  try {
    localStorage.setItem(HEALTH_DATA_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving health data to localStorage:', error);
  }
};

const loadHealthDataFromStorage = (): HealthData | null => {
  try {
    const storedData = localStorage.getItem(HEALTH_DATA_STORAGE_KEY);
    return storedData ? JSON.parse(storedData) : null;
  } catch (error) {
    console.error('Error loading health data from localStorage:', error);
    return null;
  }
};

const MEMORY_KV_STORAGE_KEY = 'health_assistant_memory';

interface StoredMemoryKv {
  healthRecommendations?: string;
  healthLinks?: HealthLinks;
}

const saveMemoryKvToStorage = (memoryKv: StoredMemoryKv) => {
  try {
    localStorage.setItem(MEMORY_KV_STORAGE_KEY, JSON.stringify(memoryKv));
  } catch (error) {
    console.error('Error saving memory KV to localStorage:', error);
  }
};

const loadMemoryKvFromStorage = (): StoredMemoryKv | null => {
  try {
    const storedMemory = localStorage.getItem(MEMORY_KV_STORAGE_KEY);
    return storedMemory ? JSON.parse(storedMemory) : null;
  } catch (error) {
    console.error('Error loading memory KV from localStorage:', error);
    return null;
  }
};

const HealthRadarChart = ({ data }: { data?: HealthData | null }) => {
  const [allIgsScores, setAllIgsScores] = useState<{ name: string; current: number; future: number; }[]>([]);

  useEffect(() => {
    if (data) {
      setAllIgsScores(getAllIgsScores());
    }
  }, [data]);

  const getPlaceholderContent = () => {
    return '0.0';
  };

  const chartData = {
    labels: ['Alimentación', 'Psicosalud', 'Cáncer', 'Corazón', 'Tabaco', 'Hepático', 'Osteomuscular'],
    datasets: [
      {
        label: 'Valoración Actual',
        data: data ? [
          data.current.alimentacion,
          data.current.psicosalud,
          data.current.cancer,
          data.current.corazon,
          data.current.tabaco,
          data.current.hepatico,
          data.current.osteomuscular
        ] : Array(7).fill(0),
        backgroundColor: 'rgba(250, 189, 47, 0.2)',
        borderColor: 'rgba(250, 189, 47, 1)',
        borderWidth: 1,
      },
      {
        label: 'Valoración Futura',
        data: data ? [
          data.future.alimentacion,
          data.future.psicosalud,
          data.future.cancer,
          data.future.corazon,
          data.future.tabaco,
          data.future.hepatico,
          data.future.osteomuscular
        ] : Array(7).fill(0),
        backgroundColor: 'rgba(36, 56, 115, 0.2)',
        borderColor: 'rgba(36, 56, 115, 1)',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    layout: {
      padding: {
        top: 5 // Adjust this value to increase or decrease the top margin
      }
    },
    scales: {
      r: {
        angleLines: {
          display: true
        },
        suggestedMin: 0,
        suggestedMax: 10,
        ticks: {
          font: {
            family: "'Roboto Mono', monospace",
            size: 10
          }
        },
        pointLabels: {
          font: {
            family: "'Roboto Mono', monospace",
            size: 8
          }
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          font: {
            family: "'Roboto Mono', monospace",
            size: 12
          },
        }
      },
      tooltip: {
        bodyFont: {
          family: "'Roboto Mono', monospace",
          size: 12
        },
        titleFont: {
          family: "'Roboto Mono', monospace",
          size: 12
        }
      }
    }
  };

  return (
    <>
      <div className="igs-score-container current">
        <div className="igs-score">
          {data ? data.current.igs.toFixed(1) : getPlaceholderContent()}
        </div>
      </div>
      <div className="igs-score-container future">
        <div className="igs-score">
          {data ? data.future.igs.toFixed(1) : getPlaceholderContent()}
        </div>
      </div>
      <div className="radar-container">
        <Radar data={chartData} options={options} />
      </div>
      {data && allIgsScores.length > 0 && (
        <div className="line-container">
          <IgsLineChart 
            data={allIgsScores}
            currentPatientName={data.current.patientName} 
          />
        </div>
      )}
    </>
  );
};
/**
 * Type for result from get_weather() function call
 */
interface Coordinates {
  lat: number;
  lng: number;
  location?: string;
  temperature?: {
    value: number;
    units: string;
  };
  wind_speed?: {
    value: number;
    units: string;
  };
}

/**
 * Type for all event logs
 */
interface RealtimeEvent {
  time: string;
  source: 'client' | 'server';
  count?: number;
  event: { [key: string]: any };
}

interface HealthLink {
  url: string;
  title: string;
  description: string;
}

interface HealthLinks {
  youtube: HealthLink;
  website: HealthLink;
}

interface MemoryKv {
  healthRecommendations?: string;
  healthLinks?: HealthLinks;
  onTypewriterComplete?: () => void;
}

// Nuevo componente para los enlaces recomendados
const HealthLinks = ({ links }: { links?: HealthLinks }) => {
  if (!links) return null;

  return (
    <div className="health-links">
      <h3>📚 Enlaces Recomendados</h3>
      <div className="link-container">
        <div className="link-item">
          <h4>🎥 Video Recomendado</h4>
          <a href={links.youtube.url} target="_blank" rel="noopener noreferrer">
            {links.youtube.title}
          </a>
          <p>{links.youtube.description}</p>
        </div>
        <div className="link-item">
          <h4>🌐 Recurso Web</h4>
          <a href={links.website.url} target="_blank" rel="noopener noreferrer">
            {links.website.title}
          </a>
          <p>{links.website.description}</p>
        </div>
      </div>
    </div>
  );
};

// Añadir la nueva interfaz para el reporte
interface HealthReport {
  patientName: string;
  currentDate: string;
  healthData: HealthData;
  recommendations: string;
  links: HealthLinks;
}

export function ConsolePage() {
  const [typewriterComplete, setTypewriterComplete] = useState<(() => void) | null>(null);
  /**
   * Ask user for API Key
   * If we're using the local relay server, we don't need this
   */
  const apiKey = LOCAL_RELAY_SERVER_URL
    ? ''
    : localStorage.getItem('tmp::voice_api_key') ||
      prompt('OpenAI API Key') ||
      '';
  if (apiKey !== '') {
    localStorage.setItem('tmp::voice_api_key', apiKey);
  }

  /**
   * Instantiate:
   * - WavRecorder (speech input)
   * - WavStreamPlayer (speech output)
   * - RealtimeClient (API client)
   */
  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 24000 })
  );
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: 24000 })
  );
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient(
      LOCAL_RELAY_SERVER_URL
        ? { url: LOCAL_RELAY_SERVER_URL }
        : {
            apiKey: apiKey,
            dangerouslyAllowAPIKeyInBrowser: true,
          }
    )
  );

  /**
   * References for
   * - Rendering audio visualization (canvas)
   * - Autoscrolling event logs
   * - Timing delta for event log displays
   */
  const clientCanvasRef = useRef<HTMLCanvasElement>(null);
  const serverCanvasRef = useRef<HTMLCanvasElement>(null);
  const eventsScrollHeightRef = useRef(0);
  const eventsScrollRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<string>(new Date().toISOString());

  /**
   * All of our variables for displaying application state
   * - items are all conversation items (dialog)
   * - realtimeEvents are event logs, which can be expanded
   * - memoryKv is for set_memory() function
   * - coords, marker are for get_weather() function
   */
  const [items, setItems] = useState<ItemType[]>([]);
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<{
    [key: string]: boolean;
  }>({});
  const [isConnected, setIsConnected] = useState(false);
  const [canPushToTalk, setCanPushToTalk] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [memoryKv, setMemoryKv] = useState<MemoryKv>({
    healthRecommendations: '',
    healthLinks: undefined
  });
  const [coords, setCoords] = useState<Coordinates | null>({
    lat: 37.775593,
    lng: -122.418137,
  });
  const [marker, setMarker] = useState<Coordinates | null>(null);

  const [csvLoaded, setCsvLoaded] = useState(false);
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [textInput, setTextInput] = useState('');
  const [hasRecommendations, setHasRecommendations] = useState(false);
  const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load and parse CSV file
    fetch('/data/igs_data.csv')
      .then(response => response.text())
      .then(csvString => parseCSV(csvString))
      .then(() => setCsvLoaded(true))
      .catch(error => console.error('Error loading CSV:', error));
  }, []);

  /**
   * Utility for formatting the timing of logs
   */
  const formatTime = useCallback((timestamp: string) => {
    const startTime = startTimeRef.current;
    const t0 = new Date(startTime).valueOf();
    const t1 = new Date(timestamp).valueOf();
    const delta = t1 - t0;
    const hs = Math.floor(delta / 10) % 100;
    const s = Math.floor(delta / 1000) % 60;
    const m = Math.floor(delta / 60_000) % 60;
    const pad = (n: number) => {
      let s = n + '';
      while (s.length < 2) {
        s = '0' + s;
      }
      return s;
    };
    return `${pad(m)}:${pad(s)}.${pad(hs)}`;
  }, []);

  /**
   * When you click the API key
   */
  const resetAPIKey = useCallback(() => {
    const apiKey = prompt('OpenAI API Key');
    if (apiKey !== null) {
      localStorage.clear();
      localStorage.setItem('tmp::voice_api_key', apiKey);
      window.location.reload();
    }
  }, []);

  /**
   * Connect to conversation:
   * WavRecorder taks speech input, WavStreamPlayer output, client is API client
   */
  const connectConversation = useCallback(async () => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    // Set state variables
    startTimeRef.current = new Date().toISOString();
    setIsConnected(true);
    setRealtimeEvents([]);
    setItems(client.conversation.getItems());
    setHealthData(null); // Add this line to reset health data

    // Connect to microphone
    await wavRecorder.begin();

    // Connect to audio output
    await wavStreamPlayer.connect();

    // Connect to realtime API
    await client.connect();
    client.sendUserMessageContent([
      {
        type: `input_text`,
        text: `Hola!`,
        // text: `For testing purposes, I want you to list ten car brands. Number each item, e.g. "one (or whatever number you are one): the item name".`
      },
    ]);

    if (client.getTurnDetectionType() === 'server_vad') {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
  }, []);

  /**
   * Disconnect and reset conversation state
   */
  const disconnectConversation = useCallback(async () => {
    setIsConnected(false);
    setRealtimeEvents([]);
    setItems([]);
    setMemoryKv({});
    setCoords({
      lat: 37.775593,
      lng: -122.418137,
    });
    setMarker(null);
    setHealthData(null);
    localStorage.removeItem(HEALTH_DATA_STORAGE_KEY); // Clear stored health data
    localStorage.removeItem(MEMORY_KV_STORAGE_KEY); // Clear stored memory KV
    setHasRecommendations(false);

    const client = clientRef.current;
    client.disconnect();

    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();

    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.interrupt();
  }, []);

  const deleteConversationItem = useCallback(async (id: string) => {
    const client = clientRef.current;
    client.deleteItem(id);
  }, []);

  /**
   * In push-to-talk mode, start recording
   * .appendInputAudio() for each sample
   */
  const startRecording = async () => {
    setIsRecording(true);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const trackSampleOffset = await wavStreamPlayer.interrupt();
    if (trackSampleOffset?.trackId) {
      const { trackId, offset } = trackSampleOffset;
      await client.cancelResponse(trackId, offset);
    }
    await wavRecorder.record((data) => client.appendInputAudio(data.mono));
  };

  /**
   * In push-to-talk mode, stop recording
   */
  const stopRecording = async () => {
    setIsRecording(false);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.pause();
    client.createResponse();
  };
  const handleTextSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (textInput.trim() === '') return;

  const client = clientRef.current;
  client.sendUserMessageContent([
    {
      type: 'input_text',
      text: textInput,
    },
  ]);
    setTextInput('');
  };

  /**
   * Switch between Manual <> VAD mode for communication
   */
  const changeTurnEndType = async (value: string) => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    if (value === 'none' && wavRecorder.getStatus() === 'recording') {
      await wavRecorder.pause();
    }
    client.updateSession({
      turn_detection: value === 'none' ? null : { type: 'server_vad' },
    });
    if (value === 'server_vad' && client.isConnected()) {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
    setCanPushToTalk(value === 'none');
  };

  /**
   * Auto-scroll the event logs
   */
  useEffect(() => {
    if (eventsScrollRef.current) {
      const eventsEl = eventsScrollRef.current;
      const scrollHeight = eventsEl.scrollHeight;
      // Only scroll if height has just changed
      if (scrollHeight !== eventsScrollHeightRef.current) {
        eventsEl.scrollTop = scrollHeight;
        eventsScrollHeightRef.current = scrollHeight;
      }
    }
  }, [realtimeEvents]);

  /**
   * Auto-scroll the conversation logs
   */
  useEffect(() => {
    const conversationEls = [].slice.call(
      document.body.querySelectorAll('[data-conversation-content]')
    );
    for (const el of conversationEls) {
      const conversationEl = el as HTMLDivElement;
      conversationEl.scrollTop = conversationEl.scrollHeight;
    }
  }, [items]);

  /**
   * Set up render loops for the visualization canvas
   */
  useEffect(() => {
    let isLoaded = true;

    const wavRecorder = wavRecorderRef.current;
    const clientCanvas = clientCanvasRef.current;
    let clientCtx: CanvasRenderingContext2D | null = null;

    const wavStreamPlayer = wavStreamPlayerRef.current;
    const serverCanvas = serverCanvasRef.current;
    let serverCtx: CanvasRenderingContext2D | null = null;

    const render = () => {
      if (isLoaded) {
        if (clientCanvas) {
          if (!clientCanvas.width || !clientCanvas.height) {
            clientCanvas.width = clientCanvas.offsetWidth;
            clientCanvas.height = clientCanvas.offsetHeight;
          }
          clientCtx = clientCtx || clientCanvas.getContext('2d');
          if (clientCtx) {
            clientCtx.clearRect(0, 0, clientCanvas.width, clientCanvas.height);
            const result = wavRecorder.recording
              ? wavRecorder.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              clientCanvas,
              clientCtx,
              result.values,
              '#0099ff',
              10,
              0,
              8
            );
          }
        }
        if (serverCanvas) {
          if (!serverCanvas.width || !serverCanvas.height) {
            serverCanvas.width = serverCanvas.offsetWidth;
            serverCanvas.height = serverCanvas.offsetHeight;
          }
          serverCtx = serverCtx || serverCanvas.getContext('2d');
          if (serverCtx) {
            serverCtx.clearRect(0, 0, serverCanvas.width, serverCanvas.height);
            const result = wavStreamPlayer.analyser
              ? wavStreamPlayer.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              serverCanvas,
              serverCtx,
              result.values,
              '#009900',
              10,
              0,
              8
            );
          }
        }
        window.requestAnimationFrame(render);
      }
    };
    render();

    return () => {
      isLoaded = false;
    };
  }, []);

  useEffect(() => {
    // Get refs
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const client = clientRef.current;

    // Set instructions
    client.updateSession({ instructions: instructions });
    // Set transcription, otherwise we don't get user transcriptions back
    client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });

    client.addTool(
      {
        name: 'get_health_data',
        description: 'Retrieves health data based on the patient name and surnames its very important to get this data properly',
        parameters: {
          type: 'object',
          properties: {
            patientName: {
              type: 'string',
              description: 'The patient name and surnames',
            },
          },
          required: ['patientName'],
        },
      },
      async ({ patientName }: { patientName: string }) => {
        try {
          const data = await getHealthDataForChart(patientName);
          if (data) {
            setHealthData(data as unknown as HealthData);
            saveHealthDataToStorage(data as HealthData);
            return `Datos de salud obtenidos correctamente para ${data.current.patientName}, se muestran de manera grafica en la esquina superior derecha, los datos son: ${JSON.stringify(data)}`;
          } else {
            setHealthData(null);
            return 'No se pudieron obtener los datos del paciente. Por favor, inténtelo de nuevo.';
          }
        } catch (error) {
          console.error('Error:', error);
          setHealthData(null);
          return 'Hubo un error al obtener los datos. Por favor, inténtelo de nuevo en unos momentos.';
        }
      }
    );
    client.addTool(
      {
        name: 'get_weather',
        description:
          'Retrieves the weather for a given lat, lng coordinate pair. Specify a label for the location.',
        parameters: {
          type: 'object',
          properties: {
            lat: {
              type: 'number',
              description: 'Latitude',
            },
            lng: {
              type: 'number',
              description: 'Longitude',
            },
            location: {
              type: 'string',
              description: 'Name of the location',
            },
          },
          required: ['lat', 'lng', 'location'],
        },
      },
      async ({ lat, lng, location }: { [key: string]: any }) => {
        setMarker({ lat, lng, location });
        setCoords({ lat, lng, location });
        const result = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m`
        );
        const json = await result.json();
        const temperature = {
          value: json.current.temperature_2m as number,
          units: json.current_units.temperature_2m as string,
        };
        const wind_speed = {
          value: json.current.wind_speed_10m as number,
          units: json.current_units.wind_speed_10m as string,
        };
        setMarker({ lat, lng, location, temperature, wind_speed });
        return json;
      }
    );
    client.addTool(
      {
        name: 'get_health_recommendations',
        description: 'Generates personalized health recommendations based on the patient\'s health data using AI',
        parameters: {
          type: 'object',
          properties: {
            patientName: {
              type: 'string',
              description: 'The patient\'s full name',
            },
          },
          required: ['patientName'],
        },
      },
      async ({ patientName }: { patientName: string }) => {
        setIsGeneratingRecommendations(true);
        const data = getHealthDataForChart(patientName);
        if (!data) {
          setHasRecommendations(false);
          setIsGeneratingRecommendations(false);
          return 'Patient data not found. Unable to generate recommendations.';
        }

        // Filter areas with scores below 5
        const lowScoreAreas = [
          { name: 'Alimentación', value: data.current.alimentacion, future: data.future.alimentacion },
          { name: 'Psicosalud', value: data.current.psicosalud, future: data.future.psicosalud },
          { name: 'Cáncer', value: data.current.cancer, future: data.future.cancer },
          { name: 'Corazón', value: data.current.corazon, future: data.future.corazon },
          { name: 'Tabaco', value: data.current.tabaco, future: data.future.tabaco },
          { name: 'Hepático', value: data.current.hepatico, future: data.future.hepatico },
          { name: 'Osteomuscular', value: data.current.osteomuscular, future: data.future.osteomuscular }
        ].filter(area => typeof area.value === 'number' && area.value < 5);

        if (lowScoreAreas.length === 0) {
          setHasRecommendations(false);
          setIsGeneratingRecommendations(false);
          return 'All health areas are within normal ranges. No specific recommendations needed.';
        }

        // Prepare the prompt for the AI
        const prompt = `Como experto en salud, genera recomendaciones breves, visuales y personalizadas para un paciente que necesita mejorar en las siguientes áreas de salud:

${lowScoreAreas.map(area => `- ${area.name} (Puntuación actual: ${typeof area.value === 'number' ? area.value.toFixed(1) : area.value}, Proyección a 5 años: ${typeof area.future === 'number' ? area.future.toFixed(1) : area.future})`).join('\n')}

Para cada área, genera una respuesta muy concisa siguiendo este formato:
## Tu Plan de Salud Personalizado ✨
[Para cada área]
### [emoji] [Nombre del Área] - [X.X]
#### ⚠️ Importancia:
[Una sola frase impactante sobre por qué es crucial mejorar]
#### 💡 Acciones Clave:
- [Acción específica 1]
- [Acción específica 2]
- [Acción específica 3]
#### 📅 Hábitos Diarios:
- [Hábito 1]
- [Hábito 2]
#### 📈 Señales de Mejora:
- ✅ [Señal 1]
- ✅ [Señal 2]

Importante:
- Mantén cada sección muy breve y directa
- Usa lenguaje motivador y positivo
- Cada explicación debe ser de máximo una línea
- Incluye emojis relevantes en cada recomendación
- Debes agregar emojis entre el texto para mejorar el enganche
- Usa el mínimo espacio posible entre secciones`;

        try {
          if (!OPENAI_API_KEY) {
            throw new Error('OpenAI API key is not configured. Please check your .env file.');
          }

          // Make the API call to OpenAI
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              model: "gpt-4o",
              messages: [
                {
                  role: "system",
                  content: "You are a health expert specialized in providing personalized health recommendations in Spanish."
                },
                {
                  role: "user",
                  content: prompt
                }
              ],
              temperature: 0.4,
              max_tokens: 1000
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error('OpenAI API Error:', errorData);
            throw new Error(`API call failed: ${errorData.error?.message || 'Unknown error'}`);
          }

          const result = await response.json();
          const recommendations = result.choices[0].message.content;

          // Crear una promesa que se resolverá cuando el typewriter termine
          const typewriterComplete = new Promise<void>((resolve) => {
            setMemoryKv((prevState) => ({
              ...prevState,
              healthLinks: undefined,
              healthRecommendations: recommendations,
              onTypewriterComplete: resolve  // Guardamos la función resolve
            }));
          });

          setHasRecommendations(true);
          setIsGeneratingRecommendations(false);

          // Esperar a que el typewriter termine
          await typewriterComplete;
          return 'Personalized health recommendations generated successfully.';
        } catch (error) {
          setIsGeneratingRecommendations(false);
          console.error('Error generating recommendations:', error);
          return `Error generating recommendations: ${error}`;
        }
      }
    );
    client.addTool(
      {
        name: 'get_health_links',
        description: 'Provides recommended YouTube video and website links based on patient health data',
        parameters: {
          type: 'object',
          properties: {
            patientName: {
              type: 'string',
              description: 'The patient\'s full name',
            },
          },
          required: ['patientName'],
        },
      },
      async ({ patientName }: { patientName: string }) => {
        try {
          const data = await getHealthDataForChart(patientName);
          if (!data) {
            return 'No se encontraron datos del paciente para generar recomendaciones.';
          }

          // Identificar áreas problemáticas
          const lowScoreAreas = [
            { name: 'Alimentación', value: data.current.alimentacion },
            { name: 'Psicosalud', value: data.current.psicosalud },
            { name: 'Cáncer', value: data.current.cancer },
            { name: 'Corazón', value: data.current.corazon },
            { name: 'Tabaco', value: data.current.tabaco },
            { name: 'Hepático', value: data.current.hepatico },
            { name: 'Osteomuscular', value: data.current.osteomuscular }
          ].filter(area => typeof area.value === 'number' && area.value < 5);

          if (lowScoreAreas.length === 0) {
            return 'Todas las áreas de salud están en rangos normales. No se requieren recomendaciones específicas.';
          }

          // Preparar el prompt para OpenAI
          const prompt = `Como experto en salud, proporciona exactamente dos enlaces relevantes para ayudar a mejorar en las siguientes áreas de salud , si hay varias areas a mejorar , proporciona los enlaces mas relevantes , pero siempre exactamente 2, no debes hacer ningun comentario adicional , limitate a devolver los 2 enlaces en formato JSON:
          ${lowScoreAreas.map(area => `- ${area.name} (Puntuación: ${area.value})`).join('\n')}

          Formato requerido (respeta exactamente este formato JSON):
          {
            "youtube": {
              "url": "URL del video de YouTube más relevante debe ser un video actual y relevante , que no este eliminado o obsoleto",
              "title": "Título descriptivo del video",
              "description": "Breve descripción de por qué es útil"
            },
            "website": {
              "url": "URL del sitio web más relevante debe ser un sitio web actual y relevante, que no este eliminado o obsoleto y en español",
              "title": "Título del recurso web",
              "description": "Breve descripción de por qué es útil"
            }
          }`;

          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              model: "gpt-4-turbo",
              messages: [
                {
                  role: "system",
                  content: "Eres un experto en salud que proporciona enlaces relevantes y confiables."
                },
                {
                  role: "user",
                  content: prompt
                }
              ],
              temperature: 0.7,
              max_tokens: 500
            })
          });

          if (!response.ok) {
            throw new Error('Error al obtener recomendaciones de enlaces');
          }

          const result = await response.json();
          console.log('result', result);
          const links = JSON.parse(result.choices[0].message.content);
          setMemoryKv((prevState) => {
            const newState = {
              ...prevState,
              healthLinks: links
            };
            saveMemoryKvToStorage(newState);
            // Programamos el scroll suave después de que los enlaces se hayan renderizado
            setTimeout(() => {
              if (scrollContainerRef.current) {
                const recommendationsContainer = scrollContainerRef.current;
                const linksSection = recommendationsContainer.querySelector('.recommendations-links');
                if (linksSection) {
                  linksSection.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'start'
                  });
                }
              }
            }, 500); // Damos más tiempo para que el contenido se renderice

            return newState;
          });
          return `He encontrado algunos recursos útiles para mejorar tu salud. Puedes encontrarlos en la sección de enlaces recomendados.`;
        } catch (error) {
          console.error('Error:', error);
          return 'Hubo un error al obtener los enlaces recomendados.';
        }
      }
    );
    client.addTool({
      name: 'export_health_report',
      description: 'Exports a detailed health report in PDF format',
      parameters: {
        type: 'object',
        properties: {
          patientName: {
            type: 'string',
            description: 'Name of the patient'
          }
        },
        required: ['patientName']
      },
    },
      async ({ patientName }: { patientName: string }) => {
        console.log('healthData', healthData);
        const dataToExport = loadHealthDataFromStorage();
        const memoryKvToExport = loadMemoryKvFromStorage();
        if (!dataToExport || !memoryKvToExport) {
          return 'No hay datos de salud disponibles para generar el informe.';
        }
        return await exportHealthReport(patientName, dataToExport, memoryKvToExport);
      }
    );

    // handle realtime events from client + server for event logging
    client.on('realtime.event', (realtimeEvent: RealtimeEvent) => {
      setRealtimeEvents((realtimeEvents) => {
        const lastEvent = realtimeEvents[realtimeEvents.length - 1];
        if (lastEvent?.event.type === realtimeEvent.event.type) {
          // if we receive multiple events in a row, aggregate them for display purposes
          lastEvent.count = (lastEvent.count || 0) + 1;
          return realtimeEvents.slice(0, -1).concat(lastEvent);
        } else {
          return realtimeEvents.concat(realtimeEvent);
        }
      });
    });
    client.on('error', (event: any) => console.error(event));
    client.on('conversation.interrupted', async () => {
      const trackSampleOffset = await wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
    });
    client.on('conversation.updated', async ({ item, delta }: any) => {
      const items = client.conversation.getItems();
      if (delta?.audio) {
        wavStreamPlayer.add16BitPCM(delta.audio, item.id);
      }
      if (item.status === 'completed' && item.formatted.audio?.length) {
        const wavFile = await WavRecorder.decode(
          item.formatted.audio,
          24000,
          24000
        );
        item.formatted.file = wavFile;
      }
      setItems(items);
    });

    setItems(client.conversation.getItems());

    return () => {
      client.reset();
    };
  }, []);

  useEffect(() => {
    console.log('memoryKv actualizado:', memoryKv);
  }, [memoryKv]);

  /**
   * Render the application
   */
  return (
    <div data-component="ConsolePage">
      <div className="content-top">
        <div className="content-title">
          <img src="/icon-aitaly.svg" />
          <span>Asistente de salud</span>
        </div>
        <div className="content-api-key">
          {!LOCAL_RELAY_SERVER_URL && (
            <Button
              icon={Edit}
              iconPosition="end"
              buttonStyle="flush"
              label={`api key: ${apiKey.slice(0, 3)}...`}
              onClick={() => resetAPIKey()}
            />
          )}
        </div>
      </div>
      <div className="content-main">
        <div className="content-logs">
          <div className="content-block events">
            <div className="visualization">
              <div className="visualization-entry client">
                <canvas ref={clientCanvasRef} />
              </div>
              <div className="visualization-entry server">
                <canvas ref={serverCanvasRef} />
              </div>
            </div>
            <div className="content-block-title">eventos</div>
            <div className="content-block-body" ref={eventsScrollRef}>
              {!realtimeEvents.length && `Esperando conexión...`}
              {realtimeEvents.map((realtimeEvent, i) => {
                const count = realtimeEvent.count;
                const event = { ...realtimeEvent.event };
                if (event.type === 'input_audio_buffer.append') {
                  event.audio = `[trimmed: ${event.audio.length} bytes]`;
                } else if (event.type === 'response.audio.delta') {
                  event.delta = `[trimmed: ${event.delta.length} bytes]`;
                }
                return (
                  <div className="event" key={event.event_id}>
                    <div className="event-timestamp">
                      {formatTime(realtimeEvent.time)}
                    </div>
                    <div className="event-details">
                      <div
                        className="event-summary"
                        onClick={() => {
                          // toggle event details
                          const id = event.event_id;
                          const expanded = { ...expandedEvents };
                          if (expanded[id]) {
                            delete expanded[id];
                          } else {
                            expanded[id] = true;
                          }
                          setExpandedEvents(expanded);
                        }}
                      >
                        <div
                          className={`event-source ${
                            event.type === 'error'
                              ? 'error'
                              : realtimeEvent.source
                          }`}
                        >
                          {realtimeEvent.source === 'client' ? (
                            <ArrowUp />
                          ) : (
                            <ArrowDown />
                          )}
                          <span>
                            {event.type === 'error'
                              ? 'error!'
                              : realtimeEvent.source}
                          </span>
                        </div>
                        <div className="event-type">
                          {event.type}
                          {count && ` (${count})`}
                        </div>
                      </div>
                      {!!expandedEvents[event.event_id] && (
                        <div className="event-payload">
                          {JSON.stringify(event, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="content-block conversation">
            <div className="content-block-title">conversación</div>
            <div className="content-block-body" data-conversation-content>
              {!items.length && `Esperando conexión...`}
              {items.map((conversationItem, i) => {
                return (
                  <div className="conversation-item" key={conversationItem.id}>
                    <div className={`speaker ${conversationItem.role || ''}`}>
                      <div>
                        {(
                          conversationItem.role || conversationItem.type
                        ).replaceAll('_', ' ')}
                      </div>
                      <div
                        className="close"
                        onClick={() =>
                          deleteConversationItem(conversationItem.id)
                        }
                      >
                        <X />
                      </div>
                    </div>
                    <div className={`speaker-content`}>
                      {/* tool response */}
                      {conversationItem.type === 'function_call_output' && (
                        <div>{conversationItem.formatted.output}</div>
                      )}
                      {/* tool call */}
                      {!!conversationItem.formatted.tool && (
                        <div>
                          {conversationItem.formatted.tool.name}(
                          {conversationItem.formatted.tool.arguments})
                        </div>
                      )}
                      {!conversationItem.formatted.tool &&
                        conversationItem.role === 'user' && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              (conversationItem.formatted.audio?.length
                                ? '(awaiting transcript)'
                                : conversationItem.formatted.text ||
                                  '(item sent)')}
                          </div>
                        )}
                      {!conversationItem.formatted.tool &&
                        conversationItem.role === 'assistant' && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              conversationItem.formatted.text ||
                              '(truncated)'}
                          </div>
                        )}
                      {conversationItem.formatted.file && (
                        <audio
                          src={conversationItem.formatted.file.url}
                          controls
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="content-actions">
            <form onSubmit={handleTextSubmit} className="text-input-form">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Escribe tu mensaje aquí..."
              />
            </form>
            <Toggle
              defaultValue={false}
              labels={['manual', 'fluid']}
              values={['none', 'server_vad']}
              onChange={(_, value) => changeTurnEndType(value)}
            />
            <div className="spacer" />
            {isConnected && canPushToTalk && (
              <Button
                label={isRecording ? 'release to send' : 'push to talk'}
                buttonStyle={isRecording ? 'alert' : 'regular'}
                disabled={!isConnected || !canPushToTalk}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
              />
            )}
            <div className="spacer" />
            <Button
              label={isConnected ? 'desconectar' : 'conectar'}
              iconPosition={isConnected ? 'end' : 'start'}
              icon={isConnected ? X : Zap}
              buttonStyle={isConnected ? 'regular' : 'action'}
              onClick={
                isConnected ? disconnectConversation : connectConversation
              }
            />
          </div>
        </div>
        <div className="content-right">
          <div className={`content-block map ${hasRecommendations ? 'recommendations-active' : ''}`}>
            <div className="content-block-title bottom">
              {healthData?.current.patientName || 'Información de salud'}
            </div>
            <div className="content-block-body full" style={{ overflow: 'hidden' }}>
              <div className="chart-wrapper">
                <div className="chart-content">
                  <HealthRadarChart data={healthData} />
                </div>
              </div>
            </div>
          </div>
          <div className={`content-block kv ${hasRecommendations ? 'recommendations-active' : ''}`}>
            <div 
              className={`collapse-button ${!hasRecommendations ? 'collapsed' : ''}`} 
              onClick={() => setHasRecommendations(!hasRecommendations)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </div>
            <div className="content-block-body content-kv">
              <div className="recommendations-container" ref={scrollContainerRef}>
                {isGeneratingRecommendations ? (
                  <div className="generating-text">
                    Generando recomendaciones personalizadas<span className="dots">...</span>
                  </div>
                ) : (
                  <>
                    <div className="recommendations-text">
                      <TypewriterText 
                        text={memoryKv.healthRecommendations || ''} 
                        speed={10} 
                        onTextUpdate={() => {
                          if (scrollContainerRef.current) {
                            scrollContainerRef.current.scrollTo({
                              top: scrollContainerRef.current.scrollHeight,
                              behavior: 'smooth',
                            });
                          }
                        }}
                        onComplete={() => {
                          memoryKv.onTypewriterComplete?.();
                        }}
                      />
                    </div>
                    {memoryKv.healthLinks && (
                      <div className="recommendations-links">
                        <HealthLinks links={memoryKv.healthLinks} />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function generateHealthRecommendations(data: HealthData): string {
  let recommendations = '# Health Recommendations 🏥\n\n';
  const areas = [
    { name: 'Alimentación', value: data.current.alimentacion, emoji: '🍎' },
    { name: 'Psicosalud', value: data.current.psicosalud, emoji: '🧠' },
    { name: 'Cáncer', value: data.current.cancer, emoji: '🎗️' },
    { name: 'Corazón', value: data.current.corazon, emoji: '❤️' },
    { name: 'Tabaco', value: data.current.tabaco, emoji: '🚭' },
    { name: 'Hepático', value: data.current.hepatico, emoji: '🫓' },
    { name: 'Osteomuscular', value: data.current.osteomuscular, emoji: '🦴' },
  ];

  areas.forEach(area => {
    if (area.value < 5) {
      recommendations += `## ${area.emoji} ${area.name}\n\n`;
      recommendations += `Your score in ${area.name} is ${area.value.toFixed(1)}, which is below the recommended level. Here are some suggestions:\n\n`;
      recommendations += `- ${getRecommendation(area.name)}\n`;
      recommendations += `- Consult with a specialist for personalized advice.\n\n`;
    }
  });

  return recommendations;
}

function getRecommendation(area: string): string {
  const recommendations: Record<string, string> = {
    'Alimentación': 'Incorporate more fruits and vegetables into your diet.',
    'Psicosalud': 'Practice mindfulness or meditation for stress reduction.',
    'Cáncer': 'Ensure you\'re up to date with all recommended cancer screenings.',
    'Corazón': 'Engage in regular cardiovascular exercise, like brisk walking or swimming.',
    'Tabaco': 'Consider joining a smoking cessation program or using nicotine replacement therapy.',
    'Hepático': 'Limit alcohol consumption and maintain a balanced diet.',
    'Osteomuscular': 'Incorporate strength training exercises into your routine.',
  };
  return recommendations[area] || 'Consult with your doctor for specific recommendations.';
}

const exportHealthReport = async (
  patientName: string, 
  healthData: HealthData,
  memoryKv: StoredMemoryKv
) => {
  try {
    // Crear un contenedor temporal para el informe
    const reportContainer = document.createElement('div');
    reportContainer.className = 'health-report-pdf';
    document.body.appendChild(reportContainer);
    console.log('healthData', healthData);
    console.log('memoryKv', memoryKv);

    // Esperar a que los datos estén disponibles
    if (!healthData || !memoryKv.healthRecommendations) {
      throw new Error('No hay datos disponibles para generar el informe');
    }

    // Generar el HTML del informe
    const recommendationsHtml = markdownConverter.makeHtml(memoryKv.healthRecommendations || '');

    reportContainer.innerHTML = `
      <div class="report-container">
        <div class="report-header">
          <img src="/icon-aitaly.svg" alt="Logo" width="60" />
          <h1>Informe de Salud</h1>
          <p class="date">${new Date().toLocaleDateString('es-ES')}</p>
        </div>
        
        <div class="patient-info">
          <h2>Paciente: ${patientName}</h2>
          <div class="health-metrics">
            <h3>Métricas de Salud Actuales</h3>
            <ul>
              <li>Alimentación: ${healthData.current.alimentacion.toFixed(1)}</li>
              <li>Psicosalud: ${healthData.current.psicosalud.toFixed(1)}</li>
              <li>Cáncer: ${healthData.current.cancer.toFixed(1)}</li>
              <li>Corazón: ${healthData.current.corazon.toFixed(1)}</li>
              <li>Tabaco: ${healthData.current.tabaco.toFixed(1)}</li>
              <li>Hepático: ${healthData.current.hepatico.toFixed(1)}</li>
              <li>Osteomuscular: ${healthData.current.osteomuscular.toFixed(1)}</li>
              <li><strong>IGS Actual: ${healthData.current.igs.toFixed(1)}</strong></li>
              <li><strong>IGS Proyectado: ${healthData.future.igs.toFixed(1)}</strong></li>
            </ul>
          </div>
        </div>
        <div class="recommendations">
          <h3>Recomendaciones Personalizadas</h3>
          ${recommendationsHtml}
        </div>

        <div class="resources">
          <h3>Recursos Recomendados</h3>
          ${memoryKv.healthLinks ? `
            <div class="resource-item">
              <h4>🎥 Video Recomendado</h4>
              <p><strong>${memoryKv.healthLinks.youtube.title}</strong></p>
              <p><a href="${memoryKv.healthLinks.youtube.url}">${memoryKv.healthLinks.youtube.url}</a></p>
              <p>${memoryKv.healthLinks.youtube.description}</p>
            </div>
            <div class="resource-item">
              <h4>🌐 Recurso Web</h4>
              <p><strong>${memoryKv.healthLinks.website.title}</strong></p>
              <p><a href="${memoryKv.healthLinks.website.url}">${memoryKv.healthLinks.website.url}</a></p>
              <p>${memoryKv.healthLinks.website.description}</p>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // Añadir estilos específicos para el PDF
    const style = document.createElement('style');
    style.textContent = `
     .health-report-pdf {
    padding: 40px;
    font-family: Arial, sans-serif;
    color: #ffffff;
    background-color: #1d2021;
    min-height: 100vh;
  }
  .report-container {
    max-width: 800px;
    margin: 0 auto;
    background-color: #1d2021;
    min-height: 100vh;
    padding-bottom: 40px;
  }
  .health-metrics ul {
    list-style: none;
    padding: 0;
  }
  .health-metrics li {
    margin: 8px 0;
    padding: 5px 10px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }
  .report-header {
    text-align: center;
    margin-bottom: 30px;
    border-bottom: 2px solid #fabd2f;
    padding-bottom: 20px;
  }
  .patient-info {
    margin: 20px 0;
    padding: 15px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
  }
  .health-chart {
    margin: 30px 0;
    padding: 20px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
  }
  .recommendations {
    margin: 30px 0;
    padding: 20px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
  }
  .resources {
    margin-top: 30px;
  }
  .resource-item {
    margin: 15px 0;
    padding: 15px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
  }
  a {
    color: #4a9eff;
    text-decoration: underline;
  }
  h1, h2, h3, h4 {
    color: #fabd2f;
  }
    `;
    document.head.appendChild(style);
  // Esperar a que el contenido se renderice
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generar el PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Obtener el canvas de la sección a imprimir
    const canvas = await html2canvas(reportContainer, {
      scale: 2,
      backgroundColor: '#1d2021',
      logging: false,
      useCORS: true,
      allowTaint: true
    });

    const imgHeight = (canvas.height * pdfWidth) / canvas.width;
    const totalPages = Math.ceil(imgHeight / pdfHeight);

    for (let i = 0; i < totalPages; i++) {
      if (i > 0) {
        pdf.addPage();
      }

      // Crear un canvas temporal para cada página
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = (canvas.height / totalPages);

      const pageContext = pageCanvas.getContext('2d');
      // Dibujar la porción correspondiente de la imagen original
      pageContext?.drawImage(
        canvas,
        0,
        i * pageCanvas.height,
        pageCanvas.width,
        pageCanvas.height,
        0,
        0,
        pageCanvas.width,
        pageCanvas.height
      );

      // Convertir el canvas temporal a imagen
      const imgData = pageCanvas.toDataURL('image/png');
      // Agregar la imagen al PDF
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    }

    // Guardar el PDF
    pdf.save(`informe_salud_${patientName.toLowerCase().replace(/\s+/g, '_')}.pdf`);

    // Limpiar
    document.body.removeChild(reportContainer);
    document.head.removeChild(style);

    return 'Informe de salud exportado exitosamente.';
  } catch (error) {
    console.error('Error al generar el PDF:', error);
    return 'Hubo un error al generar el informe de salud.';
  }
};