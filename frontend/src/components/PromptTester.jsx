import { useState } from "react";
import { Send, Loader2, Brain, Route, ShieldCheck } from "lucide-react";
import PanelTitle from "./PanelTitle";

const API_URL = "http://localhost:3000/v1/chat/completions";

function PromptTester() {
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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

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
              <option value="equipo-soporte">equipo-soporte</option>
            </select>
          </label>
        </div>

        <label>
          Prompt
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ejemplo: Analiza este documento, resume los puntos importantes y genera código en Node.js."
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
              <span>Category</span>
              <strong>
                {backendResponse.classification?.mainCategory || "-"}
              </strong>
              <small>
                Confidence:{" "}
                {backendResponse.classification?.confidence !== undefined
                  ? `${Math.round(backendResponse.classification.confidence * 100)}%`
                  : "-"}
              </small>
            </div>

            <div className="result-card">
              <Route size={18} />
              <span>Selected provider</span>
              <strong>
                {backendResponse.selectedProvider?.name || "-"}
              </strong>
              <small>
                {backendResponse.selectedProvider?.model || "-"} ·{" "}
                {backendResponse.selectedProvider?.tier || "-"}
              </small>
            </div>

            <div className="result-card">
              <ShieldCheck size={18} />
              <span>Complexity</span>
              <strong>
                {backendResponse.complexity?.complexityLevel || "-"}
              </strong>
              <small>
                Score: {backendResponse.complexity?.finalScore ?? "-"}
              </small>
            </div>
          </div>

          {backendResponse.classification?.tasks?.length > 0 && (
            <div className="tasks-box">
              <h5>Detected tasks</h5>

              {backendResponse.classification.tasks.map((task, index) => (
                <div className="task-item" key={`${task.category}-${index}`}>
                  <div>
                    <strong>{task.category}</strong>
                    <p>{task.reason}</p>
                  </div>

                  <div className="task-meta">
                    <span>{task.complexity}</span>
                    <small>
                      score {task.complexityScore} ·{" "}
                      {Math.round(task.confidence * 100)}%
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="routing-box">
            <strong>Routing reason</strong>
            <p>{backendResponse.routingReason}</p>
          </div>

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