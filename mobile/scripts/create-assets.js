const fs = require("fs");
const path = require("path");

// Minimal valid 1x1 PNG (dark amber tone placeholder)
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const assetsDir = path.join(__dirname, "..", "assets");
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

for (const name of ["icon.png", "splash-icon.png", "adaptive-icon.png", "favicon.png"]) {
  const file = path.join(assetsDir, name);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, PNG);
    console.log("Created", name);
  }
}
