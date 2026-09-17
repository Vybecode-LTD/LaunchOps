"""Email LaunchOps itself sends: password reset links and invitations (docs/PHASE1_DESIGN.md D8).

Configured with the MAIL_* settings and APP_URL (links in emails must be absolute). A project's own
outreach email goes through that project's SMTP settings instead (services/email.py).
"""

import asyncio
import logging

from config import get_settings
from services.email import send_email

logger = logging.getLogger(__name__)


def configured() -> bool:
    """Whether LaunchOps can send email of its own."""
    s = get_settings()
    return bool(s.mail_smtp_host and s.mail_smtp_user and s.mail_smtp_password and s.mail_from_email and s.app_url)


def link(path: str) -> str:
    """An absolute link to a page of the app, for use in an email."""
    return f"{get_settings().app_url.rstrip('/')}{path}"


async def send(to_email: str, subject: str, body: str) -> bool:
    """Send an email if a mail server is configured. Returns whether it went; failures are logged, never raised."""
    if not configured():
        return False
    return await _deliver(to_email, subject, body)


async def _deliver(to_email: str, subject: str, body: str) -> bool:
    s = get_settings()
    smtp_settings = {
        "smtp_host": s.mail_smtp_host,
        "smtp_port": s.mail_smtp_port,
        "smtp_user": s.mail_smtp_user,
        "smtp_password": s.mail_smtp_password,
        "from_name": s.mail_from_name,
        "from_email": s.mail_from_email,
        "use_tls": s.mail_use_tls,
    }
    # smtplib blocks, so it runs in a worker thread
    result = await asyncio.to_thread(send_email, smtp_settings, to_email, "", subject, body)
    if not result["success"]:
        logger.warning("LaunchOps couldn't email %s: %s", to_email, result["error"])
    return result["success"]
