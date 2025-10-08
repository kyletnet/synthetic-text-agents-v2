/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

import fs from "fs";
import path from "path";

export function appendJSONL(filePath: string, obj: unknown) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const line = JSON.stringify(obj) + "\n";
  fs.appendFileSync(filePath, line, "utf8");
}
