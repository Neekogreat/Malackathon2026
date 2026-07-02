import { useState } from "react";
import { Send, Loader2, Brain, Route, ShieldCheck, DollarSign } from "lucide-react";
import PanelTitle from "./PanelTitle";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const API_URL = `${API_BASE_URL}/v1/chat/completions`;

function formatCost(value) {
  if (value === undefined || value === null) return "-";
  return `$${Number(value).toFixed(8)}`;
}

function getAssistantContent(response) {
  return response?.choices?.[0]?.message?.content || "";
}

function PromptTester({ onRequestCompleted }) {
  const [consumerId, setConsumerId] = useState("equipo-marketing");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [backendResponse, setBackendResponse] = useState(null);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (!prompt.trim()) {
      setError("Escribe un prompt antes de enviarlo.");
      return;
    }

    setLoading(true);
    setError("");
    setBackendResponse(null);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Consumer-ID": consumerId
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: prompt
            }
          ]
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || "Error al llamar al backend");
      }

      setBackendResponse(data);

      if (onRequestCompleted) {
        await onRequestCompleted();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const finops = backendResponse?.finops;
  const analysis = finops?.analysis;
  const mainTask = analysis?.primary_task_type || analysis?.task_types?.[0]?.type || "-";
  const confidence = analysis?.task_types?.[0]?.confidence;
  const assistantContent = getAssistantContent(backendResponse);

  return (
    <section className="panel prompt-tester">
      <PanelTitle
        icon={<Brain size={18} />}
        title="Live Prompt Tester"
        subtitle="Send a real prompt through the AI FinOps Proxy"
      />

      <form onSubmit={handleSubmit} className="prompt-form">
        <div className="prompt-row">
          <label>
            Consumer
            <select
              value={consumerId}
              onChange={(event) => setConsumerId(event.target.value)}
            >
              <option value="equipo-marketing">equipo-marketing</option>
              <option value="equipo-producto">equipo-producto</option>
            </select>
          </label>
        </div>

        <label>
          Prompt
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ejemplo: Resume qué es AI FinOps en una frase."
            rows={6}
          />
        </label>

        {error && <div className="prompt-error">{error}</div>}

        <button className="primary-button prompt-button" disabled={loading}>
          {loading ? (
            <>
              <Loader2 size={16} className="spin" />
              Sending...
            </>
          ) : (
            <>
              <Send size={16} />
              Send to proxy
            </>
          )}
        </button>
      </form>

      {backendResponse && (
        <div className="prompt-result">
          <h4>Proxy decision</h4>

          <div className="result-grid">
            <div className="result-card">
              <Brain size={18} />
              <span>Task category</span>
              <strong>{mainTask}</strong>
              <small>
                Confidence:{" "}
                {confidence !== undefined
                  ? `${Math.round(confidence * 100)}%`
                  : "-"}
              </small>
            </div>

            <div className="result-card">
              <Route size={18} />
              <span>Selected provider</span>
              <strong>{finops?.provider || "-"}</strong>
              <small>{finops?.model || "-"}</small>
            </div>

            <div className="result-card">
              <ShieldCheck size={18} />
              <span>Risk / Complexity</span>
              <strong>{analysis?.risk_level || "-"}</strong>
              <small>Complexity: {analysis?.complexity || "-"}</small>
            </div>

            <div className="result-card">
              <DollarSign size={18} />
              <span>Estimated real cost</span>
              <strong>{formatCost(finops?.cost?.total_cost)}</strong>
              <small>
                Budget used:{" "}
                {finops?.budget?.budget_percentage_after !== undefined
                  ? `${Number(finops.budget.budget_percentage_after).toFixed(2)}%`
                  : "-"}
              </small>
            </div>
          </div>

          <div className="routing-box">
            <strong>Routing strategy</strong>
            <p>{finops?.strategy || "-"}</p>
          </div>

          <div className="routing-box">
            <strong>Routing reason</strong>
            <p>{finops?.reason || "-"}</p>
          </div>

          {assistantContent && (
            <div className="routing-box">
              <strong>AI response</strong>
              <p>{assistantContent}</p>
            </div>
          )}

          <details className="raw-json">
            <summary>Show raw backend response</summary>
            <pre>{JSON.stringify(backendResponse, null, 2)}</pre>
          </details>
        </div>
      )}
    </section>
  );
}

export default PromptTester;