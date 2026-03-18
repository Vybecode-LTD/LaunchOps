"""URL scraping service for press kit generation and SEO analysis."""

import re
import httpx
from html.parser import HTMLParser


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
        self.in_script = False
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

        elif tag in ("h1", "h2", "h3") and self._in_heading:
            self._in_heading = False
            if self._heading_text.strip():
                self.headings.append(self._heading_text.strip())

    def handle_data(self, data: str):
        if self.in_title:
            self.title_text += data
        if self.in_body and not self.in_script:
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


async def scrape_url(url: str) -> dict:
    """Scrape a URL and extract metadata + body content.

    Returns:
        dict with keys: metadata, body_text, headings, json_ld, status
    """
    try:
        async with httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (compatible; VybeCodeBot/1.0; "
                    "+https://vybecod.ing)"
                )
            },
        ) as client:
            response = await client.get(url)
            response.raise_for_status()

        parser = MetadataParser()
        parser.feed(response.text)

        return {
            "status": "ok",
            "url": str(response.url),
            "status_code": response.status_code,
            "metadata": parser.metadata,
            "body_text": parser.get_body_text(),
            "headings": parser.headings[:20],
            "json_ld": parser.json_ld,
            "content_length": len(response.text),
        }

    except httpx.HTTPStatusError as e:
        return {
            "status": "error",
            "error": f"HTTP {e.response.status_code}",
            "url": url,
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "url": url,
        }
