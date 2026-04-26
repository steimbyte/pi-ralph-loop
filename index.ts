/**
 * Ralph Loop Extension - Auto-reprompt until stopped
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

interface SessionState {
	isLooping: boolean;
	loopIteration: number;
	originalTask: string;
}

interface AllStates {
	[sessionId: string]: SessionState;
}

const STATE_FILE = join(homedir(), ".local", "share", "ralph-loop", "state.json");

const PULSE_ON = "\x1b[32m\x1b[5m●\x1b[0m";
const PULSE_OFF = "\x1b[30m●\x1b[0m";

function ensureDir(dir: string) {
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

function loadAllStates(): AllStates {
	try {
		if (existsSync(STATE_FILE)) {
			return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
		}
	} catch (e) {}
	return {};
}

function saveAllStates(states: AllStates) {
	try {
		ensureDir(join(homedir(), ".local", "share", "ralph-loop"));
		writeFileSync(STATE_FILE, JSON.stringify(states, null, 2));
	} catch (e) {}
}

function getSessionState(sessionId: string): SessionState {
	return loadAllStates()[sessionId] || { isLooping: false, loopIteration: 0, originalTask: "" };
}

function saveSessionState(sessionId: string, state: SessionState) {
	const all = loadAllStates();
	all[sessionId] = state;
	saveAllStates(all);
}

export default function (pi: ExtensionAPI) {

	function getLastUserMessage(): string {
		try {
			const branch = pi.sessionManager.getBranch();
			for (let i = branch.length - 1; i >= 0; i--) {
				const entry = branch[i];
				if (entry.type === "message" && entry.message.role === "user") {
					const content = entry.message.content;
					if (typeof content === "string") return content;
					if (Array.isArray(content)) {
						return content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
					}
				}
			}
		} catch (e) {}
		return "";
	}

	// Auto-reprompt on agent_end - send immediately when idle
	pi.on("agent_end", async (event, ctx) => {
		const sessionId = ctx.sessionManager.getSessionId();
		const state = getSessionState(sessionId);
		if (!state.isLooping) return;
		if (!state.originalTask) return;

		// Check immediately if idle, otherwise wait
		if (ctx.isIdle()) {
			sendReprompt(sessionId, state, ctx);
		} else {
			// Poll until idle
			const interval = setInterval(() => {
				if (ctx.isIdle()) {
					clearInterval(interval);
					sendReprompt(sessionId, state, ctx);
				}
			}, 100);
		}
	});

	function sendReprompt(sessionId: string, state: SessionState, ctx: any) {
		state.loopIteration++;
		saveSessionState(sessionId, state);
		ctx.ui.setStatus("ralph", `${PULSE_ON} Ralph: ${state.loopIteration}...`);
		pi.sendUserMessage(state.originalTask, { deliverAs: "steer" });
	}

	// Toggle command
	pi.registerCommand("ralph", {
		description: "Start/stop auto-reprompt loop",
		handler: async (args: string | string[], ctx) => {
			const sessionId = ctx.sessionManager.getSessionId();
			const state = getSessionState(sessionId);

			if (state.isLooping) {
				state.isLooping = false;
				saveSessionState(sessionId, state);
				ctx.ui.setStatus("ralph", PULSE_OFF);
				ctx.ui.notify(`Ralph stopped (${state.loopIteration} iterations)`, "info");
				return;
			}

			let task = Array.isArray(args) ? args.join(" ").trim() : args.trim();
			if (!task) task = getLastUserMessage();
			if (!task.trim()) {
				ctx.ui.notify("Pass task as argument or send message first", "error");
				return;
			}

			state.originalTask = task;
			state.isLooping = true;
			state.loopIteration = 1;
			saveSessionState(sessionId, state);

			ctx.ui.notify("Ralph on!", "info");
			ctx.ui.setStatus("ralph", `${PULSE_ON} Ralph: 1...`);
			pi.sendUserMessage(state.originalTask);
		},
	});

	// Restore status on session start
	pi.on("session_start", async (_event, ctx) => {
		const sessionId = ctx.sessionManager.getSessionId();
		const state = getSessionState(sessionId);
		if (state.isLooping) {
			ctx.ui.setStatus("ralph", `${PULSE_ON} Ralph: ${state.loopIteration}...`);
		}
	});
}
