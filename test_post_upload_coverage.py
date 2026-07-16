import json
import unittest
from unittest import mock

import post_upload_coverage
import status_report


class FakeResponse:
    def __init__(self, status=200, body=b""):
        self.status = status
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def read(self):
        return self.body

    def getcode(self):
        return self.status


class PostUploadCoverageTests(unittest.TestCase):
    def setUp(self):
        self.base_env = {
            "GITHUB_REPOSITORY": "octo-org/octo-repo",
            "GITHUB_API_URL": "https://api.github.com",
            "GH_TOKEN": "test-token",
            "INPUT_LANGUAGE": "Python",
            "INPUT_LABEL": "code-coverage/test",
        }

    def test_noop_when_status_already_sent(self):
        """Post step exits immediately if main step reported completion."""
        with mock.patch.dict("os.environ", {**self.base_env, "_COVERAGE_TELEMETRY_STATUS_SENT": "true"}):
            with mock.patch.object(status_report, "send_status_report") as send:
                exit_code = post_upload_coverage.main()

        self.assertEqual(0, exit_code)
        send.assert_not_called()

    def test_retries_completed_report_when_saved(self):
        """If completed_report was saved but not sent, retry sending it."""
        completed = {"status": "failure", "error_type": "http_500"}
        env = {
            **self.base_env,
            "_COVERAGE_TELEMETRY_STATUS_SENT": "",
            "_COVERAGE_TELEMETRY_COMPLETED_REPORT": json.dumps(completed),
            "_COVERAGE_TELEMETRY_STARTING_REPORT": json.dumps({"status": "starting"}),
        }
        with mock.patch.dict("os.environ", env, clear=True):
            with mock.patch.object(status_report, "send_status_report", return_value=True) as send:
                exit_code = post_upload_coverage.main()

        self.assertEqual(0, exit_code)
        send.assert_called_once()
        sent_report = send.call_args.args[0]
        self.assertEqual("failure", sent_report["status"])
        self.assertEqual("http_500", sent_report["error_type"])

    def test_sends_aborted_from_starting_report_state(self):
        """If only starting_report was saved, send an aborted report."""
        starting = {"status": "starting", "started_at": "2024-01-01T00:00:00+00:00", "runner_os": "Linux"}
        env = {
            **self.base_env,
            "_COVERAGE_TELEMETRY_STATUS_SENT": "",
            "_COVERAGE_TELEMETRY_COMPLETED_REPORT": "",
            "_COVERAGE_TELEMETRY_STARTING_REPORT": json.dumps(starting),
        }
        with mock.patch.dict("os.environ", env, clear=True):
            with mock.patch.object(status_report, "send_status_report", return_value=True) as send:
                exit_code = post_upload_coverage.main()

        self.assertEqual(0, exit_code)
        send.assert_called_once()
        sent_report = send.call_args.args[0]
        self.assertEqual("aborted", sent_report["status"])
        self.assertIn("completed_at", sent_report)
        self.assertEqual("Linux", sent_report["runner_os"])

    def test_sends_aborted_with_fresh_report_when_no_state(self):
        """If no state at all, build a fresh report and send aborted."""
        env = {
            **self.base_env,
            "_COVERAGE_TELEMETRY_STATUS_SENT": "",
            "_COVERAGE_TELEMETRY_COMPLETED_REPORT": "",
            "_COVERAGE_TELEMETRY_STARTING_REPORT": "",
        }
        with mock.patch.dict("os.environ", env, clear=True):
            with mock.patch.object(status_report, "send_status_report", return_value=True) as send:
                exit_code = post_upload_coverage.main()

        self.assertEqual(0, exit_code)
        send.assert_called_once()
        sent_report = send.call_args.args[0]
        self.assertEqual("aborted", sent_report["status"])

    def test_never_raises_on_send_failure(self):
        """Post step must not fail even if telemetry send throws."""
        env = {
            **self.base_env,
            "_COVERAGE_TELEMETRY_STATUS_SENT": "",
            "_COVERAGE_TELEMETRY_COMPLETED_REPORT": "",
            "_COVERAGE_TELEMETRY_STARTING_REPORT": "",
        }
        with mock.patch.dict("os.environ", env, clear=True):
            with mock.patch.object(status_report, "send_status_report", return_value=False):
                exit_code = post_upload_coverage.main()

        self.assertEqual(0, exit_code)


if __name__ == "__main__":
    unittest.main()
