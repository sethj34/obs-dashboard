import argparse
import json
import os
import pickle
import sys
from pathlib import Path

from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

UPLOAD_CATEGORY_ID = "22"
SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]

# Make these resolve relative to this script (NOT wherever Node runs from)
SCRIPT_DIR = Path(__file__).resolve().parent
CLIENT_SECRETS_FILE = SCRIPT_DIR / "client_secrets.json"
TOKEN_CACHE_FILE = SCRIPT_DIR / "token.pickle"


def get_authenticated_service():
    creds = None

    if TOKEN_CACHE_FILE.exists():
        with TOKEN_CACHE_FILE.open("rb") as f:
            creds = pickle.load(f)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_SECRETS_FILE), SCOPES)
            creds = flow.run_local_server(port=0)
        with TOKEN_CACHE_FILE.open("wb") as f:
            pickle.dump(creds, f)

    return build("youtube", "v3", credentials=creds)


def upload(video_file: str, title: str, privacy: str):
    youtube = get_authenticated_service()

    body = {
        "snippet": {
            "title": title,
            "description": "",
            "categoryId": UPLOAD_CATEGORY_ID,
        },
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": False,
        },
    }

    media = MediaFileUpload(video_file, resumable=True)

    request = youtube.videos().insert(
        part="snippet,status",
        body=body,
        media_body=media,
    )

    response = None
    last_pct = -1

    while response is None:
        status, response = request.next_chunk()
        if status:
            pct = int(status.progress() * 100)
            # avoid spamming duplicates (optional)
            if pct != last_pct:
                print(f"PROGRESS {pct}", flush=True)
                last_pct = pct

    # Ensure 100 is printed
    if last_pct < 100:
        print("PROGRESS 100", flush=True)

    return response


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True)
    parser.add_argument("--title", required=True)
    parser.add_argument("--privacy", default="unlisted")
    parser.add_argument("--videoId", required=False)  # optional, not needed for upload
    args = parser.parse_args()

    try:
        resp = upload(args.file, args.title, args.privacy)

        # YouTube API typically returns id + snippet + status
        yt_id = resp.get("id")
        result = {
            "ok": True,
            "youtubeVideoId": yt_id,
            "youtubeUrl": f"https://www.youtube.com/watch?v={yt_id}" if yt_id else None,
        }

        # Node parses this line if you keep the "RESULT " prefix
        print("RESULT " + json.dumps(result), flush=True)
        sys.exit(0)

    except Exception as e:
        # stderr so Node captures it as error
        print(f"ERROR {type(e).__name__}: {e}", file=sys.stderr, flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()