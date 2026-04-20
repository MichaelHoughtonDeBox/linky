// CJS barrel. The package's `"exports"` points consumers to `client.js`
// directly; this file exists so `require("getalinky/sdk")` without
// the `.js` suffix keeps working for tooling that resolves a directory
// import. See `package.json` → `exports["./sdk"]`.
/* eslint-disable @typescript-eslint/no-require-imports */
module.exports = require("./client.js");
