import { useMemo, useRef, useState, type FormEvent } from "react";
import styled from "styled-components";
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

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 1.2rem;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const PanelCard = styled(Card)`
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 0.9rem;
  min-height: 380px;
  padding: 1.1rem 1.2rem 1.3rem;
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
  gap: 0.5rem;
  align-content: start;
  max-height: 100%;
  overflow: auto;
  padding-right: 0.25rem;
`;

const EventRow = styled.div`
  border: 1px solid ${palette.border};
  background: ${palette.shell};
  border-radius: 8px;
  padding: 0.55rem 0.68rem;
  display: grid;
  gap: 0.25rem;
`;

const EventMeta = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-family: "Geist Mono", "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.06em;
  color: ${palette.muted};
`;

const EventLevel = styled.span<{ $level: SuiteLog["level"] }>`
  color: ${({ $level }) => {
    if ($level === "error") return "#ff8f98";
    if ($level === "warn") return "#ffcf7f";
    return palette.mint;
  }};
`;

const EventMessage = styled.p`
  margin: 0;
  color: ${palette.subdued};
  font-size: 12px;
  line-height: 1.45;
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

const DiagnosticsCard = styled(Card)`
  display: grid;
  gap: 0.7rem;
`;

const DiagnosticsList = styled.div`
  display: grid;
  gap: 0.45rem;
`;

const DiagnosticRow = styled.div`
  border: 1px solid ${palette.border};
  border-radius: 8px;
  background: ${palette.shell};
  padding: 0.6rem 0.7rem;
  display: grid;
  gap: 0.25rem;
`;

const DiagnosticHead = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
`;

const DiagnosticLabel = styled.strong`
  color: ${palette.text};
  font-size: 12px;
  font-weight: 500;
`;

const DiagnosticCategory = styled.span`
  font-family: "Geist Mono", "JetBrains Mono", monospace;
  color: ${palette.subdued};
  font-size: 10px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
`;

const DiagnosticMessage = styled.p`
  margin: 0;
  color: ${palette.subdued};
  font-size: 12px;
  line-height: 1.45;
`;

function classifyDiagnostic(message: string) {
  const text = message.toLowerCase();
  if (
    text.includes("cors") ||
    text.includes("preflight") ||
    text.includes("origin")
  ) {
    return "cors/network";
  }
  if (
    text.includes("401") ||
    text.includes("403") ||
    text.includes("unauthorized") ||
    text.includes("token")
  ) {
    return "auth";
  }
  if (text.includes("schema") || text.includes("validation")) {
    return "schema";
  }
  if (text.includes("timeout")) {
    return "timeout";
  }
  if (text.includes("abort") || text.includes("cancel")) {
    return "cancelled";
  }
  return "server";
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
  const abortControllerRef = useRef<AbortController | null>(null);

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

  const diagnostics = useMemo(() => {
    const rows = checks
      .filter((check) => check.state === "failed")
      .map((check) => ({
        label: check.title,
        category: classifyDiagnostic(check.detail),
        message: check.detail,
      }));

    if (runError) {
      rows.unshift({
        label: "Run error",
        category: classifyDiagnostic(runError),
        message: runError,
      });
    }

    return rows;
  }, [checks, runError]);

  const minimumLabel = useMemo(() => {
    if (running) {
      return "Running";
    }
    if (minimumPassed === null) {
      return "Not run";
    }
    return minimumPassed ? "Meets minimum" : "Misses minimum";
  }, [minimumPassed, running]);

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

    try {
      const report = await runConformitySuite({
        baseUrl,
        token: apiKey,
        signal: controller.signal,
        onChecks: (nextChecks) => {
          setChecks(nextChecks);
        },
        onLog: (entry) => {
          setEvents((current) => [entry, ...current].slice(0, 220));
        },
      });

      setChecks(report.checks);
      setMinimumPassed(report.minimumPassed);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setEvents((current) => [
          {
            timestamp: Date.now(),
            level: "warn",
            message: "Conformity run cancelled by user.",
          },
          ...current,
        ]);
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Failed to run conformity suite.";
      setRunError(message);
      setMinimumPassed(false);
      setEvents((current) => [
        {
          timestamp: Date.now(),
          level: "error",
          message,
        },
        ...current,
      ]);
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

        <Grid>
          <PanelCard>
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
          </PanelCard>

          <PanelCard>
            <CardHead>
              <CardTitle>Event Log</CardTitle>
              <CardCount>{events.length} entries</CardCount>
            </CardHead>
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
                {events.map((entry, index) => (
                  <EventRow key={`${entry.timestamp}-${entry.level}-${index}`}>
                    <EventMeta>
                      <span>
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                      <EventLevel $level={entry.level}>
                        {entry.level.toUpperCase()}
                      </EventLevel>
                    </EventMeta>
                    <EventMessage>{entry.message}</EventMessage>
                  </EventRow>
                ))}
              </EventList>
            )}
          </PanelCard>
        </Grid>

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

        <DiagnosticsCard>
          <CardHead>
            <CardTitle>Connection Diagnostics</CardTitle>
            <CardCount>{diagnostics.length} issues</CardCount>
          </CardHead>
          {diagnostics.length === 0 ? (
            <Empty>
              <EmptyTitle>No connection issues detected</EmptyTitle>
              <EmptyHint>
                Diagnostics will list likely causes when checks fail (auth,
                CORS/network, schema, timeout, or server).
              </EmptyHint>
            </Empty>
          ) : (
            <DiagnosticsList>
              {diagnostics.map((diagnostic, index) => (
                <DiagnosticRow
                  key={`${diagnostic.label}-${diagnostic.category}-${index}`}
                >
                  <DiagnosticHead>
                    <DiagnosticLabel>{diagnostic.label}</DiagnosticLabel>
                    <DiagnosticCategory>
                      {diagnostic.category}
                    </DiagnosticCategory>
                  </DiagnosticHead>
                  <DiagnosticMessage>{diagnostic.message}</DiagnosticMessage>
                </DiagnosticRow>
              ))}
            </DiagnosticsList>
          )}
        </DiagnosticsCard>
      </Container>
    </Page>
  );
}
