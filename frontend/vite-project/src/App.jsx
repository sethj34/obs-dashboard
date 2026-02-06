import { useEffect, useState } from "react";
import "./App.css";

const API_BASE = "http://localhost:3001";

async function uploadToYoutube(selected) {
  const res = await fetch(`${API_BASE}/videos/${selected.id}/upload/youtube`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ privacy: "unlisted" }),
  });
  const out = await res.json();
  console.log(out);
}

export default function Videos() {
    const [videos, setVideos] = useState([]);
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        fetch(`${API_BASE}/videos`)
            .then(r => r.json())
            .then(setVideos);
    }, []);

    return (
        <div className="app">
            <div className="list">
                {videos.map(v => (
                    <div className="video-item" key={v.id}
                        onClick={() => setSelected(v)}>
                        <div className="video-title-small">{v.title}</div>
                        <div className="video-date-small">{new Date(v.createdAt).toLocaleString()}</div>
                    </div>
                ))}
            </div>

            <div className="preview">
                {selected ? (
                    <>
                        <div className="item-header-items">
                            <h2 className="video-title-big">{selected.title}</h2>
                            <button className="close-display" onClick={() => setSelected(null)}>X</button>
                        </div>
                        <video
                            controls
                            className="video"
                            src={`${API_BASE}/videos/${selected.id}/stream`}
                        />
                        <button
                            className="action-button"
                            onClick={() => uploadToYoutube(selected)}>
                            Upload to Youtube
                        </button>
                    </>
                ) : (
                    <div className="select-video">Select a video to perform actions...</div>
                )}
            </div>
        </div>
    );
}