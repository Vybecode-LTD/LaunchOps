"""services/scraper.py: page metadata extraction used by press kit, press release and SEO."""

import socket
from types import SimpleNamespace

import httpx
import pytest

from services import scraper
from services.scraper import MetadataParser, scrape_url

PAGE = """<!doctype html>
<html>
<head>
  <title>
    VybeCode DSP — Build audio plugins
  </title>
  <meta name="description" content="Design VST3 and AU plugins visually.">
  <meta name="keywords" content="audio, plugins">
  <meta name="robots" content="index, follow">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="VybeCode DSP">
  <meta name="twitter:description" content="No-code plugins">
  <meta name="twitter:image" content="https://dsp.example/card.png">
  <meta property="og:title" content="VybeCode DSP">
  <meta property="og:description" content="Plugins without code">
  <meta property="og:image" content="https://dsp.example/og.png">
  <meta property="og:url" content="https://dsp.example/">
  <meta charset="utf-8">
  <link rel="canonical" href="https://dsp.example/">
  <link rel="stylesheet" href="/app.css">
  <script type="application/ld+json">{"@type": "SoftwareApplication", "name": "VybeCode DSP"}</script>
</head>
<body>
  <h1>Build plugins   visually</h1>
  <h2></h2>
  <p>Drag DSP blocks
     onto a canvas.</p>
  <h3>Export signed builds</h3>
</body>
</html>"""


def parse(html: str) -> MetadataParser:
    parser = MetadataParser()
    parser.feed(html)
    return parser


def test_extracts_head_metadata():
    meta = parse(PAGE).metadata
    assert meta == {
        "title": "VybeCode DSP — Build audio plugins",
        "description": "Design VST3 and AU plugins visually.",
        "og_title": "VybeCode DSP",
        "og_description": "Plugins without code",
        "og_image": "https://dsp.example/og.png",
        "og_url": "https://dsp.example/",
        "canonical": "https://dsp.example/",
        "robots": "index, follow",
        "keywords": "audio, plugins",
        "twitter_card": "summary_large_image",
        "twitter_title": "VybeCode DSP",
        "twitter_description": "No-code plugins",
        "twitter_image": "https://dsp.example/card.png",
    }


def test_extracts_headings_json_ld_and_body_text():
    parser = parse(PAGE)
    assert parser.headings == ["Build plugins   visually", "Export signed builds"]
    assert parser.json_ld == ['{"@type": "SoftwareApplication", "name": "VybeCode DSP"}']
    assert parser.get_body_text() == "Build plugins visually Drag DSP blocks onto a canvas. Export signed builds"
    assert parser.get_body_text(max_chars=13) == "Build plugins"


def test_body_text_leaves_out_scripts_and_styles():
    """Inline JavaScript and CSS are not page copy; they must not reach the AI as body text."""
    parser = parse("""<html><body>
      <style>.hero { color: red; }</style>
      <p>Visible copy</p>
      <script>window.__DATA__ = {"secret": true};</script>
      <script type="module">import "./app.js";</script>
      <noscript>Enable JavaScript</noscript>
    </body></html>""")
    assert parser.get_body_text() == "Visible copy Enable JavaScript"
    assert parser.json_ld == []


@pytest.fixture
def network(monkeypatch):
    """A fake internet for scrape_url: DNS answers from `net.dns`, HTTP from `net.handler`.

    Each request is recorded with the Host header, the path, the address actually connected
    to (the URL host) and the TLS server name.
    """
    net = SimpleNamespace(dns={"dsp.example": ["93.184.216.34"]}, requests=[], handler=None)

    async def fake_resolve(host, port):
        if host not in net.dns:
            raise socket.gaierror(socket.EAI_NONAME, "Name or service not known")
        return net.dns[host]

    def record(request: httpx.Request) -> httpx.Response:
        net.requests.append(SimpleNamespace(
            host=request.headers.get("host"),
            path=request.url.path,
            address=request.url.host,
            sni=request.extensions.get("sni_hostname"),
            user_agent=request.headers.get("user-agent", ""),
        ))
        return net.handler(request)

    real_client = httpx.AsyncClient
    monkeypatch.setattr(scraper, "_resolve", fake_resolve)
    monkeypatch.setattr(scraper.httpx, "AsyncClient", lambda **kwargs: real_client(transport=httpx.MockTransport(record), **kwargs))
    return net


async def test_scrape_url_follows_redirects_and_returns_page_data(network):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/old":
            return httpx.Response(301, headers={"location": "https://dsp.example/"})
        return httpx.Response(200, html=PAGE)

    network.handler = handler
    result = await scrape_url("https://dsp.example/old")

    assert result["status"] == "ok"
    assert result["url"] == "https://dsp.example/"
    assert result["status_code"] == 200
    assert result["metadata"]["title"] == "VybeCode DSP — Build audio plugins"
    assert result["headings"] == ["Build plugins   visually", "Export signed builds"]
    assert result["json_ld"] == ['{"@type": "SoftwareApplication", "name": "VybeCode DSP"}']
    assert result["body_text"].startswith("Build plugins visually")
    assert result["content_length"] == len(PAGE)
    assert [(r.host, r.path) for r in network.requests] == [("dsp.example", "/old"), ("dsp.example", "/")]
    assert all("VybeCodeBot" in r.user_agent for r in network.requests)


async def test_scrape_url_connects_to_the_address_it_checked(network):
    """Pinning the checked address means a second DNS answer (rebinding) can't redirect the request."""
    network.handler = lambda request: httpx.Response(200, html=PAGE)
    await scrape_url("https://dsp.example/")
    [request] = network.requests
    assert request.address == "93.184.216.34"
    assert request.host == "dsp.example"
    assert request.sni == "dsp.example"


async def test_scrape_url_caps_headings_at_twenty(network):
    many = "<html><body>" + "".join(f"<h2>Heading {i}</h2>" for i in range(30)) + "</body></html>"
    network.handler = lambda request: httpx.Response(200, html=many)
    result = await scrape_url("https://dsp.example/")
    assert result["headings"] == [f"Heading {i}" for i in range(20)]


async def test_scrape_url_reports_http_errors(network):
    network.handler = lambda request: httpx.Response(404, text="missing")
    assert await scrape_url("https://dsp.example/gone") == {
        "status": "error",
        "error": "HTTP 404",
        "url": "https://dsp.example/gone",
    }


async def test_scrape_url_reports_connection_failures(network):
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Connection refused", request=request)

    network.handler = handler
    result = await scrape_url("https://dsp.example/")
    assert result == {"status": "error", "error": "Connection refused", "url": "https://dsp.example/"}


async def test_scrape_url_reports_unknown_websites(network):
    network.handler = lambda request: httpx.Response(200, html=PAGE)
    result = await scrape_url("https://no-such-site.example/")
    assert result == {"status": "error", "error": "We couldn't find that website. Check the address.", "url": "https://no-such-site.example/"}
    assert network.requests == []


# ─── F-6: only public web pages are fetched ───

PRIVATE = "This address points to a private or local network, so it can't be analyzed."
NOT_WEB = "Enter a web address that starts with http:// or https://."


@pytest.mark.parametrize(
    ("url", "dns", "error"),
    [
        ("file:///etc/passwd", {}, NOT_WEB),
        ("ftp://dsp.example/", {}, NOT_WEB),
        ("javascript:alert(1)", {}, NOT_WEB),
        ("http://user:secret@dsp.example/", {}, "Web addresses with a user name or password can't be analyzed."),
        ("http://127.0.0.1:8000/", {}, PRIVATE),
        ("http://localhost/", {"localhost": ["127.0.0.1", "::1"]}, PRIVATE),
        ("http://169.254.169.254/latest/meta-data/", {}, PRIVATE),
        ("http://metadata.google.internal/", {"metadata.google.internal": ["169.254.169.254"]}, PRIVATE),
        ("http://10.0.0.5/", {}, PRIVATE),
        ("http://172.16.0.1/", {}, PRIVATE),
        ("http://192.168.1.10/", {}, PRIVATE),
        ("http://100.64.0.1/", {}, PRIVATE),
        ("http://0.0.0.0/", {}, PRIVATE),
        ("http://224.0.0.1/", {}, PRIVATE),
        ("http://[::1]/", {}, PRIVATE),
        ("http://[fd00::1]/", {}, PRIVATE),
        ("http://[::ffff:127.0.0.1]/", {}, PRIVATE),
        ("http://postgres.railway.internal:5432/", {"postgres.railway.internal": ["fd12:3456::1"]}, PRIVATE),
        ("http://mixed.example/", {"mixed.example": ["93.184.216.34", "10.0.0.7"]}, PRIVATE),
    ],
)
async def test_scrape_url_refuses_addresses_that_are_not_public_web_pages(network, url, dns, error):
    network.dns.update(dns)
    network.handler = lambda request: httpx.Response(200, html=PAGE)
    result = await scrape_url(url)
    assert result == {"status": "error", "error": error, "url": url}
    assert network.requests == []


async def test_scrape_url_does_not_follow_redirects_into_private_networks(network):
    network.handler = lambda request: httpx.Response(302, headers={"location": "http://169.254.169.254/latest/meta-data/"})
    result = await scrape_url("https://dsp.example/")
    assert result["error"] == PRIVATE
    assert [(r.host, r.path) for r in network.requests] == [("dsp.example", "/")]


async def test_scrape_url_gives_up_after_five_redirects(network):
    network.handler = lambda request: httpx.Response(302, headers={"location": f"/hop{len(network.requests)}"})
    result = await scrape_url("https://dsp.example/")
    assert result["error"] == "The page redirects too many times."
    assert len(network.requests) == 6


async def test_scrape_url_reads_at_most_two_megabytes(network):
    page = "<html><head><title>Big page</title></head><body>" + "x" * 3_000_000 + "</body></html>"
    network.handler = lambda request: httpx.Response(200, html=page)
    result = await scrape_url("https://dsp.example/")
    assert result["status"] == "ok"
    assert result["metadata"]["title"] == "Big page"
    assert result["content_length"] == 2_000_000


async def test_scrape_url_only_analyzes_web_pages(network):
    network.handler = lambda request: httpx.Response(200, content=b"%PDF-1.7", headers={"content-type": "application/pdf"})
    result = await scrape_url("https://dsp.example/brochure.pdf")
    assert result == {"status": "error", "error": "This address doesn't return a web page.", "url": "https://dsp.example/brochure.pdf"}


@pytest.mark.parametrize("html", ["", "<html>", "<p>unclosed <b>tags", "<title>Only a title"])
def test_parser_tolerates_incomplete_markup(html):
    parser = parse(html)
    assert isinstance(parser.get_body_text(), str)
    assert parser.metadata["description"] == ""
