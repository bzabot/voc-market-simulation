import unittest
from pathlib import Path

from httpx2 import ASGITransport, AsyncClient

import web


class SessionApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        web.reset_session()
        self.client = AsyncClient(
            transport=ASGITransport(app=web.app), base_url="http://test"
        )

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_index_page_is_served(self):
        index = Path(web.__file__).parent / "static/index.html"
        self.assertTrue(index.is_file())
        self.assertIn("VOC market", index.read_text())
        r = await self.client.get("/api/session")
        self.assertEqual(r.status_code, 404)

    async def test_new_session_returns_empty_cursor(self):
        r = await self.client.post("/api/session", json={"seed": 1})
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["frame_count"], 0)
        self.assertFalse(body["done"])
        self.assertIsNone(body["frame"])

    async def test_step_advances_and_get_returns_latest(self):
        await self.client.post("/api/session", json={"seed": 1})
        r = await self.client.post("/api/session/step")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["frame_count"], 1)
        self.assertIsNotNone(r.json()["frame"])
        got = await self.client.get("/api/session")
        self.assertEqual(got.json()["frame"]["header"], r.json()["frame"]["header"])
        idx = await self.client.get("/api/session", params={"index": 0})
        self.assertEqual(idx.json()["cursor"], 0)

    async def test_step_when_done_is_409(self):
        await self.client.post("/api/session", json={"seed": 1})
        while True:
            r = await self.client.post("/api/session/step")
            if r.status_code == 409:
                break
            self.assertEqual(r.status_code, 200)
            if r.json()["done"]:
                r = await self.client.post("/api/session/step")
                self.assertEqual(r.status_code, 409)
                break

    async def test_frames_and_investor_after_run(self):
        await self.client.post("/api/session", json={"seed": 1})
        while (await self.client.post("/api/session/step")).status_code == 200:
            pass
        frames = await self.client.get("/api/session/frames")
        self.assertGreater(len(frames.json()["frames"]), 1)
        last = frames.json()["frames"][-1]
        name = last["investors"][0]["name"]
        inv = await self.client.get(f"/api/session/investors/{name}")
        self.assertEqual(inv.status_code, 200)
        body = inv.json()
        self.assertEqual(body["name"], name)
        self.assertIn("stubbornness", body)
        self.assertIn("tape", body)
        self.assertIn("start_cents", body)
        missing = await self.client.get("/api/session/investors/Nobody")
        self.assertEqual(missing.status_code, 404)


if __name__ == "__main__":
    unittest.main()
