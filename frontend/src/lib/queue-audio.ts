const AUDIO_BASE_PATH = "/audio1";

const AUDIO_FILES = {
  in: `${AUDIO_BASE_PATH}/in.wav`,
  out: `${AUDIO_BASE_PATH}/out.wav`,
  nomorUrut: `${AUDIO_BASE_PATH}/nomor-urut.wav`,
  loket: `${AUDIO_BASE_PATH}/loket.wav`,
  belas: `${AUDIO_BASE_PATH}/belas.wav`,
  puluh: `${AUDIO_BASE_PATH}/puluh.wav`,
  ratus: `${AUDIO_BASE_PATH}/ratus.wav`,
  sepuluh: `${AUDIO_BASE_PATH}/sepuluh.wav`,
  sebelas: `${AUDIO_BASE_PATH}/sebelas.wav`,
  seratus: `${AUDIO_BASE_PATH}/seratus.wav`,
} as const;

const DIGIT_AUDIO: Record<number, string> = {
  0: `${AUDIO_BASE_PATH}/0.wav`,
  1: `${AUDIO_BASE_PATH}/1.wav`,
  2: `${AUDIO_BASE_PATH}/2.wav`,
  3: `${AUDIO_BASE_PATH}/3.wav`,
  4: `${AUDIO_BASE_PATH}/4.wav`,
  5: `${AUDIO_BASE_PATH}/5.wav`,
  6: `${AUDIO_BASE_PATH}/6.wav`,
  7: `${AUDIO_BASE_PATH}/7.wav`,
  8: `${AUDIO_BASE_PATH}/8.wav`,
  9: `${AUDIO_BASE_PATH}/9.wav`,
};

const CLIP_GAP_MS = 500;

let sharedAudio: HTMLAudioElement | null = null;

const getSharedAudio = () => {
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = "auto";
  }

  return sharedAudio;
};

const playSingleAudio = (src: string, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const audio = getSharedAudio();

    const cleanup = () => {
      audio.onended = null;
      audio.onerror = null;
      audio.onpause = null;
      signal?.removeEventListener("abort", handleAbort);
    };

    const handleAbort = () => {
      audio.pause();
      audio.currentTime = 0;
      cleanup();
      resolve();
    };

    if (signal?.aborted) {
      resolve();
      return;
    }

    audio.pause();
    audio.currentTime = 0;
    audio.src = src;
    audio.load();

    audio.onended = () => {
      cleanup();
      resolve();
    };

    audio.onerror = () => {
      cleanup();
      reject(new Error(`Failed to play audio: ${src}`));
    };

    signal?.addEventListener("abort", handleAbort, { once: true });

    void audio.play().catch((error) => {
      cleanup();
      reject(error);
    });
  });

const waitBetweenClips = (delayMs: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, delayMs);

    const handleAbort = () => {
      window.clearTimeout(timeoutId);
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    };

    signal?.addEventListener("abort", handleAbort, { once: true });
  });

const buildNumberAudioSequence = (value: number): string[] => {
  if (value < 0) return [];
  if (value === 0) return [DIGIT_AUDIO[0]];
  if (value < 10) return [DIGIT_AUDIO[value]];
  if (value === 10) return [AUDIO_FILES.sepuluh];
  if (value === 11) return [AUDIO_FILES.sebelas];
  if (value < 20) return [DIGIT_AUDIO[value - 10], AUDIO_FILES.belas];
  if (value < 100) {
    const tens = Math.floor(value / 10);
    const remainder = value % 10;
    return [
      DIGIT_AUDIO[tens],
      AUDIO_FILES.puluh,
      ...buildNumberAudioSequence(remainder),
    ];
  }
  if (value === 100) return [AUDIO_FILES.seratus];
  if (value < 200) return [AUDIO_FILES.seratus, ...buildNumberAudioSequence(value - 100)];
  if (value < 1000) {
    const hundreds = Math.floor(value / 100);
    const remainder = value % 100;
    return [
      DIGIT_AUDIO[hundreds],
      AUDIO_FILES.ratus,
      ...buildNumberAudioSequence(remainder),
    ];
  }

  return String(value)
    .split("")
    .map((digit) => DIGIT_AUDIO[Number(digit)])
    .filter(Boolean);
};

const extractNumberValue = (value: string) => {
  const digits = value.match(/\d+/g)?.join("") || "";
  if (!digits) return null;

  const parsed = Number.parseInt(digits, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const extractNumberDigits = (value: string) => value.match(/\d/g) || [];

const buildDigitAudioSequence = (digits: string[]) =>
  digits
    .map((digit) => DIGIT_AUDIO[Number(digit)])
    .filter(Boolean);

const buildQueueNumberClips = (queueNumber: string) => {
  const queueDigits = extractNumberDigits(queueNumber);

  return [
    AUDIO_FILES.in,
    AUDIO_FILES.nomorUrut,
    ...buildDigitAudioSequence(queueDigits),
    AUDIO_FILES.out,
  ];
};

export const extractCounterAudioNumber = (counterLabel: string, fallbackValue?: number) => {
  const extracted = extractNumberValue(counterLabel);
  if (extracted) return extracted;
  return fallbackValue && fallbackValue > 0 ? fallbackValue : null;
};

export const unlockQueueAudio = async () => {
  try {
    const audio = getSharedAudio();
    audio.src = AUDIO_FILES.in;
    audio.muted = true;
    audio.currentTime = 0;
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;
    return true;
  } catch {
    return false;
  }
};

export const playQueueAudioFeedback = async (type: "in" | "out" = "in") => {
  await playSingleAudio(type === "in" ? AUDIO_FILES.in : AUDIO_FILES.out);
};

export const playCounterQueueAnnouncement = async ({
  queueNumber,
  counterNumber,
  signal,
}: {
  queueNumber: string;
  counterNumber: number | null;
  signal?: AbortSignal;
}) => {
  const clips = [
    ...buildQueueNumberClips(queueNumber),
    ...(counterNumber ? [AUDIO_FILES.loket, ...buildNumberAudioSequence(counterNumber)] : []),
  ];

  for (let index = 0; index < clips.length; index += 1) {
    const clip = clips[index];
    if (signal?.aborted) return;
    await playSingleAudio(clip, signal);
    if (index < clips.length - 1) {
      await waitBetweenClips(CLIP_GAP_MS, signal);
    }
  }
};

export const playRoomQueueAnnouncement = async ({
  queueNumber,
  signal,
}: {
  queueNumber: string;
  signal?: AbortSignal;
}) => {
  const clips = buildQueueNumberClips(queueNumber);

  for (let index = 0; index < clips.length; index += 1) {
    const clip = clips[index];
    if (signal?.aborted) return;
    await playSingleAudio(clip, signal);
    if (index < clips.length - 1) {
      await waitBetweenClips(CLIP_GAP_MS, signal);
    }
  }
};