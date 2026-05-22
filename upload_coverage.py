#!/usr/bin/env python3
import base64
import gzip
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Mapping, Optional, Tuple


PERMISSIONS_ERROR = (
    "Coverage upload returned HTTP {status}. Ensure the calling job has "
    "'code-quality: write' permission. See https://github.com/actions/upload-code-coverage#permissions"
)

FAIL_ON_ERROR_HINT = (
    "To treat upload errors as warnings, add 'fail-on-error: false' to the action inputs."
)


def emit_annotation(level: str, message: str) -> None:
    print(f"::{level}::{message}")


def log_upload_parameters(
    *,
    commit_oid: str,
    ref: str,
    pr_number: str,
    language: str,
    label: str,
    file_path: str,
) -> None:
    file_size = Path(file_path).stat().st_size
    print("::group::Upload parameters")
    print(f"  commit_oid: {commit_oid}")
    print(f"  ref: {ref or '<not set>'}")
    print(f"  pr_number: {pr_number or '<not set>'}")
    print(f"  language: {language}")
    print(f"  label: {label}")
    print(f"  file: {file_path} ({file_size} bytes)")
    print("::endgroup::")


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
) -> Tuple[int, str]:
    """Upload the coverage report. Returns (status_code, response_body)."""
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
            body = response.read().decode("utf-8", errors="replace")
            return response.getcode(), body
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        return error.code, body
    except urllib.error.URLError as error:
        return 0, str(error.reason)


def handle_response(status: int, body: str, fail_on_error: bool) -> int:
    """Process the upload response. Returns the process exit code."""
    if status == 0:
        # Network error (could not reach the API)
        emit_annotation("error", f"Coverage upload failed: could not reach the API. {FAIL_ON_ERROR_HINT}")
        return 1 if fail_on_error else 0

    if status == 201:
        print("Coverage report uploaded successfully.")
        return 0

    if status == 200:
        # API accepted but did not store (e.g. commit not latest on branch)
        try:
            message = json.loads(body).get("message", "")
        except (json.JSONDecodeError, AttributeError):
            message = ""
        if message:
            emit_annotation("warning", f"Coverage upload returned HTTP 200 (report not stored): {message}")
        else:
            emit_annotation("warning", "Coverage upload returned HTTP 200 but expected 201. The report may not have been stored.")
        return 0

    if status >= 400:
        if status == 403 and "not authorized" in body.lower():
            emit_annotation("error", f"{PERMISSIONS_ERROR.format(status=status)}. {FAIL_ON_ERROR_HINT}")
        else:
            emit_annotation("error", f"Coverage upload failed (HTTP {status}): {body}. {FAIL_ON_ERROR_HINT}")
        return 1 if fail_on_error else 0

    # Unexpected status code
    emit_annotation("notice", f"Coverage upload returned unexpected HTTP {status}: {body}")
    return 0


def main(environ: Optional[Mapping[str, str]] = None, opener=urllib.request.urlopen) -> int:
    env = dict(os.environ if environ is None else environ)

    file_path = env.get("INPUT_FILE", "")
    if not file_path or not Path(file_path).is_file():
        emit_annotation("error", f"Coverage file not found: {file_path}")
        return 1

    fail_on_error = env.get("FAIL_ON_ERROR", "true").lower() != "false"

    commit_oid = env.get("COMMIT_OID", "")
    ref = env.get("REF", "")
    pr_number = env.get("PR_NUMBER", "")
    language = env.get("INPUT_LANGUAGE", "")
    label = env.get("INPUT_LABEL", "")

    log_upload_parameters(
        commit_oid=commit_oid,
        ref=ref,
        pr_number=pr_number,
        language=language,
        label=label,
        file_path=file_path,
    )

    try:
        payload = build_payload(
            file_path=file_path,
            language=language,
            label=label,
            commit_oid=commit_oid,
            ref=ref,
            pr_number=pr_number,
        )
    except ValueError as error:
        emit_annotation("error", str(error))
        return 1

    status, body = upload_report(
        payload=payload,
        repository=env.get("GITHUB_REPOSITORY", ""),
        api_url=env.get("GITHUB_API_URL", "https://api.github.com"),
        token=env.get("GH_TOKEN", ""),
        opener=opener,
    )

    return handle_response(status, body, fail_on_error)


if __name__ == "__main__":
    sys.exit(main())
