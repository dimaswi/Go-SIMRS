import { playQueueAudioFeedback, unlockQueueAudio } from "@/lib/queue-audio";

const SHARED_ANNOUNCER_CHANNEL = "shared-queue-announcer";
const SHARED_ANNOUNCER_QUEUE_KEY = "shared-queue-announcer-queue";
const SHARED_ANNOUNCER_CLAIMED_KEY = "shared-queue-announcer-claimed";
const SHARED_ANNOUNCER_SPEAKER_LOCK = "shared-queue-announcer-speaker";
const SHARED_ANNOUNCEMENT_CLIP_GAP_MS = 500;
const SHARED_ANNOUNCEMENT_QUEUE_DELAY_MS = 1000;
const SHARED_ANNOUNCEMENT_SPEECH_DEDUP_MS = 3500;
const SHARED_ANNOUNCEMENT_SPEECH_RATE = 0.8;
const SHARED_ANNOUNCEMENT_SPEECH_PITCH = 1;
const SHARED_ANNOUNCEMENT_SPEECH_VOLUME = 1;
const SHARED_ANNOUNCEMENT_MAX_ITEMS = 100;

const INDONESIAN_VOICE_NAME_PRIORITY = [
  "Google Bahasa Indonesia",
  "Microsoft Gadis Online (Natural) - Indonesian (Indonesia)",
  "Microsoft Gadis",
  "Bahasa Indonesia",
  "Indonesian",
  "id-ID",
];

type SharedCounterAnnouncement = {
  id: string;
  kind: "counter";
  speechText: string;
  createdAt: number;
};

type SharedRoomAnnouncement = {
  id: string;
  kind: "room";
  speechText: string;
  createdAt: number;
};

export type SharedQueueAnnouncement = SharedCounterAnnouncement | SharedRoomAnnouncement;

type SharedAnnouncementMessage = {
  type: "enqueue";
  announcementId: string;
};

type SharedAnnouncerState = {
  isAnnouncing: boolean;
  isLeader: boolean;
  isEnabled: boolean;
};

type SharedEnableResult = {
  audioReady: boolean;
  speechReady: boolean;
  hasIndonesianVoice: boolean;
  isLeader: boolean;
};

const supportsBroadcastChannel = typeof BroadcastChannel !== "undefined";

let pendingAnnouncements: SharedQueueAnnouncement[] = [];
let seenAnnouncementIds = new Set<string>();
let isEnabled = false;
let isAnnouncing = false;
let isProcessingQueue = false;

const stateListeners = new Set<(state: SharedAnnouncerState) => void>();
const sharedChannel = supportsBroadcastChannel
  ? new BroadcastChannel(SHARED_ANNOUNCER_CHANNEL)
  : null;

const waitForDelay = (delayMs: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs);
  });

const getPreferredIndonesianVoice = () => {
  if (!("speechSynthesis" in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  const indonesianVoices = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith("id")
  );

  if (indonesianVoices.length === 0) {
    return null;
  }

  const sortedVoices = [...indonesianVoices].sort((left, right) => {
    const leftIndex = INDONESIAN_VOICE_NAME_PRIORITY.findIndex((keyword) =>
      left.name.toLowerCase().includes(keyword.toLowerCase()) ||
      left.voiceURI.toLowerCase().includes(keyword.toLowerCase())
    );
    const rightIndex = INDONESIAN_VOICE_NAME_PRIORITY.findIndex((keyword) =>
      right.name.toLowerCase().includes(keyword.toLowerCase()) ||
      right.voiceURI.toLowerCase().includes(keyword.toLowerCase())
    );

    const leftScore = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const rightScore = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;

    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }

    if (left.default !== right.default) {
      return left.default ? -1 : 1;
    }

    if (left.localService !== right.localService) {
      return left.localService ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });

  return sortedVoices[0] || null;
};

const getSharedAnnouncerState = (): SharedAnnouncerState => ({
  isAnnouncing,
  isLeader: isEnabled,
  isEnabled,
});

const notifyStateListeners = () => {
  const state = getSharedAnnouncerState();
  stateListeners.forEach((listener) => listener(state));
};

type ClaimedAnnouncementEntry = {
  id: string;
  speechText: string;
  claimedAt: number;
};

const canonicalizeAnnouncementId = (id: string): string => {
  const isoMatch = id.match(/^(.*?)(\d{4}-\d{2}-\d{2}T.+)$/);
  if (!isoMatch) return id;
  const parsedMs = Date.parse(isoMatch[2]);
  if (Number.isNaN(parsedMs)) return id;
  return `${isoMatch[1]}${Math.floor(parsedMs / 1000)}`;
};

const getClaimedAnnouncements = (): ClaimedAnnouncementEntry[] => {
  const rawValue = window.localStorage.getItem(SHARED_ANNOUNCER_CLAIMED_KEY);
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue) as ClaimedAnnouncementEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const isAlreadyClaimed = (
  claimed: ClaimedAnnouncementEntry[],
  announcement: SharedQueueAnnouncement,
  referenceTime: number
) =>
  claimed.some(
    (entry) =>
      entry.id === announcement.id ||
      (entry.speechText === announcement.speechText &&
        Math.abs(referenceTime - entry.claimedAt) < SHARED_ANNOUNCEMENT_SPEECH_DEDUP_MS)
  );

const markAnnouncementClaimed = (announcement: SharedQueueAnnouncement) => {
  const existing = getClaimedAnnouncements();
  const next = [
    ...existing.filter((entry) => entry.id !== announcement.id),
    {
      id: announcement.id,
      speechText: announcement.speechText,
      claimedAt: Date.now(),
    },
  ].slice(-SHARED_ANNOUNCEMENT_MAX_ITEMS);

  window.localStorage.setItem(SHARED_ANNOUNCER_CLAIMED_KEY, JSON.stringify(next));
};

const withCrossTabSpeakerLock = async (fn: () => Promise<void>) => {
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    await navigator.locks.request(SHARED_ANNOUNCER_SPEAKER_LOCK, async () => {
      await fn();
    });
    return;
  }
  await fn();
};

const getStoredQueueSnapshot = (): SharedQueueAnnouncement[] => {
  const rawValue = window.localStorage.getItem(SHARED_ANNOUNCER_QUEUE_KEY);
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue) as SharedQueueAnnouncement[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const persistQueueSnapshot = (queue: SharedQueueAnnouncement[]) => {
  const normalizedQueue = queue
    .sort((left, right) => left.createdAt - right.createdAt)
    .slice(-SHARED_ANNOUNCEMENT_MAX_ITEMS);

  window.localStorage.setItem(
    SHARED_ANNOUNCER_QUEUE_KEY,
    JSON.stringify(normalizedQueue)
  );
};

const markCurrentQueueAsSeen = () => {
  const currentQueue = getStoredQueueSnapshot();
  seenAnnouncementIds = new Set(currentQueue.map((announcement) => announcement.id));
  pendingAnnouncements = [];
};

const enqueueAnnouncementsLocally = (announcements: SharedQueueAnnouncement[]) => {
  const freshAnnouncements = announcements.filter(
    (announcement) => !seenAnnouncementIds.has(announcement.id)
  );

  if (freshAnnouncements.length === 0) {
    return;
  }

  freshAnnouncements.forEach((announcement) => {
    seenAnnouncementIds.add(announcement.id);
  });

  pendingAnnouncements = [...pendingAnnouncements, ...freshAnnouncements].sort(
    (left, right) => left.createdAt - right.createdAt
  );
};

const syncAnnouncementsFromStorage = () => {
  enqueueAnnouncementsLocally(getStoredQueueSnapshot());
};

const broadcastMessage = (message: SharedAnnouncementMessage) => {
  sharedChannel?.postMessage(message);
};

const speakText = async (text: string) => {
  if (!("speechSynthesis" in window)) {
    throw new Error("Speech synthesis not supported");
  }

  const preferredVoice = getPreferredIndonesianVoice();
  const utterance = new SpeechSynthesisUtterance(text);

  utterance.lang = preferredVoice?.lang || "id-ID";
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }
  utterance.rate = SHARED_ANNOUNCEMENT_SPEECH_RATE;
  utterance.pitch = SHARED_ANNOUNCEMENT_SPEECH_PITCH;
  utterance.volume = SHARED_ANNOUNCEMENT_SPEECH_VOLUME;

  await new Promise<void>((resolve, reject) => {
    utterance.onend = () => resolve();
    utterance.onerror = (event) => {
      reject(event.error || new Error("Speech synthesis failed"));
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      reject(error);
    }
  });
};

const playSharedAnnouncement = async (announcement: SharedQueueAnnouncement) => {
  await playQueueAudioFeedback("in");
  await waitForDelay(SHARED_ANNOUNCEMENT_CLIP_GAP_MS);
  await speakText(announcement.speechText);
  await waitForDelay(SHARED_ANNOUNCEMENT_CLIP_GAP_MS);
  await playQueueAudioFeedback("out");
};

const processLocalAnnouncementQueue = async () => {
  if (!isEnabled || isProcessingQueue) {
    return;
  }

  isProcessingQueue = true;

  try {
    await withCrossTabSpeakerLock(async () => {
      syncAnnouncementsFromStorage();
      while (pendingAnnouncements.length > 0 && isEnabled) {
        const nextAnnouncement = pendingAnnouncements.shift();
        if (!nextAnnouncement) {
          continue;
        }

        const claimed = getClaimedAnnouncements();
        if (isAlreadyClaimed(claimed, nextAnnouncement, Date.now())) {
          continue;
        }
        markAnnouncementClaimed(nextAnnouncement);

        isAnnouncing = true;
        notifyStateListeners();

        try {
          await playSharedAnnouncement(nextAnnouncement);
        } finally {
          isAnnouncing = false;
          notifyStateListeners();
        }

        await waitForDelay(SHARED_ANNOUNCEMENT_QUEUE_DELAY_MS);
        syncAnnouncementsFromStorage();
      }
    });
  } finally {
    isProcessingQueue = false;
    isAnnouncing = false;
    notifyStateListeners();
  }
};

const unlockSpeechSynthesis = async () => {
  if (!("speechSynthesis" in window)) {
    return false;
  }

  const preferredVoice = getPreferredIndonesianVoice();

  return new Promise<boolean>((resolve) => {
    const utterance = new SpeechSynthesisUtterance("siap");
    utterance.lang = preferredVoice?.lang || "id-ID";
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    utterance.rate = SHARED_ANNOUNCEMENT_SPEECH_RATE;
    utterance.pitch = SHARED_ANNOUNCEMENT_SPEECH_PITCH;
    utterance.volume = 0;
    utterance.onstart = () => resolve(true);
    utterance.onend = () => resolve(true);
    utterance.onerror = () => resolve(false);

    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      resolve(false);
    }
  });
};

if (sharedChannel) {
  sharedChannel.onmessage = (event: MessageEvent<SharedAnnouncementMessage>) => {
    const message = event.data;
    if (message.type !== "enqueue") {
      return;
    }

    if (!isEnabled) {
      return;
    }

    syncAnnouncementsFromStorage();
    void processLocalAnnouncementQueue();
  };
}

window.addEventListener("storage", (event) => {
  if (event.key !== SHARED_ANNOUNCER_QUEUE_KEY) {
    return;
  }

  if (!isEnabled) {
    return;
  }

  syncAnnouncementsFromStorage();
  void processLocalAnnouncementQueue();
});

export const subscribeSharedAnnouncementState = (
  listener: (state: SharedAnnouncerState) => void
) => {
  stateListeners.add(listener);
  listener(getSharedAnnouncerState());

  return () => {
    stateListeners.delete(listener);
  };
};

export const queueSharedAnnouncement = (
  announcement: Omit<SharedQueueAnnouncement, "createdAt"> | SharedQueueAnnouncement
) => {
  const createdAt = "createdAt" in announcement ? announcement.createdAt : Date.now();
  const nextAnnouncement: SharedQueueAnnouncement = {
    ...announcement,
    id: canonicalizeAnnouncementId(announcement.id),
    createdAt,
  } as SharedQueueAnnouncement;

  const claimed = getClaimedAnnouncements();
  if (isAlreadyClaimed(claimed, nextAnnouncement, createdAt)) {
    return;
  }

  const currentQueue = getStoredQueueSnapshot();
  if (
    currentQueue.some(
      (currentAnnouncement) =>
        currentAnnouncement.id === nextAnnouncement.id ||
        (currentAnnouncement.speechText === nextAnnouncement.speechText &&
          Math.abs(createdAt - currentAnnouncement.createdAt) < SHARED_ANNOUNCEMENT_SPEECH_DEDUP_MS)
    )
  ) {
    syncAnnouncementsFromStorage();
    return;
  }

  persistQueueSnapshot([...currentQueue, nextAnnouncement]);
  enqueueAnnouncementsLocally([nextAnnouncement]);
  broadcastMessage({ type: "enqueue", announcementId: nextAnnouncement.id });

  if (isEnabled) {
    void processLocalAnnouncementQueue();
  }
};

export const enableSharedAnnouncementAudio = async (): Promise<SharedEnableResult> => {
  const wasEnabled = isEnabled;
  const audioReady = await unlockQueueAudio();
  const speechReady = await unlockSpeechSynthesis();

  isEnabled = audioReady || speechReady;

  if (!wasEnabled && isEnabled) {
    markCurrentQueueAsSeen();
  }

  notifyStateListeners();

  if (wasEnabled && isEnabled) {
    syncAnnouncementsFromStorage();
    void processLocalAnnouncementQueue();
  }

  return {
    audioReady,
    speechReady,
    hasIndonesianVoice: Boolean(getPreferredIndonesianVoice()),
    isLeader: isEnabled,
  };
};

export const disableSharedAnnouncementAudio = () => {
  isEnabled = false;
  isAnnouncing = false;
  pendingAnnouncements = [];
  isProcessingQueue = false;

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  markCurrentQueueAsSeen();
  notifyStateListeners();
};