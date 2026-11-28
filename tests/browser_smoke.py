"""Exercise the built tool at a project subpath in Chromium."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import shutil
import tempfile
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    screenshots = ROOT / "browser-checks"
    screenshots.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary:
        shutil.copytree(ROOT / "dist", Path(temporary) / "routemirror")
        server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=temporary))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_BIN"))
                page = browser.new_page(viewport={"width": 1280, "height": 1000})
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(f"http://127.0.0.1:{server.server_port}/routemirror/")
                page.locator("#leads tr").first.wait_for()
                assert page.locator("#route").input_value() == "555"
                assert "comparable years" in page.locator("#patterns").inner_text()
                page.locator("#persistent-count").click()
                page.locator("#persistent button").first.click()
                assert page.locator("#route").input_value() == page.locator("#persistent button").first.inner_text()
                assert "%" in page.locator("#chart").inner_text()
                page.locator("#count").click()
                page.locator("#rank button").first.click()
                assert page.locator("#route").input_value() == page.locator("#rank button").first.inner_text()
                page.select_option("#season","Summer")
                assert page.locator("#history tr").count() > 0
                page.screenshot(path=str(screenshots / "desktop.png"), full_page=True)
                page.set_viewport_size({"width": 390, "height": 844})
                assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
                page.screenshot(path=str(screenshots / "mobile.png"), full_page=True)
                home = f"http://127.0.0.1:{server.server_port}/routemirror/"
                page.goto(home)
                page.locator("#route option:checked").wait_for(state="attached")
                assert page.locator("#route").bounding_box()["y"] < 844
                page.screenshot(path=str(screenshots / "first-visit-phone.png"))

                page.locator(".recordnav a").first.click()
                page.get_by_role("link",name="Take the guided tour").click()
                page.get_by_role("link",name="Stop 1 · Route 555").click()
                assert "555" in page.locator("h1").inner_text()
                page.get_by_role("link",name="Fall Sundays and holidays",exact=True).click()
                page.locator("#leads tr").first.wait_for()
                assert page.locator("#day").input_value() == "Sun/Hol"
                assert page.locator("#route").input_value() == "555"
                page.goto(home+"records/routes/005-006/")
                page.get_by_role("link",name="Open Route 005/006 with these conditions").click()
                page.wait_for_function("document.getElementById('route').value === '005/006'")
                assert "boardings" in page.locator("#annual").inner_text()
                assert "No peak measurements" in page.locator("#finding").inner_text()
                plain = browser.new_page(java_script_enabled=False, viewport={"width":390,"height":844})
                plain.goto(home)
                plain.get_by_role("link",name="Browse route records").click()
                plain.get_by_role("link",name="Route 555",exact=True).click()
                assert "Annual boardings" in plain.locator("body").inner_text()
                assert plain.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
                plain.get_by_role("link",name="Continue to Route 99").click()
                assert "99" in plain.locator("h1").inner_text()
                plain.screenshot(path=str(screenshots / "route-phone.png"),full_page=True)
                plain.close()
                page.goto(f"http://127.0.0.1:{server.server_port}/routemirror/compass.html")
                page.wait_for_function("document.querySelector('#status').textContent.includes('69.3%')")
                assert 'Bloor' in page.locator('#line option:checked').inner_text()
                page.locator('#line').select_option(label='Line 4 (Sheppard)')
                assert '91.6%' in page.locator('#status').inner_text()
                page.locator('#files').set_input_files({
                    "name":"shapes.txt", "mimeType":"text/plain",
                    "buffer":b"shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\na,45,0,0\na,46,0,1"})
                page.wait_for_function("document.querySelector('#status').textContent.includes('N–S (100%')")
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
                page.screenshot(path=str(screenshots/"compass-mobile.png"), full_page=True)
                assert not errors, errors
                browser.close()
            print("Browser checks passed: source data, filters and mobile layout")
        finally:
            server.shutdown()


if __name__ == "__main__":
    main()
