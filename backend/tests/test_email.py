"""services/email.py: sending through a project's SMTP server, and finding contacts in AI results.

smtplib is replaced by a recording fake, so nothing connects to a mail server.
"""

import smtplib
import ssl
from email.utils import getaddresses

import pytest

from services import email as email_service
from services.email import extract_contacts_from_content, send_email

SMTP_SETTINGS = {
    "smtp_host": "smtp.launchops.example",
    "smtp_port": 587,
    "smtp_user": "launch@launchops.example",
    "smtp_password": "s3cret-pass",
    "from_name": "Launch Ops",
    "use_tls": True,
}


class FakeSMTP:
    """Records what send_email does with the connection."""

    def __init__(self, host, port, timeout=None):
        self.host, self.port, self.timeout = host, port, timeout
        self.steps = []
        self.closed = False
        self.sent = None
        self.fail_on = None

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.closed = True
        return False

    def _step(self, name, *args):
        self.steps.append((name, *args))
        if self.fail_on == name:
            raise smtplib.SMTPAuthenticationError(535, b"Authentication failed")

    def ehlo(self):
        self._step("ehlo")

    def starttls(self, *, context=None):
        self._step("starttls", context)

    def login(self, user, password):
        self._step("login", user, password)

    def send_message(self, msg, from_addr=None, to_addrs=None):
        self._step("send_message")
        self.sent = {"message": msg, "from_addr": from_addr, "to_addrs": to_addrs}

    def quit(self):
        self.closed = True


@pytest.fixture
def smtp(monkeypatch):
    """The FakeSMTP connections send_email opens, in order."""
    connections = []

    def connect(host, port, timeout=None):
        connection = FakeSMTP(host, port, timeout)
        connection.fail_on = getattr(connect, "fail_on", None)
        connections.append(connection)
        return connection

    monkeypatch.setattr(email_service.smtplib, "SMTP", connect)
    connect.connections = connections
    return connect


def test_sends_through_starttls_with_the_server_certificate_verified(smtp):
    result = send_email(SMTP_SETTINGS, "jane@example.com", "Jane Doe", "Launch day", "Hi Jane")

    assert result == {"success": True, "error": ""}
    [connection] = smtp.connections
    assert (connection.host, connection.port) == ("smtp.launchops.example", 587)
    steps = [step[0] for step in connection.steps]
    assert steps == ["ehlo", "starttls", "login", "send_message"]
    context = connection.steps[1][1]
    # Without a verifying context, anyone on the network path could impersonate the server and read the password
    assert isinstance(context, ssl.SSLContext)
    assert context.verify_mode == ssl.CERT_REQUIRED
    assert context.check_hostname is True
    assert connection.steps[2] == ("login", "launch@launchops.example", "s3cret-pass")
    assert connection.closed


def test_the_message_goes_only_to_the_draft_recipient(smtp):
    send_email({**SMTP_SETTINGS, "reply_to": "press@launchops.example"}, "jane@example.com", "Jane Doe", "Launch day", "Hi Jane")

    sent = smtp.connections[0].sent
    assert sent["to_addrs"] == ["jane@example.com"]
    assert sent["from_addr"] == "launch@launchops.example"
    message = sent["message"]
    assert message["To"] == "Jane Doe <jane@example.com>"
    assert message["From"] == "Launch Ops <launch@launchops.example>"
    assert message["Reply-To"] == "press@launchops.example"
    assert message["Subject"] == "Launch day"


def test_line_breaks_in_headers_cannot_add_recipients_or_break_the_send(smtp):
    result = send_email(SMTP_SETTINGS, "jane@example.com", "Jane\nBcc: boss@example.com", "Launch day\r\nBcc: boss@example.com", "Hi")

    assert result == {"success": True, "error": ""}
    sent = smtp.connections[0].sent
    assert sent["to_addrs"] == ["jane@example.com"]
    message = sent["message"]
    assert message["Bcc"] is None
    assert message["Subject"] == "Launch day Bcc: boss@example.com"
    assert getaddresses([message["To"]]) == [("Jane Bcc: boss@example.com", "jane@example.com")]


def test_a_subject_with_a_line_break_is_sent_on_one_line(smtp):
    result = send_email(SMTP_SETTINGS, "jane@example.com", "", "Launch day\nis here", "Hi")

    assert result == {"success": True, "error": ""}
    assert smtp.connections[0].sent["message"]["Subject"] == "Launch day is here"


@pytest.mark.parametrize("address", ["jane@example.com, boss@example.com", "not an address", "jane@", ""])
def test_an_invalid_recipient_address_is_not_sent(smtp, address):
    result = send_email(SMTP_SETTINGS, address, "Jane", "Launch day", "Hi")

    assert result == {"success": False, "error": f"The recipient address isn't a single valid email address: {address!r}"}
    assert smtp.connections == []


def test_the_connection_is_closed_when_sending_fails(smtp):
    smtp.fail_on = "login"

    result = send_email(SMTP_SETTINGS, "jane@example.com", "Jane", "Launch day", "Hi")

    assert result["success"] is False
    assert "Authentication failed" in result["error"]
    assert smtp.connections[0].closed


def test_starttls_can_be_switched_off(smtp):
    send_email({**SMTP_SETTINGS, "use_tls": False}, "jane@example.com", "", "Launch day", "Hi")

    assert [step[0] for step in smtp.connections[0].steps] == ["login", "send_message"]
    assert smtp.connections[0].sent["message"]["To"] == "jane@example.com"


@pytest.mark.parametrize("missing", ["smtp_host", "smtp_user", "smtp_password"])
def test_incomplete_smtp_settings_are_reported(smtp, missing):
    result = send_email({**SMTP_SETTINGS, missing: ""}, "jane@example.com", "Jane", "Launch day", "Hi")

    assert result == {"success": False, "error": "SMTP not configured for this product"}
    assert smtp.connections == []


def test_an_unreachable_server_is_reported(monkeypatch):
    def refuse(host, port, timeout=None):
        raise ConnectionRefusedError("Connection refused")

    monkeypatch.setattr(email_service.smtplib, "SMTP", refuse)

    result = send_email(SMTP_SETTINGS, "jane@example.com", "Jane", "Launch day", "Hi")

    assert result == {"success": False, "error": "Connection refused"}


# ─── Contacts in AI results ───


def test_contacts_come_from_structured_entries_and_free_text():
    content = {
        "partnerships": [
            {"name": "Acme Audio", "type": "integration", "contact_email": "Partners@Acme.example"},
            {"name": "Synth Weekly", "notes": "Pitch the editor at tips@synth.example"},
            "Also try hello@plugins.example",
        ],
        "summary": {"press": "Contact: Jane Doe jane@press.example"},
        "duplicate": "partners@acme.example",
    }

    assert extract_contacts_from_content(content) == [
        {"name": "Acme Audio", "email": "partners@acme.example", "context": "integration"},
        {"name": "", "email": "tips@synth.example", "context": "Synth Weekly"},
        {"name": "", "email": "hello@plugins.example", "context": "partnerships"},
        {"name": "Jane Doe", "email": "jane@press.example", "context": "press"},
    ]


def test_content_that_is_not_an_object_has_no_contacts():
    assert extract_contacts_from_content(["someone@example.com"]) == []
