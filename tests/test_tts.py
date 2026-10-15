"""Local HTTP contract, concurrency, and real offline voice smoke tests."""
import concurrent.futures
import importlib.util
import io
import json
import threading
import unittest
import urllib.error
import urllib.request
import wave
from pathlib import Path

spec = importlib.util.spec_from_file_location("tts_proxy", Path(__file__).resolve().parents[1] / "tts-proxy.py")
proxy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proxy)

class TTSContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = proxy.http.server.ThreadingHTTPServer(("127.0.0.1", 0), proxy.Handler)
        proxy.PORT = cls.server.server_port
        cls.base = f"http://127.0.0.1:{proxy.PORT}"
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def request(self, path, **headers):
        req = urllib.request.Request(self.base + path, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                return response.status, response.read(), response.headers
        except urllib.error.HTTPError as error:
            with error:
                return error.code, error.read(), error.headers

    def test_health_reports_actual_engine(self):
        status, data, headers = self.request("/health", Origin="null")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(data)["engineAvailable"], proxy.PIPER_AVAILABLE)
        self.assertEqual(headers["Content-Type"], "application/json")

    def test_foreign_origin_and_host_rejected(self):
        self.assertEqual(self.request("/health", Origin="https://example.com")[0], 403)
        self.assertEqual(self.request("/health", Host="example.com")[0], 403)

    def test_invalid_input_and_unknown_route(self):
        self.assertEqual(self.request("/unknown")[0], 404)
        self.assertEqual(self.request("/tts?lang=fr&word=bonjour")[0], 400)
        self.assertEqual(self.request("/tts?lang=en&word=" + "a" * 301)[0], 400)

    @unittest.skipUnless(proxy.PIPER_AVAILABLE, "Bundled Piper runtime unavailable")
    def test_real_three_language_audio(self):
        for lang, word in [("en", "hello"), ("de", "hallo"), ("es", "hola")]:
            with self.subTest(lang=lang):
                status, data, headers = self.request(f"/tts?lang={lang}&word={word}", Origin="null")
                self.assertEqual(status, 200)
                self.assertEqual(headers["Content-Type"], "audio/wav")
                with wave.open(io.BytesIO(data)) as wav:
                    self.assertEqual(wav.getnchannels(), 1)
                    self.assertGreater(wav.getnframes(), 0)

    @unittest.skipUnless(proxy.PIPER_AVAILABLE, "Bundled Piper runtime unavailable")
    def test_repeated_audio_cached_and_concurrent_requests_safe(self):
        first = proxy.piper_synthesize("en", "welcome")
        self.assertEqual(first, proxy.piper_synthesize("en", "welcome"))
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            results = list(pool.map(lambda _: self.request("/tts?lang=en&word=welcome"), range(6)))
        self.assertTrue(all(status == 200 and data == first for status, data, _ in results))
        self.assertGreaterEqual(proxy.piper_synthesize.cache_info().hits, 7)

if __name__ == "__main__":
    unittest.main(verbosity=2)
