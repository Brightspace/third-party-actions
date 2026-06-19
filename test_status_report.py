import io
import json
import unittest
from contextlib import redirect_stdout
from unittest import mock
from urllib.error import URLError

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


class BuildStartingReportTests(unittest.TestCase):
    def test_includes_status_and_started_at(self):
        report = status_report.build_starting_report(env={})
        self.assertEqual("starting", report["status"])
        self.assertIn("started_at", report)

    def test_captures_action_metadata(self):
        env = {"GITHUB_ACTION_REF": "v1", "ACTION_VERSION": "1.0.0"}
        report = status_report.build_starting_report(env=env)
        self.assertEqual("upload-code-coverage", report["action_name"])
        self.assertEqual("v1", report["action_ref"])
        self.assertEqual("1.0.0", report["action_version"])

    def test_captures_runner_info(self):
        env = {"RUNNER_OS": "Linux", "RUNNER_ARCH": "X64", "ImageVersion": "20240101.1"}
        report = status_report.build_starting_report(env=env)
        self.assertEqual("Linux", report["runner_os"])
        self.assertEqual("X64", report["runner_arch"])
        self.assertEqual("20240101.1", report["runner_image_version"])

    def test_captures_workflow_context(self):
        env = {
            "GITHUB_WORKFLOW": "CI",
            "GITHUB_JOB": "test",
            "GITHUB_EVENT_NAME": "push",
            "GITHUB_RUN_ID": "12345",
            "GITHUB_RUN_ATTEMPT": "1",
        }
        report = status_report.build_starting_report(env=env)
        self.assertEqual("CI", report["workflow_name"])
        self.assertEqual("test", report["job_name"])
        self.assertEqual("push", report["actions_event_name"])
        self.assertEqual(12345, report["workflow_run_id"])
        self.assertEqual(1, report["workflow_run_attempt"])

    def test_captures_git_context(self):
        env = {"COMMIT_OID": "abc123", "REF": "refs/heads/main"}
        report = status_report.build_starting_report(env=env)
        self.assertEqual("abc123", report["commit_oid"])
        self.assertEqual("refs/heads/main", report["ref"])

    def test_captures_user_parameters(self):
        env = {
            "INPUT_LANGUAGE": "Python",
            "INPUT_LABEL": "code-coverage/test",
            "FAIL_ON_ERROR": "true",
        }
        report = status_report.build_starting_report(env=env)
        self.assertEqual("Python", report["parameters"]["language_name"])
        self.assertEqual("code-coverage/test", report["parameters"]["label"])
        self.assertTrue(report["parameters"]["fail_on_error"])

    def test_omits_empty_fields(self):
        report = status_report.build_starting_report(env={})
        self.assertNotIn("runner_os", report)
        self.assertNotIn("commit_oid", report)
        self.assertNotIn("ref", report)
        self.assertNotIn("parameters", report)


class BuildCompletedReportTests(unittest.TestCase):
    def setUp(self):
        self.starting = status_report.build_starting_report(env={
            "RUNNER_OS": "Linux",
            "INPUT_LANGUAGE": "Go",
        })

    def test_inherits_starting_fields(self):
        completed = status_report.build_completed_report(self.starting, status="success")
        self.assertEqual("Linux", completed["runner_os"])
        self.assertEqual("Go", completed["parameters"]["language_name"])

    def test_sets_status_and_completed_at(self):
        completed = status_report.build_completed_report(self.starting, status="failure")
        self.assertEqual("failure", completed["status"])
        self.assertIn("completed_at", completed)

    def test_includes_timing_and_size(self):
        completed = status_report.build_completed_report(
            self.starting, status="success",
            upload_duration_ms=1234, payload_size_bytes=5678,
        )
        self.assertEqual(1234, completed["upload_duration_ms"])
        self.assertEqual(5678, completed["payload_size_bytes"])

    def test_includes_error_info(self):
        completed = status_report.build_completed_report(
            self.starting, status="failure",
            error_type="http_500", error_message="Internal Server Error",
        )
        self.assertEqual("http_500", completed["error_type"])
        self.assertEqual("Internal Server Error", completed["error_message"])

    def test_truncates_long_error_message(self):
        long_msg = "x" * 2000
        completed = status_report.build_completed_report(
            self.starting, status="failure", error_message=long_msg,
        )
        self.assertEqual(1000, len(completed["error_message"]))

    def test_does_not_mutate_starting_report(self):
        original_status = self.starting["status"]
        status_report.build_completed_report(self.starting, status="success")
        self.assertEqual(original_status, self.starting["status"])


class SendStatusReportTests(unittest.TestCase):
    def test_sends_put_request_with_correct_url_and_headers(self):
        opener = mock.Mock(return_value=FakeResponse())
        report = {"status": "starting"}

        result = status_report.send_status_report(
            report, repository="octo/repo",
            api_url="https://api.github.com", token="tok123",
            opener=opener,
        )

        self.assertTrue(result)
        opener.assert_called_once()
        request = opener.call_args.args[0]
        self.assertEqual(
            "https://api.github.com/repos/octo/repo/code-coverage/action/status",
            request.full_url,
        )
        self.assertEqual("PUT", request.get_method())
        self.assertEqual("Bearer tok123", request.headers["Authorization"])
        self.assertEqual("application/json", request.headers["Content-type"])

    def test_sends_report_as_json_body(self):
        opener = mock.Mock(return_value=FakeResponse())
        report = {"status": "success", "upload_duration_ms": 100}

        status_report.send_status_report(
            report, repository="o/r", api_url="https://api.github.com",
            token="t", opener=opener,
        )

        request = opener.call_args.args[0]
        sent_data = json.loads(request.data.decode("utf-8"))
        self.assertEqual("success", sent_data["status"])
        self.assertEqual(100, sent_data["upload_duration_ms"])

    def test_returns_false_on_http_error(self):
        opener = mock.Mock(side_effect=URLError("connection refused"))
        stdout = io.StringIO()

        with redirect_stdout(stdout):
            result = status_report.send_status_report(
                {"status": "starting"}, repository="o/r",
                api_url="https://api.github.com", token="t", opener=opener,
            )

        self.assertFalse(result)
        self.assertIn("::warning::", stdout.getvalue())

    def test_returns_false_on_generic_exception(self):
        opener = mock.Mock(side_effect=Exception("boom"))
        stdout = io.StringIO()

        with redirect_stdout(stdout):
            result = status_report.send_status_report(
                {"status": "starting"}, repository="o/r",
                api_url="https://api.github.com", token="t", opener=opener,
            )

        self.assertFalse(result)

    def test_returns_false_on_non_2xx_response(self):
        opener = mock.Mock(return_value=FakeResponse(status=403))
        stdout = io.StringIO()

        with redirect_stdout(stdout):
            result = status_report.send_status_report(
                {"status": "starting"}, repository="o/r",
                api_url="https://api.github.com", token="t", opener=opener,
            )

        self.assertFalse(result)
        self.assertIn("::warning::", stdout.getvalue())
        self.assertIn("HTTP 403", stdout.getvalue())

    def test_passes_timeout(self):
        opener = mock.Mock(return_value=FakeResponse())

        status_report.send_status_report(
            {"status": "starting"}, repository="o/r",
            api_url="https://api.github.com", token="t", opener=opener,
        )

        _, kwargs = opener.call_args
        self.assertEqual(30, kwargs["timeout"])


class SaveAndGetStateTests(unittest.TestCase):
    def test_save_state_writes_to_github_state_file(self):
        m = mock.mock_open()
        with mock.patch.dict(os.environ, {"GITHUB_STATE": "/tmp/state"}):
            with mock.patch("builtins.open", m):
                status_report.save_state("my_key", "my_value")
        m.assert_called_once_with("/tmp/state", "a")
        written = "".join(call.args[0] for call in m().write.call_args_list)
        self.assertIn("my_key", written)
        self.assertIn("my_value", written)

    def test_save_state_no_op_without_github_state(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            status_report.save_state("k", "v")  # should not raise

    def test_get_state_reads_from_env(self):
        with mock.patch.dict(os.environ, {"STATE_foo": "bar"}):
            self.assertEqual("bar", status_report.get_state("foo"))

    def test_get_state_returns_empty_when_missing(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertEqual("", status_report.get_state("missing"))


import os

if __name__ == "__main__":
    unittest.main()
