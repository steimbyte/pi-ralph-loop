# pi-ralph-loop

A looping command for [pi](https://github.com/badlogic/pi-mono) that auto-reprompts the LLM with your original task until stopped.

![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **Single toggle command**: `/ralph` to start/stop
- **Per-session state**: Each session has its own loop state
- **Auto-reprompt**: Automatically sends your task after each LLM response
- **Visual indicator**: Blinking green circle when active

## Installation

```bash
pi install git:github.com:steimbyte/pi-ralph-loop
```

## Usage

```bash
# Start loop with a task
/ralph Write tests for my auth module

# Or start with last user message as task
You: Write a comprehensive test suite
/ralph

# Stop the loop
/ralph
```

## How It Works

1. `/ralph` captures your task (from args or last message)
2. Sends the task to the LLM
3. After each response, automatically reprompts with the same task
4. Loops until you type `/ralph` again to stop

## Status Indicator

- 🟢 (blinking green) = Ralph is active
- ⚫ (dim) = Ralph is stopped

## Requirements

- [pi coding agent](https://www.npmjs.com/package/@mariozechner/pi-coding-agent)

## License

MIT
