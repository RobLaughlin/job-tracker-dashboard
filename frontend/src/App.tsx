import styled from 'styled-components'
import { createGlobalStyle } from 'styled-components'
import { schemaPaths } from './generated/schema-registry'

const GlobalStyle = createGlobalStyle`
  :root {
    color: #1d2939;
    background-color: #f5f7fb;
    font-family: "Manrope", "Segoe UI", sans-serif;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    min-height: 100vh;
    background: radial-gradient(circle at top right, #d7e7ff 0%, #f5f7fb 40%, #eef3fa 100%);
  }
`

const Page = styled.main`
  width: min(920px, calc(100% - 2rem));
  margin: 3rem auto;
  padding: 2rem;
  border: 1px solid #d0d9e8;
  border-radius: 20px;
  background: linear-gradient(180deg, #ffffff 0%, #f7faff 100%);
  box-shadow: 0 24px 56px rgba(17, 40, 79, 0.12);
`

const Heading = styled.h1`
  margin: 0;
  color: #0b2b52;
  font-size: clamp(1.75rem, 1.3rem + 1.2vw, 2.5rem);
  letter-spacing: -0.02em;
`

const Description = styled.p`
  margin: 1rem 0 1.5rem;
  color: #405670;
  line-height: 1.55;
`

const StatGrid = styled.section`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`

const Stat = styled.article`
  border: 1px solid #d5deed;
  border-radius: 14px;
  padding: 1rem;
  background: #ffffff;
`

const Label = styled.p`
  margin: 0;
  color: #5b7089;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
`

const Value = styled.p`
  margin: 0.5rem 0 0;
  color: #102c4d;
  font-weight: 700;
  font-size: 1.6rem;
`

const Code = styled.code`
  font-family: "JetBrains Mono", "Consolas", monospace;
  font-size: 0.9rem;
  padding: 0.2rem 0.35rem;
  background: #eaf1ff;
  border-radius: 6px;
  color: #16457a;
`

function App() {
  return (
    <>
      <GlobalStyle />
      <Page>
        <Heading>Job Dashboard Frontend</Heading>
        <Description>
          Vite + React + TypeScript + styled-components are configured. Contract-driven types and JSON
          schema validator artifacts generate from <Code>../openapi.yaml</Code> and <Code>../schemas</Code>.
        </Description>

        <StatGrid>
          <Stat>
            <Label>Schema Files</Label>
            <Value>{schemaPaths.length}</Value>
          </Stat>
          <Stat>
            <Label>REST Types</Label>
            <Value>Generated</Value>
          </Stat>
          <Stat>
            <Label>SSE Validation</Label>
            <Value>Enabled</Value>
          </Stat>
        </StatGrid>
      </Page>
    </>
  )
}

export default App
