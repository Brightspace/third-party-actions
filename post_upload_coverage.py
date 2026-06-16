#!/usr/bin/env python3
"""Post step for upload-code-coverage Action telemetry.

Runs after the main step (even on cancellation/failure) to ensure we
always report a final status. If the main step already sent a completion
report, this is a no-op.
"""
import os
import sys
import urllib.request

import status_report


def main() -> int:
    if status_report.get_state("status_sent") == "true":
        return 0

    env = os.environ
    repository = env.get("GITHUB_REPOSITORY", "")
    api_url = env.get("GITHUB_API_URL", "https://api.github.com")
    token = env.get("GH_TOKEN", "")

    started_at = status_report.get_state("started_at")

    report = status_report.build_starting_report()
    report["status"] = "aborted"
    report["completed_at"] = status_report._now_iso()
    if started_at:
        report["started_at"] = started_at

    status_report.send_status_report(
        report,
        repository=repository,
        api_url=api_url,
        token=token,
    )

    return 0


if __name__ == "__main__":
    sys.exit(main())
