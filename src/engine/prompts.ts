import { ActionSchema } from "./engine";

export function generateTitleForBlockPrompt(description: string) {
  return `Generate a short, descriptive title (3-5 words) for this code block based on this description:
<description>${description}</description>

Output the title only. Output it in the following format:
<title>Title</title>`;
}

export function generateSpecificationForBlockPrompt(description: string) {
  return `You are an expert technical product manager. Generate a high-level specification for a system that fulfills the following block description:
<description>${description}</description>

The system runs on a platform that has the following capabilities:
- It has a backend that allows the system to run code. With Deno 2. It can attend to actions, return values and emit events.
- It has a storage system that allows the system to store data which is part of the backend. It uses SQLite.
- It has a UI that allows the user to interact with the system. It uses React 18.

The apps the system creates are local to the user's machine and have desktop capabilities (native) though Deno and the PowBlocs platform (desktop app they run on). These apps don't need authentication.

The specification should be high-level and should not include any code. It should be a list of features and capabilities that the system should have, with enough detail but geared towards a non-technical audience. Use markdown formatting.
`;
}

export function generateActionsForBlockPrompt(specification: string) {
  return `You are an expert software engineer. Generate backend actions for the block based on the specification. Backend actions are the functions that the block can perform, backed by backend code. An API for the visual layer to interact with the backend. Follow the specification:
<specification>${specification}</specification>

Output the backend actions in the following format. Pay attention to the actions input schema (schema) in the specification. If the action doesn't need any input, set the schema to an empty object. If not, set the schema to the correct schema. For instance:

The block should expose the following actions:

<specification>
...
## Actions
1. A "main" action that:
   - Takes no input parameters
   - Returns a string result
   - Emits progress events with a number value
   - Demonstrates basic functionality by showing a cowsay message and counting

2. A "cowsay" action that:
   - Takes a text string as input
   - Returns the cowsay result as a string
   - No events emitted

3. A "count" action that:
   - Takes a "to" number parameter
   - No return value
   - Emits progress events with the current count

...
</specification>

<actions>
{
  "actions": [
    {
      "name": "main",
      "description": "Main action that runs the default behavior",
      "inputSchema": {},
      "outputSchema": {
        "result": "string"
      },
      "eventsSchema": {
        "progress": {
          "progress": "number"
        }
      }
    },
    {
      "name": "cowsay",
      "description": "Makes the cow say something",
      "inputSchema": {
        "text": "string"
      },
      "outputSchema": {
        "result": "string"
      },
      "eventsSchema": {}
    },
    {
      "name": "count",
      "description": "Counts up to a number with progress events",
      "inputSchema": {
        "to": "number"
      },
      "outputSchema": {},
      "eventsSchema": {
        "progress": {
          "progress": "number"
        }
      }
    }
  ]
}
</actions>
`;
}

export function generateBackendCodeForBlockPrompt(specification: string) {
  return `You create blocks of well defined self-contained code in TypeScript that runs on Deno that fulfills the user's specification:
<specification>${specification}</specification>

Pow is a global object that contains the PowBlocs runtime functionality, here are the methods:
- Pow.send(eventName: string, data: Record<string, any>): sends an event to the PowBlocs runtime. Use for any output that needs streaming.
- Pow.returnValue(result: Record<string, any>): returns the result to the PowBlocs runtime. Use it for any output that doesn't need streaming, the final result.
- Pow.sleep(ms: number): sleeps for the given number of milliseconds.
- Pow.taskId: the id of the current task, it is set by the PowBlocs runtime. This is internally set and used by the PowBlocs runtime to identify the task.
- Pow.registerAction(actionName: string, action: (data: Record<string, any>) => void): registers an action that can be called by the PowBlocs runtime. The runtime will call the actions from a UI with list of actions. These are the entry points for the user to interact with the block.
- Pow.actionName: the name of the action that is currently being executed. This is set and internally used by the PowBlocs runtime.
- Pow.actionData: the data of the action that is currently being executed. This is set and internally used by the PowBlocs runtime.
- Pow.dirPath(name): returns the path to the specified user directory. User directory names are: audio, cache, config, data, data_local, desktop, document, download, executable, font, home, picture, preference, public, runtime, template, video, config_local, state.

Here is an example:

<code>
import * as cowsay from "https://esm.sh/cowsay@1.6.0";

Pow.registerAction("main", async () => {
  let result = cowsay.say({ text: "🤠 🚀" });

  // count to 100 and wait 1 second between each number
  for (let i = 0; i < 100; i++) {
    Pow.send("progress", { progress: i });
    await Pow.sleep(1000);
  }

  Pow.returnValue({ result });
});

Pow.registerAction("cowsay", async ({ text }: { text: string }) => {
  let result = cowsay.say({ text });

  Pow.returnValue({ result });
});

Pow.registerAction("count", async ({ to }: { to: number }) => {
  for (let i = 0; i < to; i++) {
    Pow.send("progress", { progress: i });
    await Pow.sleep(1000);
  }
});
</code>

The generated code is re-executed every time the user runs an action.

Generate the code only, no intro, no explanation, no markdown, just the code inside <code></code> tags.`;
}

export function generateUIForBlockPrompt(
  specification: string,
  title: string,
  actions: ActionSchema
) {
  return `Generate the React UI code for the block. Follow the specification:
<specification>${specification}</specification>

The block title is:
<title>${title}</title>

The backend exposes the following actions:
<actions>${JSON.stringify(actions, null, 2)}</actions>

There are global hooks and functions that you can use to listen to events and state changes, and to fire actions:
- Pow.useEvent(eventName, (data) => {
  // do something
})
- const result = Pow.useActionResult(actionName, (data) => {
  // do something
})
- Pow.runAction(actionName, input)

Output UI like it is going to be rendered in react-runner. Output it in the following format:
<uiCode>
import { useState } from 'react';

function App() {
  const [text, setText] = useState('');
  const [countTo, setCountTo] = useState(10);

  // Get result from cowsay action
  const result = Pow.useActionResult('cowsay');

  // Track progress from count action
  const [progress, setProgress] = useState(0);
  Pow.useEvent('progress', (data) => {
    setProgress(data.progress);
  });

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">{Pow.title}</h2>

      <div className="space-y-4">
        <div className="border p-4 rounded">
          <h3 className="font-bold mb-2">Cowsay</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              className="border p-2 rounded"
              placeholder="Enter text for cow"
            />
            <button
              onClick={() => Pow.runAction('cowsay', { text })}
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Make cow say
            </button>
          </div>
          {result && <pre className="mt-2 font-mono">{result.result}</pre>}
        </div>

        <div className="border p-4 rounded">
          <h3 className="font-bold mb-2">Counter</h3>
          <div className="flex gap-2">
            <input
              type="number"
              value={countTo}
              onChange={e => setCountTo(parseInt(e.target.value))}
              className="border p-2 rounded"
            />
            <button
              onClick={() => Pow.runAction('count', { to: countTo })}
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Start counting
            </button>
          </div>
          <div className="mt-2">
            Progress: {progress}
          </div>
        </div>
      </div>
    </div>
  );
}
</uiCode>`;
}
