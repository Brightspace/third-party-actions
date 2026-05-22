import base64
import gzip
import io
import json
import shutil
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from tempfile import mkdtemp
from urllib.error import HTTPError, URLError
from unittest import mock

import upload_coverage


class FakeResponse:
    def __init__(self, status=201, body=b""):
        self.status = status
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self):
        return self.body

    def getcode(self):
        return self.status


class UploadCoverageTests(unittest.TestCase):
    def setUp(self):
        self.test_dir = Path(mkdtemp(dir=Path(__file__).parent))
        self.coverage_file = self.test_dir / "coverage.xml"
        self.coverage_contents = b"<coverage branch-rate=\"0.5\" />\n"
        self.coverage_file.write_bytes(self.coverage_contents)
        self.base_env = {
            "INPUT_FILE": str(self.coverage_file),
            "INPUT_LANGUAGE": "Python",
            "INPUT_LABEL": "code-coverage/test",
            "COMMIT_OID": "deadbeef",
            "REF": "refs/heads/main",
            "PR_NUMBER": "",
            "GITHUB_REPOSITORY": "octo-org/octo-repo",
            "GITHUB_API_URL": "https://api.github.com",
            "GH_TOKEN": "test-token",
        }

    def tearDown(self):
        shutil.rmtree(self.test_dir)

    def run_main(self, env=None, opener=None):
        stdout = io.StringIO()
        opener = opener or mock.Mock(return_value=FakeResponse())
        with redirect_stdout(stdout):
            exit_code = upload_coverage.main(environ=env or self.base_env, opener=opener)
        return exit_code, stdout.getvalue(), opener

    def request_payload(self, opener):
        request = opener.call_args.args[0]
        return json.loads(request.data.decode("utf-8"))

    def test_file_not_found_exits_with_error_annotation(self):
        env = dict(self.base_env, INPUT_FILE=str(self.test_dir / "missing.xml"))

        exit_code, output, opener = self.run_main(env=env)

        self.assertEqual(1, exit_code)
        self.assertIn("::error::Coverage file not found", output)
        opener.assert_not_called()

    def test_successful_upload_exits_zero(self):
        exit_code, output, opener = self.run_main()

        self.assertEqual(0, exit_code)
        self.assertEqual("", output)
        opener.assert_called_once()

    def test_successful_with_pr_number_uses_pull_request_number(self):
        env = dict(self.base_env, REF="", PR_NUMBER="42")
        exit_code, _, opener = self.run_main(env=env)

        payload = self.request_payload(opener)
        self.assertEqual(0, exit_code)
        self.assertEqual(42, payload["pull_request_number"])
        self.assertNotIn("ref", payload)

    def test_successful_with_ref_uses_ref_and_omits_pull_request_number(self):
        exit_code, _, opener = self.run_main()

        payload = self.request_payload(opener)
        self.assertEqual("refs/heads/main", payload["ref"])
        self.assertNotIn("pull_request_number", payload)

    def test_403_not_authorized_exits_with_permissions_error(self):
        error = HTTPError(
            url="https://api.github.com/repos/octo-org/octo-repo/code-coverage/report",
            code=403,
            msg="Forbidden",
            hdrs=None,
            fp=io.BytesIO(b'{"message":"not authorized"}'),
        )

        exit_code, output, _ = self.run_main(opener=mock.Mock(side_effect=error))

        self.assertEqual(1, exit_code)
        self.assertIn("code-quality: write", output)

    def test_403_other_message_exits_with_generic_error(self):
        error = HTTPError(
            url="https://api.github.com/repos/octo-org/octo-repo/code-coverage/report",
            code=403,
            msg="Forbidden",
            hdrs=None,
            fp=io.BytesIO(b'{"message":"forbidden"}'),
        )

        exit_code, output, _ = self.run_main(opener=mock.Mock(side_effect=error))

        self.assertEqual(1, exit_code)
        self.assertIn("Coverage upload failed with status 403", output)
        self.assertIn('forbidden', output)

    def test_400_bad_request_exits_with_status_and_body(self):
        error = HTTPError(
            url="https://api.github.com/repos/octo-org/octo-repo/code-coverage/report",
            code=400,
            msg="Bad Request",
            hdrs=None,
            fp=io.BytesIO(b'{"message":"bad request"}'),
        )

        exit_code, output, _ = self.run_main(opener=mock.Mock(side_effect=error))

        self.assertEqual(1, exit_code)
        self.assertIn("status 400", output)
        self.assertIn("bad request", output)

    def test_500_server_error_exits_with_status_and_body(self):
        error = HTTPError(
            url="https://api.github.com/repos/octo-org/octo-repo/code-coverage/report",
            code=500,
            msg="Server Error",
            hdrs=None,
            fp=io.BytesIO(b'{"message":"boom"}'),
        )

        exit_code, output, _ = self.run_main(opener=mock.Mock(side_effect=error))

        self.assertEqual(1, exit_code)
        self.assertIn("status 500", output)
        self.assertIn("boom", output)

    def test_network_error_exits_with_error(self):
        exit_code, output, _ = self.run_main(opener=mock.Mock(side_effect=URLError("connection refused")))

        self.assertEqual(1, exit_code)
        self.assertIn("connection refused", output)

    def test_payload_structure_and_encoding(self):
        exit_code, _, opener = self.run_main()

        request = opener.call_args.args[0]
        payload = self.request_payload(opener)
        decoded = gzip.decompress(base64.b64decode(payload["coverage_report"]))

        self.assertEqual(0, exit_code)
        self.assertEqual("PUT", request.get_method())
        self.assertEqual("Bearer test-token", request.headers["Authorization"])
        self.assertEqual("deadbeef", payload["commit_oid"])
        self.assertEqual("Python", payload["language_name"])
        self.assertEqual("code-coverage/test", payload["label"])
        self.assertEqual(self.coverage_contents, decoded)

    def test_neither_ref_nor_pr_number_exits_with_error(self):
        env = dict(self.base_env, REF="", PR_NUMBER="")

        exit_code, output, opener = self.run_main(env=env)

        self.assertEqual(1, exit_code)
        self.assertIn("::error::", output)
        self.assertIn("Either PR_NUMBER or REF must be provided", output)
        opener.assert_not_called()


if __name__ == "__main__":
    unittest.main()
