import { useMemo, useRef, useState, type FormEvent } from "react";
import styled, { css } from "styled-components";
import {
  getInitialConformityChecks,
  runConformitySuite,
  type ConformityCheck,
  type SuiteLog,
} from "./lib/conformity/suite";

const palette = {
  shell: "#0a0b10",
  card: "#101218",
  cardSoft: "#0d0f15",
  border: "#1f222b",
  borderBright: "#2a2e3a",
  borderFocus: "#5cffaf",
  text: "#eef0f5",
  subdued: "#7d8390",
  muted: "#4a5060",
  mint: "#5cffaf",
  mintDim: "rgba(92, 255, 175, 0.12)",
};

const themedScrollbar = css`
  scrollbar-width: thin;
  scrollbar-color: ${palette.borderBright} transparent;

  &::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: ${palette.borderBright};
    border-radius: 999px;
    border: 2px solid ${palette.cardSoft};
    background-clip: padding-box;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: ${palette.subdued};
    background-clip: padding-box;
    border: 2px solid ${palette.cardSoft};
  }

  &::-webkit-scrollbar-corner {
    background: transparent;
  }
`;

const Page = styled.main`
  background: ${palette.shell};
  min-height: 100vh;
  padding: clamp(1.6rem, 4vw, 3rem) 1.4rem clamp(2rem, 6vw, 4rem);
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Container = styled.div`
  width: min(1200px, 100%);
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
`;

const Header = styled.header`
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.4rem 0.2rem 0.6rem;
`;

const Title = styled.h1`
  margin: 0;
  font-family: "Geist", "Inter", system-ui, sans-serif;
  font-weight: 500;
  font-size: clamp(28px, 3vw, 34px);
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: ${palette.text};
`;

const Subtitle = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
  color: ${palette.subdued};
  max-width: 64ch;
`;

const Card = styled.section`
  background: linear-gradient(
    180deg,
    ${palette.card} 0%,
    ${palette.cardSoft} 100%
  );
  border: 1px solid ${palette.border};
  border-radius: 12px;
  padding: 1.2rem 1.3rem;
`;

const FormCard = styled(Card).attrs({ as: "form" })`
  display: grid;
  grid-template-columns: 1.4fr 1fr auto;
  align-items: end;
  gap: 1rem 1.2rem;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
`;

const FieldLabel = styled.span`
  font-family: "Geist Mono", "JetBrains Mono", monospace;
  font-size: 10.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: ${palette.subdued};
`;

const Input = styled.input`
  appearance: none;
  background: ${palette.shell};
  border: 1px solid ${palette.border};
  border-radius: 8px;
  padding: 0.7rem 0.85rem;
  font-family: "Geist Mono", "JetBrains Mono", monospace;
  font-size: 13px;
  color: ${palette.text};
  letter-spacing: 0.01em;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease;

  &::placeholder {
    color: ${palette.muted};
  }

  &:hover:not(:focus) {
    border-color: ${palette.borderBright};
  }

  &:focus {
    outline: none;
    border-color: ${palette.borderFocus};
    box-shadow: 0 0 0 3px rgba(92, 255, 175, 0.12);
  }
`;

const RunButton = styled.button`
  appearance: none;
  border: none;
  background: ${palette.mint};
  color: #07080c;
  font-family: "Geist", "Inter", sans-serif;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  padding: 0.78rem 1.3rem;
  border-radius: 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  transition:
    transform 150ms ease,
    background 150ms ease,
    opacity 150ms ease;
  white-space: nowrap;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    background: #6effba;
  }

  &:disabled {
    background: ${palette.border};
    color: ${palette.muted};
    cursor: not-allowed;
  }

  & > svg {
    width: 14px;
    height: 14px;
  }
`;

const PanelCard = styled(Card)`
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 0.9rem;
  padding: 1.1rem 1.2rem 1.3rem;
`;

const EventLogCard = styled(PanelCard)`
  grid-template-rows: auto auto 1fr;
  height: 640px;
`;

const ChecksCard = styled(PanelCard)`
  grid-template-rows: auto auto;
`;

const CardHead = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
`;

const CardTitle = styled.h2`
  margin: 0;
  font-family: "Geist", "Inter", sans-serif;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${palette.subdued};
`;

const CardCount = styled.span`
  font-family: "Geist Mono", "JetBrains Mono", monospace;
  font-size: 11px;
  color: ${palette.muted};
  letter-spacing: 0.04em;
`;

const Empty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 0.7rem;
  padding: 2rem 1rem;
  color: ${palette.muted};
`;

const EmptyTitle = styled.div`
  font-family: "Geist", "Inter", sans-serif;
  font-size: 14px;
  font-weight: 500;
  color: ${palette.subdued};
`;

const EmptyHint = styled.p`
  margin: 0;
  font-size: 12.5px;
  line-height: 1.55;
  color: ${palette.muted};
  max-width: 36ch;
`;

const EmptyGlyph = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px dashed ${palette.borderBright};
  border-radius: 10px;
  color: ${palette.borderBright};
  margin-bottom: 0.3rem;
`;

const ChecksList = styled.div`
  display: grid;
  gap: 0.55rem;
  align-content: start;
`;

const CheckRow = styled.article`
  border: 1px solid ${palette.border};
  background: ${palette.shell};
  border-radius: 8px;
  padding: 0.65rem 0.75rem;
  display: grid;
  gap: 0.42rem;
`;

const CheckHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
`;

const CheckTitle = styled.strong`
  color: ${palette.text};
  font-size: 12.5px;
  font-weight: 500;
`;

const CheckBadges = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
`;

const RequirementBadge = styled.span<{ $required: boolean }>`
  font-family: "Geist Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.05em;
  padding: 0.15rem 0.35rem;
  border-radius: 999px;
  border: 1px solid ${palette.borderBright};
  color: ${({ $required }) => ($required ? palette.mint : palette.subdued)};
`;

const StatusBadge = styled.span<{ $state: ConformityCheck["state"] }>`
  font-family: "Geist Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.15rem 0.35rem;
  border-radius: 999px;
  border: 1px solid
    ${({ $state }) => {
      if ($state === "passed") return "#2fcf8f";
      if ($state === "failed") return "#ff6f7a";
      if ($state === "running") return "#8ec7ff";
      return palette.borderBright;
    }};
  color: ${({ $state }) => {
    if ($state === "passed") return "#5cffaf";
    if ($state === "failed") return "#ff8f98";
    if ($state === "running") return "#9dd0ff";
    return palette.subdued;
  }};
`;

const CheckDetail = styled.p`
  margin: 0;
  color: ${palette.subdued};
  font-size: 12px;
  line-height: 1.5;
`;

const EventList = styled.div`
  display: grid;
  gap: 0.85rem;
  align-content: start;
  overflow-y: auto;
  padding-right: 0.5rem;
  min-height: 0;

  ${themedScrollbar}
`;

const EventCard = styled.article<{
  $accent: string;
  $stripeStyle: "solid" | "dashed";
}>`
  position: relative;
  border: 1px solid ${palette.border};
  background: #0a0d14;
  border-radius: 10px;
  padding: 1rem 1.1rem 1.05rem 1.4rem;
  display: grid;
  gap: 0.7rem;

  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 10px;
    bottom: 10px;
    width: 3px;
    border-radius: 0 4px 4px 0;
    background: ${({ $accent, $stripeStyle }) =>
      $stripeStyle === "dashed"
        ? `repeating-linear-gradient(180deg, ${$accent} 0, ${$accent} 4px, transparent 4px, transparent 8px)`
        : $accent};
    opacity: ${({ $stripeStyle }) => ($stripeStyle === "dashed" ? 0.55 : 1)};
  }
`;

const EventTopRow = styled.header`
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 0.85rem;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
    gap: 0.45rem;
  }
`;

const EventTypeLabel = styled.span<{ $accent: string }>`
  font-family: "Geist Mono", "JetBrains Mono", monospace;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: ${({ $accent }) => $accent};
  display: inline-flex;
  align-items: baseline;
  gap: 0.45rem;
  white-space: nowrap;

  & > .glyph {
    font-size: 14px;
    line-height: 1;
  }
`;

const EventTarget = styled.span`
  font-family: "Geist Mono", "JetBrains Mono", monospace;
  font-size: 13.5px;
  color: ${palette.text};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.01em;
  min-width: 0;

  & > .method {
    color: ${palette.subdued};
    margin-right: 0.45rem;
  }
`;

const EventChannelTag = styled.span`
  font-family: "Geist Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: ${palette.subdued};
  border: 1px solid ${palette.borderBright};
  border-radius: 4px;
  padding: 0.2rem 0.5rem;
  white-space: nowrap;
`;

const EventStatusPill = styled.span<{ $accent: string }>`
  font-family: "Geist Mono", "JetBrains Mono", monospace;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  padding: 0.22rem 0.55rem;
  border-radius: 999px;
  border: 1px solid ${({ $accent }) => $accent};
  color: ${({ $accent }) => $accent};
  background: rgba(255, 255, 255, 0.02);
  white-space: nowrap;
`;

const EventMetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  font-family: "Geist Mono", "JetBrains Mono", monospace;
  font-size: 11px;
  color: ${palette.muted};
  letter-spacing: 0.04em;
  align-items: center;

  & > .sep {
    opacity: 0.5;
  }

  & > .check-id {
    color: ${palette.subdued};
    border-left: 1px solid ${palette.borderBright};
    padding-left: 0.6rem;
    margin-left: 0.1rem;
  }

  & > .corr {
    color: #9ac5ff;
  }

  & > .level-warn {
    color: #ffcf7f;
  }

  & > .level-error {
    color: #ff8f98;
  }
`;

const EventMessageText = styled.p`
  margin: 0;
  color: #d3dae8;
  font-size: 13px;
  line-height: 1.55;
  font-family: "Geist", "Inter", sans-serif;
`;

const EventActions = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 0.05rem;
`;

const EventFilterBar = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.55rem;

  @media (max-width: 900px) {
    grid-template-columns: 1fr 1fr;
  }
`;

const FilterField = styled.label`
  display: grid;
  gap: 0.24rem;
`;

const FilterLabel = styled.span`
  font-family: "Geist Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  color: ${palette.subdued};
  letter-spacing: 0.07em;
  text-transform: uppercase;
`;

const FilterSelect = styled.select`
  appearance: none;
  border-radius: 8px;
  border: 1px solid ${palette.borderBright};
  background: #0a0d14;
  color: ${palette.text};
  padding: 0.4rem 0.48rem;
  font-size: 11px;
  font-family: "Geist Mono", "JetBrains Mono", monospace;
`;

const PayloadButton = styled.button`
  border: 1px solid ${palette.borderBright};
  border-radius: 6px;
  background: #111623;
  color: #9ac5ff;
  padding: 0.32rem 0.65rem;
  font-size: 10.5px;
  font-family: "Geist Mono", "JetBrains Mono", monospace;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition:
    border-color 150ms ease,
    color 150ms ease;

  &:hover {
    border-color: #5cffaf;
    color: #5cffaf;
  }
`;

const ModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(2, 4, 8, 0.74);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
  padding: 1.2rem;
`;

const ModalCard = styled.section`
  width: min(860px, 100%);
  max-height: 85vh;
  overflow: hidden;
  border: 1px solid ${palette.borderBright};
  border-radius: 12px;
  background: #090c13;
  box-shadow: 0 24px 56px rgba(0, 0, 0, 0.42);
  display: grid;
  grid-template-rows: auto 1fr;
`;

const ModalHeader = styled.header`
  padding: 0.78rem 0.9rem;
  border-bottom: 1px solid ${palette.border};
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem;
`;

const ModalTitle = styled.h3`
  margin: 0;
  color: ${palette.text};
  font-size: 13px;
  font-weight: 600;
`;

const ModalClose = styled.button`
  border: 1px solid ${palette.borderBright};
  background: #111623;
  color: ${palette.text};
  border-radius: 8px;
  padding: 0.33rem 0.58rem;
  cursor: pointer;
  font-size: 11px;
`;

const ModalBody = styled.pre`
  margin: 0;
  overflow: auto;
  padding: 0.85rem 0.95rem;
  font-size: 12px;
  line-height: 1.55;
  font-family: "Geist Mono", "JetBrains Mono", monospace;

  ${themedScrollbar}
`;

const JsonLine = styled.div``;
const JsonKey = styled.span`
  color: #80b6ff;
`;
const JsonString = styled.span`
  color: #9fe5b2;
`;
const JsonNumber = styled.span`
  color: #ffcf7f;
`;
const JsonBoolean = styled.span`
  color: #f78fc5;
`;
const JsonNull = styled.span`
  color: #a3a9b8;
`;

const ScoreCard = styled(Card)`
  display: grid;
  gap: 0.85rem;
`;

const ScoreGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.7rem;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const ScoreItem = styled.div`
  border: 1px solid ${palette.border};
  border-radius: 10px;
  background: ${palette.shell};
  padding: 0.7rem 0.8rem;
`;

const ScoreLabel = styled.div`
  color: ${palette.subdued};
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-family: "Geist Mono", "JetBrains Mono", monospace;
`;

const ScoreValue = styled.div<{ $tone?: "ok" | "bad" | "neutral" }>`
  margin-top: 0.3rem;
  font-size: 24px;
  letter-spacing: -0.02em;
  color: ${({ $tone }) => {
    if ($tone === "ok") return palette.mint;
    if ($tone === "bad") return "#ff8f98";
    return palette.text;
  }};
`;

const ErrorNote = styled.p`
  margin: 0;
  color: #ff8f98;
  font-size: 12px;
`;

function formatTimestampWithMs(timestamp: number) {
  const date = new Date(timestamp);
  const base = date.toLocaleTimeString();
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${base}.${ms}`;
}

type EventTypeMeta = {
  label: string;
  glyph: string;
  accent: string;
  stripeStyle: "solid" | "dashed";
};

function getEventTypeMeta(entry: SuiteLog): EventTypeMeta {
  if (entry.direction === "outbound") {
    return {
      label: "Request",
      glyph: "→",
      accent: "#8ec7ff",
      stripeStyle: "solid",
    };
  }

  if (entry.direction === "inbound") {
    let accent: string = palette.subdued;
    if (typeof entry.status === "number") {
      if (entry.status >= 500) accent = "#ff8f98";
      else if (entry.status >= 400) accent = "#ffcf7f";
      else if (entry.status >= 200) accent = "#5cffaf";
    } else if (entry.level === "error") {
      accent = "#ff8f98";
    } else if (entry.level === "warn") {
      accent = "#ffcf7f";
    } else {
      accent = "#5cffaf";
    }
    return {
      label: "Response",
      glyph: "←",
      accent,
      stripeStyle: "solid",
    };
  }

  let accent: string = palette.subdued;
  if (entry.level === "error") accent = "#ff8f98";
  else if (entry.level === "warn") accent = "#ffcf7f";

  return {
    label: "Internal",
    glyph: "○",
    accent,
    stripeStyle: "dashed",
  };
}

function highlightJsonText(json: string) {
  return json.split("\n").map((line, lineIndex) => {
    const tokens: Array<{ type: string; value: string }> = [];
    const tokenRegex =
      /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"\s*:)|("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*")|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

    let cursor = 0;
    let match = tokenRegex.exec(line);

    while (match) {
      const start = match.index;
      if (start > cursor) {
        tokens.push({ type: "plain", value: line.slice(cursor, start) });
      }

      const raw = match[0];
      if (match[1]) {
        tokens.push({ type: "key", value: raw.slice(0, -1) });
        tokens.push({ type: "plain", value: ":" });
      } else if (match[2]) {
        tokens.push({ type: "string", value: raw });
      } else if (match[3]) {
        tokens.push({ type: "boolean", value: raw });
      } else if (raw === "null") {
        tokens.push({ type: "null", value: raw });
      } else {
        tokens.push({ type: "number", value: raw });
      }

      cursor = start + raw.length;
      match = tokenRegex.exec(line);
    }

    if (cursor < line.length) {
      tokens.push({ type: "plain", value: line.slice(cursor) });
    }

    return (
      <JsonLine key={`line-${lineIndex}`}>
        {tokens.map((token, tokenIndex) => {
          const key = `${lineIndex}-${tokenIndex}`;
          if (token.type === "key") {
            return <JsonKey key={key}>{token.value}</JsonKey>;
          }
          if (token.type === "string") {
            return <JsonString key={key}>{token.value}</JsonString>;
          }
          if (token.type === "number") {
            return <JsonNumber key={key}>{token.value}</JsonNumber>;
          }
          if (token.type === "boolean") {
            return <JsonBoolean key={key}>{token.value}</JsonBoolean>;
          }
          if (token.type === "null") {
            return <JsonNull key={key}>{token.value}</JsonNull>;
          }
          return <span key={key}>{token.value}</span>;
        })}
      </JsonLine>
    );
  });
}

function StreamGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="22"
      height="22"
    >
      <path d="M3 6h12" />
      <path d="M3 12h18" />
      <path d="M3 18h9" />
      <circle cx="19" cy="6" r="1.5" />
      <circle cx="17" cy="18" r="1.5" />
    </svg>
  );
}

function ArrowGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

export default function Dashboard() {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [checks, setChecks] = useState<ConformityCheck[]>(() =>
    getInitialConformityChecks(),
  );
  const [events, setEvents] = useState<SuiteLog[]>([]);
  const [running, setRunning] = useState(false);
  const [minimumPassed, setMinimumPassed] = useState<boolean | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"all" | "client" | "server">(
    "all",
  );
  const [channelFilter, setChannelFilter] = useState<
    "all" | "suite" | "rest" | "sse"
  >("all");
  const [levelFilter, setLevelFilter] = useState<
    "all" | "info" | "warn" | "error"
  >("all");
  const [payloadModalEntry, setPayloadModalEntry] = useState<SuiteLog | null>(
    null,
  );
  const abortControllerRef = useRef<AbortController | null>(null);
  const localSequenceRef = useRef(0);

  const canRun =
    baseUrl.trim().length > 0 && apiKey.trim().length > 0 && !running;

  const passedChecks = useMemo(
    () =>
      checks.filter(
        (check) => check.state === "passed" || check.state === "skipped",
      ).length,
    [checks],
  );
  const totalChecks = checks.length;
  const conformityPercent =
    totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

  const filteredEvents = useMemo(() => {
    const matched = events.filter((entry) => {
      if (sourceFilter !== "all" && entry.source !== sourceFilter) {
        return false;
      }
      if (channelFilter !== "all" && entry.channel !== channelFilter) {
        return false;
      }
      if (levelFilter !== "all" && entry.level !== levelFilter) {
        return false;
      }
      return true;
    });

    return matched.sort((a, b) => {
      if (a.sequence !== b.sequence) {
        return a.sequence - b.sequence;
      }
      return a.timestamp - b.timestamp;
    });
  }, [events, sourceFilter, channelFilter, levelFilter]);

  const pushLocalEvent = (entry: Omit<SuiteLog, "timestamp" | "sequence">) => {
    localSequenceRef.current += 1;
    setEvents((current) => [
      ...current,
      {
        timestamp: Date.now(),
        sequence: localSequenceRef.current,
        ...entry,
      },
    ]);
  };

  const minimumLabel = useMemo(() => {
    if (running) {
      return "Running";
    }
    if (minimumPassed === null) {
      return "Not run";
    }
    return minimumPassed ? "Meets minimum" : "Misses minimum";
  }, [minimumPassed, running]);

  const payloadModalJson = useMemo(() => {
    if (!payloadModalEntry || payloadModalEntry.payload === undefined) {
      return "";
    }

    if (typeof payloadModalEntry.payload === "string") {
      return payloadModalEntry.payload;
    }

    try {
      return JSON.stringify(payloadModalEntry.payload, null, 2);
    } catch {
      return String(payloadModalEntry.payload);
    }
  }, [payloadModalEntry]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canRun) {
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setRunning(true);
    setRunError(null);
    setMinimumPassed(null);
    setChecks(getInitialConformityChecks());
    setEvents([]);
    localSequenceRef.current = 0;

    try {
      const report = await runConformitySuite({
        baseUrl,
        token: apiKey,
        signal: controller.signal,
        onChecks: (nextChecks) => {
          setChecks(nextChecks);
        },
        onLog: (entry) => {
          localSequenceRef.current = Math.max(
            localSequenceRef.current,
            entry.sequence,
          );
          setEvents((current) => [...current, entry].slice(-320));
        },
      });

      setChecks(report.checks);
      setMinimumPassed(report.minimumPassed);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        pushLocalEvent({
          level: "warn",
          message: "Conformity run cancelled by user.",
          source: "client",
          channel: "suite",
          direction: "internal",
        });
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Failed to run conformity suite.";
      setRunError(message);
      setMinimumPassed(false);
      pushLocalEvent({
        level: "error",
        message,
        source: "client",
        channel: "suite",
        direction: "internal",
      });
    } finally {
      abortControllerRef.current = null;
      setRunning(false);
    }
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    setRunning(false);
  };

  return (
    <Page>
      <Container>
        <Header>
          <Title>Conformity Check</Title>
          <Subtitle>
            Verify a job server's REST + SSE contract before connecting the
            dashboard.
          </Subtitle>
        </Header>

        <FormCard onSubmit={handleSubmit}>
          <Field>
            <FieldLabel>Job Server URL</FieldLabel>
            <Input
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://jobs.example.io"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>API Key</FieldLabel>
            <Input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="sk_live_••••••••"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
          </Field>
          <RunButton
            type={running ? "button" : "submit"}
            disabled={!running && !canRun}
            onClick={running ? handleCancel : undefined}
          >
            {running ? "Cancel" : "Run Conformity Check"}
            {!running ? <ArrowGlyph /> : null}
          </RunButton>
        </FormCard>
        {runError ? <ErrorNote>{runError}</ErrorNote> : null}

        <ScoreCard>
          <CardHead>
            <CardTitle>Conformity Score</CardTitle>
            <CardCount>
              {passedChecks}/{totalChecks || 0} checks passed
            </CardCount>
          </CardHead>
          <ScoreGrid>
            <ScoreItem>
              <ScoreLabel>Passed checks</ScoreLabel>
              <ScoreValue>
                {passedChecks}/{totalChecks || 0}
              </ScoreValue>
            </ScoreItem>
            <ScoreItem>
              <ScoreLabel>Conformity %</ScoreLabel>
              <ScoreValue>{conformityPercent}%</ScoreValue>
            </ScoreItem>
            <ScoreItem>
              <ScoreLabel>Minimum requirement</ScoreLabel>
              <ScoreValue
                $tone={
                  minimumPassed === null
                    ? "neutral"
                    : minimumPassed
                      ? "ok"
                      : "bad"
                }
              >
                {minimumLabel}
              </ScoreValue>
            </ScoreItem>
          </ScoreGrid>
        </ScoreCard>

        <ChecksCard>
          <CardHead>
            <CardTitle>Checks</CardTitle>
            <CardCount>{checks.length}</CardCount>
          </CardHead>
          <ChecksList>
            {checks.map((check) => (
              <CheckRow key={check.id}>
                <CheckHead>
                  <CheckTitle>{check.title}</CheckTitle>
                  <CheckBadges>
                    <RequirementBadge $required={check.requiredForMinimum}>
                      {check.requiredForMinimum ? "minimum" : "optional"}
                    </RequirementBadge>
                    <StatusBadge $state={check.state}>
                      {check.state}
                    </StatusBadge>
                  </CheckBadges>
                </CheckHead>
                <CheckDetail>{check.detail}</CheckDetail>
              </CheckRow>
            ))}
          </ChecksList>
        </ChecksCard>

        <EventLogCard>
          <CardHead>
            <CardTitle>Event Log</CardTitle>
            <CardCount>
              {filteredEvents.length}/{events.length} entries
            </CardCount>
          </CardHead>
          <EventFilterBar>
            <FilterField>
              <FilterLabel>Source</FilterLabel>
              <FilterSelect
                value={sourceFilter}
                onChange={(event) =>
                  setSourceFilter(
                    event.target.value as "all" | "client" | "server",
                  )
                }
              >
                <option value="all">all</option>
                <option value="client">client</option>
                <option value="server">server</option>
              </FilterSelect>
            </FilterField>
            <FilterField>
              <FilterLabel>Channel</FilterLabel>
              <FilterSelect
                value={channelFilter}
                onChange={(event) =>
                  setChannelFilter(
                    event.target.value as "all" | "suite" | "rest" | "sse",
                  )
                }
              >
                <option value="all">all</option>
                <option value="suite">suite</option>
                <option value="rest">rest</option>
                <option value="sse">sse</option>
              </FilterSelect>
            </FilterField>
            <FilterField>
              <FilterLabel>Level</FilterLabel>
              <FilterSelect
                value={levelFilter}
                onChange={(event) =>
                  setLevelFilter(
                    event.target.value as "all" | "info" | "warn" | "error",
                  )
                }
              >
                <option value="all">all</option>
                <option value="info">info</option>
                <option value="warn">warn</option>
                <option value="error">error</option>
              </FilterSelect>
            </FilterField>
            <FilterField>
              <FilterLabel>Style</FilterLabel>
              <FilterSelect value="console" disabled>
                <option value="console">console</option>
              </FilterSelect>
            </FilterField>
          </EventFilterBar>
          {events.length === 0 ? (
            <Empty>
              <EmptyGlyph>
                <StreamGlyph />
              </EmptyGlyph>
              <EmptyTitle>No events yet</EmptyTitle>
              <EmptyHint>
                Live conformity events will stream here once a run is in
                progress.
              </EmptyHint>
            </Empty>
          ) : (
            <EventList>
              {filteredEvents.map((entry, index) => {
                const meta = getEventTypeMeta(entry);
                const showStatusPill =
                  entry.direction === "inbound" &&
                  typeof entry.status === "number";
                const hasTarget = Boolean(entry.url || entry.method);
                return (
                  <EventCard
                    key={`${entry.sequence}-${entry.timestamp}-${entry.level}-${index}`}
                    $accent={meta.accent}
                    $stripeStyle={meta.stripeStyle}
                  >
                    <EventTopRow>
                      <EventTypeLabel $accent={meta.accent}>
                        <span className="glyph" aria-hidden="true">
                          {meta.glyph}
                        </span>
                        {meta.label}
                      </EventTypeLabel>
                      {hasTarget ? (
                        <EventTarget title={entry.url ?? undefined}>
                          {entry.method ? (
                            <span className="method">{entry.method}</span>
                          ) : null}
                          {entry.url ?? ""}
                        </EventTarget>
                      ) : (
                        <span />
                      )}
                      <EventChannelTag>{entry.channel}</EventChannelTag>
                      {showStatusPill ? (
                        <EventStatusPill $accent={meta.accent}>
                          {entry.status}
                        </EventStatusPill>
                      ) : (
                        <span />
                      )}
                    </EventTopRow>
                    <EventMetaRow>
                      <span>{formatTimestampWithMs(entry.timestamp)}</span>
                      <span className="sep">·</span>
                      <span>#{String(entry.sequence).padStart(3, "0")}</span>
                      <span className="sep">·</span>
                      <span>{entry.source}</span>
                      {entry.requestId ? (
                        <>
                          <span className="sep">·</span>
                          <span className="corr">req:{entry.requestId}</span>
                        </>
                      ) : null}
                      {entry.streamId ? (
                        <>
                          <span className="sep">·</span>
                          <span className="corr">stream:{entry.streamId}</span>
                        </>
                      ) : null}
                      {entry.eventId ? (
                        <>
                          <span className="sep">·</span>
                          <span className="corr">event:{entry.eventId}</span>
                        </>
                      ) : null}
                      {typeof entry.latencyMs === "number" ? (
                        <>
                          <span className="sep">·</span>
                          <span>{entry.latencyMs}ms</span>
                        </>
                      ) : null}
                      {entry.level !== "info" ? (
                        <>
                          <span className="sep">·</span>
                          <span className={`level-${entry.level}`}>
                            {entry.level}
                          </span>
                        </>
                      ) : null}
                      {entry.checkId ? (
                        <span className="check-id">{entry.checkId}</span>
                      ) : null}
                    </EventMetaRow>
                    <EventMessageText>{entry.message}</EventMessageText>
                    {entry.payload !== undefined ? (
                      <EventActions>
                        <PayloadButton
                          type="button"
                          onClick={() => setPayloadModalEntry(entry)}
                        >
                          View payload
                        </PayloadButton>
                      </EventActions>
                    ) : null}
                  </EventCard>
                );
              })}
            </EventList>
          )}
        </EventLogCard>

        {payloadModalEntry ? (
          <ModalBackdrop onClick={() => setPayloadModalEntry(null)}>
            <ModalCard onClick={(event) => event.stopPropagation()}>
              <ModalHeader>
                <ModalTitle>
                  Payload preview • {payloadModalEntry.channel.toUpperCase()} •{" "}
                  {payloadModalEntry.source.toUpperCase()}
                </ModalTitle>
                <ModalClose
                  type="button"
                  onClick={() => setPayloadModalEntry(null)}
                >
                  Close
                </ModalClose>
              </ModalHeader>
              <ModalBody>{highlightJsonText(payloadModalJson)}</ModalBody>
            </ModalCard>
          </ModalBackdrop>
        ) : null}
      </Container>
    </Page>
  );
}
