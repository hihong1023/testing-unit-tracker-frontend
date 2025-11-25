// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { PromptProvider } from "./components/PromptProvider";


const client = new QueryClient();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <PromptProvider>
          <App />
        </PromptProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
