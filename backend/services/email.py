"""Email sending service using per-product SMTP settings."""

import re
import json
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


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

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{sender_name} <{sender_email}>" if sender_name else sender_email
        msg["To"] = f"{to_name} <{to_email}>" if to_name else to_email
        if reply_to:
            msg["Reply-To"] = reply_to

        msg.attach(MIMEText(body, "plain", "utf-8"))

        if use_tls:
            server = smtplib.SMTP(host, port, timeout=15)
            server.ehlo()
            server.starttls()
        else:
            server = smtplib.SMTP(host, port, timeout=15)

        server.login(user, password)
        server.send_message(msg)
        server.quit()

        logger.info(f"Email sent to {to_email}")
        return {"success": True, "error": ""}
    except Exception as e:
        logger.error(f"Email send failed to {to_email}: {e}")
        return {"success": False, "error": str(e)}
