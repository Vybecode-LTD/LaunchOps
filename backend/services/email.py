"""Email sending service using per-product SMTP settings."""

import logging
import re
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

logger = logging.getLogger(__name__)

EMAIL_ADDRESS = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
LINE_BREAKS = re.compile(r"\s*[\r\n]+\s*")


def _header_text(value: str) -> str:
    """A header value on one line: a line break (from AI output or an edit) must not start a new header."""
    return LINE_BREAKS.sub(" ", value).strip()


def extract_contacts_from_content(content: dict) -> list[dict]:
    """Extract email addresses and contact info from workflow result content.

    Returns list of {name, email, context} dicts.
    """
    contacts = []
    seen_emails = set()
    email_pattern = re.compile(r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})')

    def scan_value(val, context=""):
        if isinstance(val, str):
            for match in email_pattern.finditer(val):
                email = match.group(1).lower()
                if email not in seen_emails:
                    seen_emails.add(email)
                    # Try to find a name near the email
                    name = ""
                    idx = val.find(match.group(0))
                    before = val[max(0, idx - 80):idx].strip()
                    # Look for "Name:" or "Contact:" pattern
                    name_match = re.search(r'(?:name|contact|from|by)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)', before, re.IGNORECASE)
                    if name_match:
                        name = name_match.group(1)
                    contacts.append({"name": name, "email": email, "context": context})
        elif isinstance(val, list):
            for item in val:
                if isinstance(item, dict):
                    # Check for structured contact objects
                    item_email = item.get("email") or item.get("contact_email") or ""
                    if not item_email:
                        # Scan all string values
                        for v in item.values():
                            scan_value(v, item.get("name", context))
                    else:
                        for em in email_pattern.findall(item_email):
                            if em.lower() not in seen_emails:
                                seen_emails.add(em.lower())
                                contacts.append({
                                    "name": item.get("name", item.get("contact_name", "")),
                                    "email": em.lower(),
                                    "context": item.get("type", context),
                                })
                elif isinstance(item, str):
                    scan_value(item, context)
        elif isinstance(val, dict):
            for k, v in val.items():
                scan_value(v, k)

    if isinstance(content, dict):
        for key, val in content.items():
            scan_value(val, key)

    return contacts


def send_email(smtp_settings: dict, to_email: str, to_name: str,
               subject: str, body: str, from_name: str = "", from_email: str = "") -> dict:
    """Send an email using SMTP settings.

    Returns {success: bool, error: str}.
    """
    host = smtp_settings.get("smtp_host", "")
    port = int(smtp_settings.get("smtp_port", 587))
    user = smtp_settings.get("smtp_user", "")
    password = smtp_settings.get("smtp_password", "")
    use_tls = smtp_settings.get("use_tls", True)
    sender_name = from_name or smtp_settings.get("from_name", "")
    sender_email = from_email or smtp_settings.get("from_email", user)
    reply_to = smtp_settings.get("reply_to", "")

    if not host or not user or not password:
        return {"success": False, "error": "SMTP not configured for this product"}
    recipient = to_email.strip()
    if not EMAIL_ADDRESS.fullmatch(recipient):
        return {"success": False, "error": f"The recipient address isn't a single valid email address: {to_email!r}"}

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = _header_text(subject)
        msg["From"] = formataddr((_header_text(sender_name), _header_text(sender_email)))
        msg["To"] = formataddr((_header_text(to_name), recipient))
        if reply_to:
            msg["Reply-To"] = _header_text(reply_to)

        msg.attach(MIMEText(body, "plain", "utf-8"))

        with smtplib.SMTP(host, port, timeout=15) as server:
            if use_tls:
                server.ehlo()
                # Verify the server's certificate: smtplib's default context doesn't, which would let anyone
                # on the network path pose as the server and read the password.
                server.starttls(context=ssl.create_default_context())
            server.login(user, password)
            # Only the draft's recipient, whatever the headers say
            server.send_message(msg, from_addr=_header_text(sender_email), to_addrs=[recipient])

        logger.info("Email sent to %s", recipient)
        return {"success": True, "error": ""}
    except (smtplib.SMTPException, OSError, ValueError) as e:
        logger.warning("Email send failed to %s: %s", to_email, e)
        return {"success": False, "error": str(e)}
