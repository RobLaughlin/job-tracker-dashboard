import { useState, type FormEvent } from "react";
import styled from "styled-components";

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

function ChecklistGlyph() {
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
      <path d="M5 7l2 2 4-4" />
      <path d="M5 14l2 2 4-4" />
      <path d="M14 7h6" />
      <path d="M14 14h6" />
      <path d="M14 20h6" />
    </svg>
  );
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

  const canRun = baseUrl.trim().length > 0 && apiKey.trim().length > 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // TODO: wire to runConformitySuite from lib/conformity/suite.ts
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
          <RunButton type="submit" disabled={!canRun}>
            Run Conformity Check
            <ArrowGlyph />
          </RunButton>
        </FormCard>

        <Grid>
          <PanelCard>
            <CardHead>
              <CardTitle>Checks</CardTitle>
              <CardCount>0</CardCount>
            </CardHead>
            <Empty>
              <EmptyGlyph>
                <ChecklistGlyph />
              </EmptyGlyph>
              <EmptyTitle>No conformity run yet</EmptyTitle>
              <EmptyHint>
                Enter your job server URL and API key, then click Run Conformity
                Check to begin.
              </EmptyHint>
            </Empty>
          </PanelCard>

          <PanelCard>
            <CardHead>
              <CardTitle>Event Log</CardTitle>
              <CardCount>0 entries</CardCount>
            </CardHead>
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
          </PanelCard>
        </Grid>
      </Container>
    </Page>
  );
}
