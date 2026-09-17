"""services/mailer.py: email LaunchOps sends itself, through the MAIL_* settings."""

import logging

import pytest

import config
from services import mailer

MAIL_SETTINGS = {
    "app_url": "https://launchops.example/",
    "mail_smtp_host": "smtp.launchops.example",
    "mail_smtp_port": 2525,
    "mail_smtp_user": "mailer",
    "mail_smtp_password": "mail-secret",
    "mail_from_email": "no-reply@launchops.example",
    "mail_from_name": "LaunchOps",
    "mail_use_tls": True,
}


@pytest.fixture
def mail_settings(monkeypatch):
    settings = config.get_settings()
    for name, value in MAIL_SETTINGS.items():
        monkeypatch.setattr(settings, name, value)
    return settings


@pytest.fixture
def smtp(monkeypatch):
    calls = []

    def fake_send_email(smtp_settings, to_email, to_name, subject, body):
        calls.append({"settings": smtp_settings, "to": to_email, "subject": subject, "body": body})
        return fake_send_email.result

    fake_send_email.result = {"success": True, "error": ""}
    monkeypatch.setattr(mailer, "send_email", fake_send_email)
    fake_send_email.calls = calls
    return fake_send_email


async def test_sends_through_the_platform_mail_server(mail_settings, smtp):
    assert await mailer.send("ana@example.com", "Reset your LaunchOps password", "Body") is True

    [call] = smtp.calls
    assert call["settings"] == {
        "smtp_host": "smtp.launchops.example", "smtp_port": 2525, "smtp_user": "mailer", "smtp_password": "mail-secret",
        "from_name": "LaunchOps", "from_email": "no-reply@launchops.example", "use_tls": True,
    }
    assert (call["to"], call["subject"], call["body"]) == ("ana@example.com", "Reset your LaunchOps password", "Body")


async def test_a_failed_send_is_logged_and_reported(mail_settings, smtp, caplog):
    smtp.result = {"success": False, "error": "Connection refused"}

    assert await mailer.send("ana@example.com", "Subject", "Body") is False

    assert "LaunchOps couldn't email ana@example.com: Connection refused" in caplog.text


@pytest.mark.parametrize("missing", ["app_url", "mail_smtp_host", "mail_smtp_user", "mail_smtp_password", "mail_from_email"])
async def test_nothing_is_sent_without_complete_settings(mail_settings, smtp, monkeypatch, missing):
    monkeypatch.setattr(mail_settings, missing, "")

    assert mailer.configured() is False
    assert await mailer.send("ana@example.com", "Subject", "Body") is False
    assert smtp.calls == []


def test_links_in_emails_are_absolute(mail_settings):
    assert mailer.link("/reset-password/abc") == "https://launchops.example/reset-password/abc"


async def test_the_real_smtp_client_is_never_reached_in_tests(mail_settings, caplog):
    caplog.set_level(logging.WARNING)
    with pytest.raises(AssertionError, match="tried to use the network"):
        await mailer.send("ana@example.com", "Subject", "Body")
