#!/usr/bin/env python3
import base64
import gzip
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Mapping, Optional


PERMISSIONS_ERROR = (
    "Coverage upload returned 403 Forbidden. Ensure the calling job has "
    "'code-quality: write' permission. See https://github.com/actions/upload-code-coverage#permissions"
)


def emit_annotation(level: str, message: str) -> None:
    print(f"::{level}::{message}")


def encode_coverage_report(file_path: str) -> str:
    data = Path(file_path).read_bytes()
    return base64.b64encode(gzip.compress(data)).decode("ascii")


def build_payload(
    *,
    file_path: str,
    language: str,
    label: str,
    commit_oid: str,
    ref: str = "",
    pr_number: str = "",
) -> dict:
    payload = {
        "commit_oid": commit_oid,
        "coverage_report": encode_coverage_report(file_path),
        "language_name": language,
        "label": label,
    }

    if pr_number:
        payload["pull_request_number"] = int(pr_number)
    elif ref:
        payload["ref"] = ref
    else:
        raise ValueError("Either PR_NUMBER or REF must be provided")

    return payload


def upload_report(
    *,
    payload: dict,
    repository: str,
    api_url: str,
    token: str,
    opener=urllib.request.urlopen,
) -> int:
    request = urllib.request.Request(
        url=f"{api_url.rstrip('/')}/repos/{repository}/code-coverage/report",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
        },
        method="PUT",
    )

    try:
        with opener(request) as response:
            response.read()
            return response.getcode()
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        if error.code == 403 and "not authorized" in body.lower():
            emit_annotation("error", PERMISSIONS_ERROR)
        else:
            emit_annotation("error", f"Coverage upload failed with status {error.code}: {body}")
        return error.code
    except urllib.error.URLError as error:
        emit_annotation("error", f"Coverage upload failed: {error.reason}")
        return 1


def main(environ: Optional[Mapping[str, str]] = None, opener=urllib.request.urlopen) -> int:
    env = dict(os.environ if environ is None else environ)

    file_path = env.get("INPUT_FILE", "")
    if not file_path or not Path(file_path).is_file():
        emit_annotation("error", f"Coverage file not found: {file_path}")
        return 1

    try:
        payload = build_payload(
            file_path=file_path,
            language=env.get("INPUT_LANGUAGE", ""),
            label=env.get("INPUT_LABEL", ""),
            commit_oid=env.get("COMMIT_OID", ""),
            ref=env.get("REF", ""),
            pr_number=env.get("PR_NUMBER", ""),
        )
    except ValueError as error:
        emit_annotation("error", str(error))
        return 1

    status = upload_report(
        payload=payload,
        repository=env.get("GITHUB_REPOSITORY", ""),
        api_url=env.get("GITHUB_API_URL", "https://api.github.com"),
        token=env.get("GH_TOKEN", ""),
        opener=opener,
    )

    return 0 if 200 <= status < 300 else 1


if __name__ == "__main__":
    sys.exit(main())
