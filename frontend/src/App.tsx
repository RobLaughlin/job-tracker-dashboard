import { createGlobalStyle } from "styled-components";
import Dashboard from "./Dashboard";

const GlobalStyle = createGlobalStyle`
  * {
    box-sizing: border-box;
  }

  html,
  body,
  #root {
    margin: 0;
    padding: 0;
    background: #0a0b10;
    color: #eef0f5;
    font-family: "Geist", "Inter", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  body {
    min-height: 100vh;
  }
`;

function App() {
  return (
    <>
      <GlobalStyle />
      <Dashboard />
    </>
  );
}

export default App;
