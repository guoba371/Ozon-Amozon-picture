"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;

function loadEnvFile() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const PORT = Number(process.env.PORT || 5174);
const MODEL = process.env.OPENAI_RESPONSES_MODEL || "gpt-image-2";
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com";
const RESPONSES_URL = buildResponsesUrl(OPENAI_BASE_URL);
const IMAGE_GENERATIONS_URL = buildImageGenerationsUrl(OPENAI_BASE_URL);
const IMAGE_EDITS_URL = buildImageEditsUrl(OPENAI_BASE_URL);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) {
        reject(new Error("请求体过大，请上传更小的商品图"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("请求 JSON 格式无效"));
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(ROOT, requestedPath));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "content-type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
    });
    res.end(data);
  });
}

function extractImageCall(responsePayload) {
  const output = Array.isArray(responsePayload.output) ? responsePayload.output : [];
  return output.find((item) => item.type === "image_generation_call");
}

function buildResponsesUrl(baseUrl) {
  const cleanBaseUrl = String(baseUrl || "https://api.openai.com").replace(/\/+$/, "");
  return cleanBaseUrl.endsWith("/v1")
    ? `${cleanBaseUrl}/responses`
    : `${cleanBaseUrl}/v1/responses`;
}

function buildImageGenerationsUrl(baseUrl) {
  const cleanBaseUrl = String(baseUrl || "https://api.openai.com").replace(/\/+$/, "");
  return cleanBaseUrl.endsWith("/v1")
    ? `${cleanBaseUrl}/images/generations`
    : `${cleanBaseUrl}/v1/images/generations`;
}

function buildImageEditsUrl(baseUrl) {
  const cleanBaseUrl = String(baseUrl || "https://api.openai.com").replace(/\/+$/, "");
  return cleanBaseUrl.endsWith("/v1")
    ? `${cleanBaseUrl}/images/edits`
    : `${cleanBaseUrl}/v1/images/edits`;
}

function dataUrlToFile(dataUrl, name) {
  const match = String(dataUrl).match(/^data:([^;,]+)(;base64)?,(.*)$/);
  if (!match) {
    throw new Error("原始商品图格式无效，请重新上传图片");
  }
  const mimeType = match[1];
  const extension = mimeType.split("/")[1] || "png";
  const body = match[2]
    ? Buffer.from(match[3], "base64")
    : Buffer.from(decodeURIComponent(match[3]), "utf8");
  return new File([body], `${name}.${extension}`, { type: mimeType });
}

function extractGeneratedImage(payload) {
  const firstImage = Array.isArray(payload.data) ? payload.data[0] : null;
  if (firstImage?.b64_json) {
    return {
      imageBase64: firstImage.b64_json,
      imageDataUrl: `data:image/png;base64,${firstImage.b64_json}`,
      revisedPrompt: firstImage.revised_prompt || "",
    };
  }
  if (firstImage?.url) {
    return {
      imageBase64: "",
      imageDataUrl: firstImage.url,
      revisedPrompt: firstImage.revised_prompt || "",
    };
  }
  return null;
}

async function generateImage({ prompt, referenceImageDataUrl, action }) {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error("缺少 OPENAI_API_KEY，无法调用图片生成模型");
    error.statusCode = 500;
    throw error;
  }

  const imageRequest = {
    model: MODEL,
    prompt,
    n: 1,
    size: process.env.OPENAI_IMAGE_SIZE || "1024x1024",
    quality: process.env.OPENAI_IMAGE_QUALITY || "medium",
    response_format: "b64_json",
  };

  let response;
  if (referenceImageDataUrl) {
    const form = new FormData();
    for (const [key, value] of Object.entries(imageRequest)) {
      form.append(key, String(value));
    }
    form.append("image", dataUrlToFile(referenceImageDataUrl, "original-product"));
    response = await fetch(IMAGE_EDITS_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: form,
    });
  } else {
    response = await fetch(IMAGE_GENERATIONS_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(imageRequest),
    });
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error?.message || `OpenAI API 请求失败：${response.status}`;
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  const image = extractGeneratedImage(payload);
  if (!image) {
    const error = new Error("模型没有返回图片结果");
    error.statusCode = 502;
    throw error;
  }

  return {
    responseId: payload.id,
    imageCallId: "",
    revisedPrompt: image.revisedPrompt,
    imageBase64: image.imageBase64,
    imageDataUrl: image.imageDataUrl,
  };
}

async function handleGenerateImage(req, res) {
  try {
    const body = await readJsonBody(req);
    if (!body.prompt || typeof body.prompt !== "string") {
      sendJson(res, 400, { error: "缺少 prompt" });
      return;
    }
    const result = await generateImage({
      prompt: body.prompt,
      referenceImageDataUrl: body.referenceImageDataUrl,
      action: body.action,
    });
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message });
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/generate-image") {
    handleGenerateImage(req, res);
    return;
  }
  if (req.method === "GET" || req.method === "HEAD") {
    serveStatic(req, res);
    return;
  }
  res.writeHead(405);
  res.end("Method not allowed");
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Image prompt tool running at http://127.0.0.1:${PORT}/`);
  });
}

module.exports = {
  server,
  loadEnvFile,
  buildResponsesUrl,
  buildImageGenerationsUrl,
  buildImageEditsUrl,
  dataUrlToFile,
};
