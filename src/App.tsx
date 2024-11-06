import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { FaEdit, FaSpinner, FaStop } from "react-icons/fa";

import { getClaudeAPIKey, setClaudeAPIKey } from "./localStore";
import { PowBlocksEngine } from "./engine/engine";
import { MemoryCodeStore } from "./engine/memoryStore";
import { nanoid } from "./lib/nanoid";

interface Task {
  id: string;
  code: string;
  status: "running" | "completed" | "error";
  result?: string;
}

function App() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [claudeKey, setClaudeKey] = useState<string>("");
  const [engine, setEngine] = useState<PowBlocksEngine | null>(null);
  const [description, setDescription] = useState<string>("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    // Load initial Claude API key
    getClaudeAPIKey().then((key) => {
      if (key) {
        setClaudeKey(key);
      }
    });
  }, []);

  useEffect(() => {
    // Create/update engine when Claude key changes
    if (claudeKey) {
      setEngine(
        new PowBlocksEngine({
          store: new MemoryCodeStore(),
          apiKeys: {
            ANTHROPIC_API_KEY: claudeKey,
            OPENAI_API_KEY: "",
          },
        })
      );
    } else {
      setEngine(null);
    }
  }, [claudeKey]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isPolling) {
      interval = setInterval(async () => {
        const runningTasks = tasks.filter((t) => t.status === "running");

        for (const task of runningTasks) {
          try {
            const result = await invoke("get_return_value", {
              taskId: task.id,
            });

            let parsedResult: string;
            try {
              parsedResult = JSON.parse(result as string);
            } catch (error) {
              parsedResult = result as string;
            }

            setTasks((prev) =>
              prev.map((t) =>
                t.id === task.id
                  ? { ...t, status: "completed", result: parsedResult }
                  : t
              )
            );

            if (task.id === tasks[tasks.length - 1]?.id) {
              setResult(parsedResult);
            }
          } catch (error) {
            if ((error as string) !== "Task still running") {
              setTasks((prev) =>
                prev.map((t) =>
                  t.id === task.id
                    ? { ...t, status: "error", result: `Error: ${error}` }
                    : t
                )
              );
            } else {
              console.log("Task still running");
            }
          }
        }

        if (runningTasks.length === 0) {
          setIsPolling(false);
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isPolling, tasks]);

  const handleRunCode = async () => {
    if (!engine) {
      setResult("Error: Please set Claude API key first");
      return;
    }

    const newTaskId = nanoid();
    const newTask: Task = {
      id: newTaskId,
      code,
      status: "running",
    };

    try {
      setTasks((prev) => [...prev, newTask]);
      setIsPolling(true);

      await invoke("run_code", {
        taskId: newTaskId,
        code,
      });
    } catch (error) {
      console.error("Failed to run code:", error);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === newTaskId
            ? { ...t, status: "error", result: `Error: ${error}` }
            : t
        )
      );
    }
  };

  const handleStopTask = async (taskId: string) => {
    try {
      await invoke("stop_code", { taskId });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: "completed", result: "Task cancelled" }
            : t
        )
      );
    } catch (error) {
      console.error("Failed to stop task:", error);
    }
  };

  const handleGenerateCode = async () => {
    if (!engine) {
      setResult("Error: Please set Claude API key first");
      return;
    }

    try {
      setIsGenerating(true);
      const block = await engine.generateFunctionBlock(description);
      setCode(block.code);
    } catch (error) {
      console.error("Failed to generate code:", error);
      setResult(`Error: ${error}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 p-4">
          <h1 className="text-xl font-medium text-gray-900">PowBlocs</h1>
        </div>

        <ClaudeAPIKey
          onClaudeAPIKeyChange={async (key: string) => {
            setClaudeKey(key);
          }}
        />

        <div className="p-4">
          <div className="mb-4">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the code you want to generate..."
              className="w-full p-2 border rounded-md"
              rows={3}
            />
            <button
              onClick={handleGenerateCode}
              className="mt-2 w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:bg-green-300 disabled:cursor-not-allowed"
              disabled={!engine || !description || isGenerating}
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <FaSpinner className="animate-spin" />
                  Generating...
                </span>
              ) : (
                "Generate Code"
              )}
            </button>
          </div>

          <CodeMirror
            value={code}
            height="200px"
            extensions={[javascript({ jsx: true })]}
            onChange={(value) => setCode(value)}
          />
          <button
            onClick={handleRunCode}
            className="mt-3 w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
            disabled={!engine}
          >
            {engine ? "Run Code" : "Set Claude API Key to Run Code"}
          </button>

          {tasks.length > 0 && (
            <div className="mt-4">
              <h2 className="text-lg font-medium text-gray-900 mb-2">Tasks:</h2>
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div key={task.id} className="bg-gray-50 p-3 rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{task.id}</span>
                        {task.status === "running" && (
                          <>
                            <FaSpinner className="animate-spin text-blue-500" />
                            <button
                              onClick={() => handleStopTask(task.id)}
                              className="text-red-500 hover:text-red-600"
                            >
                              <FaStop />
                            </button>
                          </>
                        )}
                      </div>
                      <span
                        className={`text-sm ${
                          task.status === "completed"
                            ? "text-green-500"
                            : task.status === "error"
                            ? "text-red-500"
                            : "text-blue-500"
                        }`}
                      >
                        {task.status}
                      </span>
                    </div>
                    {task.result && (
                      <pre className="font-mono text-sm overflow-auto max-h-32 whitespace-pre-wrap">
                        {task.result}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result !== null && (
            <div className="mt-4">
              <h2 className="text-lg font-medium text-gray-900 mb-2">
                Latest Result:
              </h2>
              <pre className="bg-gray-50 p-3 rounded-md font-mono text-sm overflow-auto max-h-64 whitespace-pre-wrap">
                {result}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClaudeAPIKey({
  onClaudeAPIKeyChange,
}: {
  onClaudeAPIKeyChange: (key: string) => void;
}) {
  const [claudeKey, setClaudeKey] = useState<string>("");
  const [isEditingKey, setIsEditingKey] = useState<boolean>(false);

  useEffect(() => {
    handleLoadClaudeKey();
  }, []);

  async function handleSaveClaudeKey() {
    await setClaudeAPIKey(claudeKey);
    onClaudeAPIKeyChange(claudeKey);
    alert("Claude API Key saved!");
    setIsEditingKey(false);
  }

  async function handleLoadClaudeKey() {
    const key = await getClaudeAPIKey();
    if (key) {
      setClaudeKey(key);
      onClaudeAPIKeyChange(key);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      handleSaveClaudeKey();
    }
  }

  return (
    <div className="p-2 bg-white rounded shadow w-fit">
      <div className="flex gap-2 items-center">
        <h2 className="text-sm font-semibold">Claude API Key:</h2>
        {isEditingKey ? (
          <input
            type="text"
            value={claudeKey}
            onChange={(e) => setClaudeKey(e.target.value)}
            placeholder="Enter Claude API Key"
            className="px-2 py-1 border rounded text-sm hover:border-gray-300 transition-colors focus:outline-blue-500"
            autoFocus
            onBlur={handleSaveClaudeKey}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <span className="flex items-center gap-2">
            <span
              onClick={() => setIsEditingKey(true)}
              className="px-2 py-1 border rounded cursor-pointer text-sm"
            >
              {claudeKey
                ? `${claudeKey.slice(0, 12)}...`
                : "Click to enter API Key"}
            </span>
            <FaEdit
              onClick={() => setIsEditingKey(true)}
              className="text-blue-500 cursor-pointer hover:text-blue-600 transition-colors text-sm"
            />
          </span>
        )}
      </div>
    </div>
  );
}

export default App;
