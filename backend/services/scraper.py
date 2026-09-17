"""URL scraping service for press kit generation and SEO analysis."""

import asyncio
import ipaddress
import re
import socket
from html.parser import HTMLParser

import httpx


class MetadataParser(HTMLParser):
    """Extract metadata from HTML head section."""

    def __init__(self):
        super().__init__()
        self.metadata = {
            "title": "",
            "description": "",
            "og_title": "",
            "og_description": "",
            "og_image": "",
            "og_url": "",
            "canonical": "",
            "robots": "",
            "keywords": "",
            "twitter_card": "",
            "twitter_title": "",
            "twitter_description": "",
            "twitter_image": "",
        }
        self.in_title = False
        self.title_text = ""
        self.body_text_parts: list[str] = []
        self.in_body = False
        self.in_script = False  # inside a JSON-LD script
        self._in_code = False  # inside any other script or a style block: not page copy
        self.json_ld: list[str] = []
        self._current_script_type = ""
        self.headings: list[str] = []
        self._in_heading = False
        self._heading_text = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        attr_dict = {k: v for k, v in attrs if v is not None}

        if tag == "title":
            self.in_title = True
            self.title_text = ""

        elif tag == "meta":
            name = attr_dict.get("name", "").lower()
            prop = attr_dict.get("property", "").lower()
            content = attr_dict.get("content", "")

            if name == "description":
                self.metadata["description"] = content
            elif name == "keywords":
                self.metadata["keywords"] = content
            elif name == "robots":
                self.metadata["robots"] = content
            elif name == "twitter:card":
                self.metadata["twitter_card"] = content
            elif name == "twitter:title":
                self.metadata["twitter_title"] = content
            elif name == "twitter:description":
                self.metadata["twitter_description"] = content
            elif name == "twitter:image":
                self.metadata["twitter_image"] = content
            elif prop == "og:title":
                self.metadata["og_title"] = content
            elif prop == "og:description":
                self.metadata["og_description"] = content
            elif prop == "og:image":
                self.metadata["og_image"] = content
            elif prop == "og:url":
                self.metadata["og_url"] = content

        elif tag == "link":
            rel = attr_dict.get("rel", "")
            if rel == "canonical":
                self.metadata["canonical"] = attr_dict.get("href", "")

        elif tag == "body":
            self.in_body = True

        elif tag == "script":
            self._current_script_type = attr_dict.get("type", "")
            if self._current_script_type == "application/ld+json":
                self.in_script = True
            else:
                self._in_code = True

        elif tag == "style":
            self._in_code = True

        elif tag in ("h1", "h2", "h3"):
            self._in_heading = True
            self._heading_text = ""

    def handle_endtag(self, tag: str):
        if tag == "title":
            self.in_title = False
            self.metadata["title"] = self.title_text.strip()

        elif tag == "body":
            self.in_body = False

        elif tag == "script" and self.in_script:
            self.in_script = False

        elif tag in ("script", "style"):
            self._in_code = False

        elif tag in ("h1", "h2", "h3") and self._in_heading:
            self._in_heading = False
            if self._heading_text.strip():
                self.headings.append(self._heading_text.strip())

    def handle_data(self, data: str):
        if self.in_title:
            self.title_text += data
        if self.in_body and not self.in_script and not self._in_code:
            self.body_text_parts.append(data)
        if self.in_script:
            self.json_ld.append(data)
        if self._in_heading:
            self._heading_text += data

    def get_body_text(self, max_chars: int = 5000) -> str:
        """Get cleaned body text, truncated."""
        text = " ".join(self.body_text_parts)
        text = re.sub(r"\s+", " ", text).strip()
        return text[:max_chars]


# ─── Fetching (finding F-6: only public web pages) ───

USER_AGENT = "Mozilla/5.0 (compatible; VybeCodeBot/1.0; +https://vybecod.ing)"
MAX_REDIRECTS = 5
MAX_PAGE_BYTES = 2_000_000
WEB_PAGE_TYPES = ("text/html", "application/xhtml+xml")

NOT_A_WEB_ADDRESS = "Enter a web address that starts with http:// or https://."
HAS_CREDENTIALS = "Web addresses with a user name or password can't be analyzed."
PRIVATE_ADDRESS = "This address points to a private or local network, so it can't be analyzed."
UNKNOWN_WEBSITE = "We couldn't find that website. Check the address."


class RefusedUrl(ValueError):
    """An address the scraper won't fetch. The message is shown to the user."""


async def _resolve(host: str, port: int) -> list[str]:
    """Every address the host name resolves to."""
    loop = asyncio.get_running_loop()
    infos = await loop.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    return list(dict.fromkeys(info[4][0] for info in infos))


def _is_public(address: str) -> bool:
    ip = ipaddress.ip_address(address.split("%", 1)[0])  # drop an IPv6 zone id
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    return ip.is_global and not ip.is_multicast


async def _checked_address(url: httpx.URL) -> str:
    """The address to connect to for `url`, once the URL and every address its host resolves to are allowed."""
    if url.scheme not in ("http", "https") or not url.raw_host:
        raise RefusedUrl(NOT_A_WEB_ADDRESS)
    if url.userinfo:
        raise RefusedUrl(HAS_CREDENTIALS)
    host = url.raw_host.decode("ascii")
    try:
        addresses = [str(ipaddress.ip_address(host))]
    except ValueError:
        try:
            addresses = await _resolve(host, url.port or (443 if url.scheme == "https" else 80))
        except (socket.gaierror, UnicodeError) as e:
            raise RefusedUrl(UNKNOWN_WEBSITE) from e
    if not addresses:
        raise RefusedUrl(UNKNOWN_WEBSITE)
    if not all(_is_public(address) for address in addresses):
        raise RefusedUrl(PRIVATE_ADDRESS)
    return addresses[0]


def _pinned_request(client: httpx.AsyncClient, url: httpx.URL, address: str) -> httpx.Request:
    """A GET for `url` that connects to `address`, so a second DNS answer can't change where it goes.

    The Host header and the TLS server name (checked against the certificate) stay the site's name.
    """
    host = url.raw_host.decode("ascii")
    extensions = {"sni_hostname": host} if url.scheme == "https" else {}
    return client.build_request(
        "GET",
        url.copy_with(host=address),
        headers={
            "Host": url.netloc.decode("ascii"),
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
        },
        extensions=extensions,
    )


async def _read_capped(response: httpx.Response, limit: int) -> bytes:
    chunks = []
    size = 0
    async for chunk in response.aiter_bytes():
        chunks.append(chunk[: limit - size])
        size += min(len(chunk), limit - size)
        if size >= limit:
            break
    return b"".join(chunks)


def _error(message: str, url: str) -> dict:
    return {"status": "error", "error": message, "url": url}


async def scrape_url(url: str) -> dict:
    """Fetch a public web page and extract its metadata and text.

    Refuses non-web schemes, addresses with credentials, and hosts that resolve to private,
    loopback, link-local or other non-public networks — on the first request and on every
    redirect. Reads at most 2 MB.

    Returns a dict with status "ok" (url, status_code, metadata, body_text, headings, json_ld,
    content_length) or status "error" with a message fit to show the user.
    """
    try:
        current = httpx.URL(url.strip())
        async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=10.0)) as client:
            for _ in range(MAX_REDIRECTS + 1):
                address = await _checked_address(current)
                response = await client.send(_pinned_request(client, current, address), stream=True)
                try:
                    if response.is_redirect and response.headers.get("location"):
                        current = current.join(response.headers["location"])
                        continue
                    response.raise_for_status()
                    content_type = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
                    if content_type and content_type not in WEB_PAGE_TYPES:
                        return _error("This address doesn't return a web page.", url)
                    body = await _read_capped(response, MAX_PAGE_BYTES)
                    encoding = response.charset_encoding or "utf-8"
                finally:
                    await response.aclose()

                html = body.decode(encoding, errors="replace")
                parser = MetadataParser()
                parser.feed(html)
                return {
                    "status": "ok",
                    "url": str(current),
                    "status_code": response.status_code,
                    "metadata": parser.metadata,
                    "body_text": parser.get_body_text(),
                    "headings": parser.headings[:20],
                    "json_ld": parser.json_ld,
                    "content_length": len(html),
                }
            return _error("The page redirects too many times.", url)
    except RefusedUrl as e:
        return _error(str(e), url)
    except httpx.HTTPStatusError as e:
        return _error(f"HTTP {e.response.status_code}", url)
    except (httpx.HTTPError, httpx.InvalidURL, LookupError, ValueError) as e:
        return _error(str(e), url)
