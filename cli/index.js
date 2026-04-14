#!/usr/bin/env node

const LINKIE_BASE_URL = process.env.LINKIE_URL || "https://linkie.vercel.app";

const args = process.argv.slice(2);

if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  console.log(`
  linkie - One link to open them all.

  Usage:
    linkie <url1> <url2> [url3] ...

  Examples:
    linkie https://github.com/org/repo/pull/1 https://github.com/org/repo/pull/2
    linkie https://example.com https://example.org

  Environment:
    LINKIE_URL  Base URL for the Linkie web app (default: ${LINKIE_BASE_URL})
`);
  process.exit(0);
}

const encoded = Buffer.from(JSON.stringify(args)).toString("base64");
const url = `${LINKIE_BASE_URL}/#${encoded}`;

console.log(url);
