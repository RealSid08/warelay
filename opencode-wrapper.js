#!/usr/bin/env node
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

// Mapping file to store Warelay UUID -> Opencode Session ID
// Store it in the same directory as the script or in the cwd
const MAPPING_FILE = path.join(process.cwd(), "session-mapping.json");

// Parse args
const args = process.argv.slice(2);
let sessionArgIndex = args.indexOf("--session");
let warelaySessionId = null;

if (sessionArgIndex !== -1 && args[sessionArgIndex + 1]) {
    warelaySessionId = args[sessionArgIndex + 1];
}

let opencodeSessionId = null;
let mapping = {};

// Load mapping
if (fs.existsSync(MAPPING_FILE)) {
    try {
        mapping = JSON.parse(fs.readFileSync(MAPPING_FILE, "utf8"));
    } catch (e) {
        console.error("Failed to parse session mapping file", e);
    }
}

// If we have a Warelay Session ID, try to find the mapped Opencode ID
if (warelaySessionId) {
    if (mapping[warelaySessionId]) {
        opencodeSessionId = mapping[warelaySessionId];
        // Replace the Warelay ID with the Opencode ID in args
        args[sessionArgIndex + 1] = opencodeSessionId;
    } else {
        // New session for this Warelay ID.
        // We must NOT pass --session to opencode, so it generates a new one.
        // We will capture it from stdout and save the mapping.
        args.splice(sessionArgIndex, 2); // Remove --session <id>
    }
}

// Run opencode
const opencode = spawn("opencode", args, {
    stdio: ["inherit", "pipe", "inherit"], // Pipe stdout to capture session ID
});

let outputBuffer = "";

opencode.stdout.on("data", (data) => {
    const chunk = data.toString();
    outputBuffer += chunk;
    process.stdout.write(chunk); // Pass through to warelay

    // Try to capture session ID if we don't have one yet
    if (!opencodeSessionId && warelaySessionId) {
        const match = chunk.match(/"sessionID":"(ses_[^"]+)"/);
        if (match) {
            opencodeSessionId = match[1];
            mapping[warelaySessionId] = opencodeSessionId;
            try {
                fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2));
            } catch (e) {
                // ignore write errors
            }
        }
    }
});

opencode.on("close", (code) => {
    process.exit(code);
});
