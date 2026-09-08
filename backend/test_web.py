import unittest

from fastapi.testclient import TestClient

import web


class SessionApiTests(unittest.TestCase):
    def setUp(self):
        web.reset_session()
        self.client = TestClient(web.app)

    def test_index_page_is_served(self):
        r = self.client.get("/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("VOC market", r.text)
        r = self.client.get("/api/session")
        self.assertEqual(r.status_code, 404)

    def test_new_session_returns_empty_cursor(self):
        r = self.client.post("/api/session", json={"seed": 1})
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["frame_count"], 0)
        self.assertFalse(body["done"])
        self.assertIsNone(body["frame"])

    def test_step_advances_and_get_returns_latest(self):
        self.client.post("/api/session", json={"seed": 1})
        r = self.client.post("/api/session/step")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["frame_count"], 1)
        self.assertIsNotNone(r.json()["frame"])
        got = self.client.get("/api/session")
        self.assertEqual(got.json()["frame"]["header"], r.json()["frame"]["header"])
        idx = self.client.get("/api/session", params={"index": 0})
        self.assertEqual(idx.json()["cursor"], 0)

    def test_step_when_done_is_409(self):
        self.client.post("/api/session", json={"seed": 1})
        while True:
            r = self.client.post("/api/session/step")
            if r.status_code == 409:
                break
            self.assertEqual(r.status_code, 200)
            if r.json()["done"]:
                r = self.client.post("/api/session/step")
                self.assertEqual(r.status_code, 409)
                break

    def test_frames_and_investor_after_run(self):
        self.client.post("/api/session", json={"seed": 1})
        while self.client.post("/api/session/step").status_code == 200:
            pass
        frames = self.client.get("/api/session/frames")
        self.assertGreater(len(frames.json()["frames"]), 1)
        last = frames.json()["frames"][-1]
        name = last["investors"][0]["name"]
        inv = self.client.get(f"/api/session/investors/{name}")
        self.assertEqual(inv.status_code, 200)
        body = inv.json()
        self.assertEqual(body["name"], name)
        self.assertIn("stubbornness", body)
        self.assertIn("tape", body)
        self.assertIn("start_cents", body)
        missing = self.client.get("/api/session/investors/Nobody")
        self.assertEqual(missing.status_code, 404)


if __name__ == "__main__":
    unittest.main()
