"""/{id} routes answer 404 for ids that cannot exist, including malformed UUIDs.

Products are covered in test_products.py::test_malformed_product_id_returns_404.
"""

import pytest

MALFORMED_IDS = ["not-a-uuid", "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz"]

# resource → (method, path template, JSON body) for each of its /{id} routes
ID_ROUTES = {
    "queue": [
        ("GET", "/api/queue/{id}", None),
        ("PATCH", "/api/queue/{id}", {"status": "approved"}),
        ("DELETE", "/api/queue/{id}", None),
    ],
    "email-queue": [
        ("POST", "/api/email-queue/{id}/send", None),
        ("PATCH", "/api/email-queue/{id}", {"subject": "Hello"}),
        ("DELETE", "/api/email-queue/{id}", None),
    ],
    "templates": [("DELETE", "/api/templates/{id}", None)],
    "brands": [
        ("PATCH", "/api/brands/{id}", {"tagline": "New"}),
        ("DELETE", "/api/brands/{id}", None),
    ],
    "calendar": [("DELETE", "/api/calendar/{id}", None)],
    "captures": [("DELETE", "/api/captures/{id}", None)],
}


@pytest.mark.parametrize("resource", list(ID_ROUTES))
async def test_malformed_ids_return_404(client, register, auth, resource):
    token, _ = await register()
    for method, template, body in ID_ROUTES[resource]:
        for bad_id in MALFORMED_IDS:
            path = template.format(id=bad_id)
            resp = await client.request(method, path, headers=auth(token), json=body)
            assert resp.status_code == 404, (method, path, resp.text)
