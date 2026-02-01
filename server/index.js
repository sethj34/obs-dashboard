import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const app = express();
app.use(cors());
app.use(express.json());

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "videos");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const DB_PATH = path.join(process.cwd(), "db.json");
function loadDb() {
  if (!fs.existsSync(DB_PATH)) return { videos: [] };
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}
function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const id = crypto.randomBytes(12).toString("hex");
    const ext = path.extname(file.originalname) || "";
    cb(null, `${id}${ext}`);
  },
});

const upload = multer({ storage });

app.post("/videos", upload.single("file"), (req, res) => {
  const title = req.body.title ?? req.file.originalname;
  const db = loadDb();

  const id = path.parse(req.file.filename).name; // filename is `${id}.ext`
  const record = {
    id,
    title,
    createdAt: new Date().toISOString(),
    filename: req.file.filename,
    originalName: req.file.originalname,
    sizeBytes: req.file.size,
    mimeType: req.file.mimetype,
  };

  db.videos.unshift(record);
  saveDb(db);

  res.status(201).json(record);
});

app.get("/videos", (req, res) => {
  const db = loadDb();
  res.json(db.videos);
});

// Streaming with Range support
app.get("/videos/:id/stream", (req, res) => {
  const db = loadDb();
  const vid = db.videos.find(v => v.id === req.params.id);
  if (!vid) return res.sendStatus(404);

  const filePath = path.join(UPLOAD_DIR, vid.filename);
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (!range) {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": vid.mimeType || "video/mp4",
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // Range: bytes=start-end
  const match = range.match(/bytes=(\d+)-(\d*)/);
  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

  const chunkSize = end - start + 1;

  res.writeHead(206, {
    "Content-Range": `bytes ${start}-${end}/${fileSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": chunkSize,
    "Content-Type": vid.mimeType || "video/mp4",
  });

  fs.createReadStream(filePath, { start, end }).pipe(res);
});

app.listen(3001, () => {
  console.log("API running on http://localhost:3001");
});
