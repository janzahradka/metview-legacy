#!/usr/bin/env python3
"""
Job: stáhnout aktuální satelitní snímek CHMI (VIS-IR).

Čas snímku na stránce CHMI je v parametru t=YYYYMMDDHHmm (UTC nebo lokální).
Snímky jsou cca po 10–15 min (EUMETSAT). Spouštět např. každých 10 min (cron/Task Scheduler).

Z analýzy HTML: přímé URL na obrázek není v kódu veřejné – mapa používá
map-component s konfigurací z backendu. Možnosti:
  1) Až zjistíte tile/image URL z DevTools (Network) – doplňte CHMI_IMAGE_URL_TEMPLATE.
  2) Jinak použijte režim screenshot (vyžaduje: pip install playwright && playwright install chromium).
"""
from __future__ import annotations

import argparse
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# Parametr t na stránce CHMI: YYYYMMDDHHmm (např. 202603061140)
def chmi_time_param(dt: datetime | None = None) -> str:
    if dt is None:
        dt = datetime.now(timezone.utc)
    return dt.strftime("%Y%m%d%H%M")

# Přímé URL na obrázek – DOPLŇTE po zjištění z Network tab (např. WMS GetMap nebo tile URL)
# Příklad (fiktivní): "https://map-service.chmi.cz/.../druzice-visir.png?t={t}"
CHMI_IMAGE_URL_TEMPLATE: str | None = None  # např. "https://...?t={t}"


def fetch_via_url(output_dir: Path, t: str) -> bool:
    """Stáhne obrázek z přímého URL, pokud je nastaveno."""
    if not CHMI_IMAGE_URL_TEMPLATE or "{t}" not in CHMI_IMAGE_URL_TEMPLATE:
        return False
    url = CHMI_IMAGE_URL_TEMPLATE.format(t=t)
    try:
        import urllib.request
        req = urllib.request.Request(url, headers={"User-Agent": "MetView/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
        out = output_dir / f"chmi_visir_{t}.png"
        out.write_bytes(data)
        print(f"Saved: {out}")
        return True
    except Exception as e:
        print(f"URL fetch failed: {e}", file=sys.stderr)
        return False


def fetch_via_screenshot(output_dir: Path, t: str) -> bool:
    """Otevře stránku CHMI v headless browseru a uloží screenshot mapy."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Playwright not installed. Run: pip install playwright && playwright install chromium", file=sys.stderr)
        return False

    url = (
        "https://www.chmi.cz/namerena-data/geostacionarni-druzice/vis-ir"
        f"?t={t}&c=50.0484,15.4342,8&l=EUR,druzice-visir-cz,druzice-visir-ce,druzice-visir-eu"
    )
    out = output_dir / f"chmi_visir_{t}.png"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1200, "height": 800})
        page.goto(url, wait_until="networkidle", timeout=30000)
        # Počkat na mapu – komponenta má třídu .chmu-map-component nebo podobně
        page.wait_for_selector(".chmu-map-component, .leaflet-container, canvas", timeout=15000)
        # Oblast s mapou (lze upravit podle skutečného selektoru)
        map_el = page.query_selector(".chmu-map-component") or page.query_selector("main") or page
        map_el.screenshot(path=str(out))
        browser.close()

    print(f"Saved screenshot: {out}")
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Stáhnout aktuální CHMI satelitní snímek (VIS-IR)")
    parser.add_argument("--output-dir", type=Path, default=Path("satellite_cache"), help="Adresář pro ukládání snímků")
    parser.add_argument("--screenshot", action="store_true", help="Použít headless browser (screenshot) místo přímého URL")
    parser.add_argument("--t", type=str, default=None, help="Parametr t (YYYYMMDDHHmm). Default: aktuální čas zaokrouhlený na 10 min")
    args = parser.parse_args()

    t = args.t or chmi_time_param()
    if not re.match(r"^\d{12}$", t):
        print("Invalid --t; use YYYYMMDDHHmm", file=sys.stderr)
        sys.exit(1)

    args.output_dir.mkdir(parents=True, exist_ok=True)

    if not args.screenshot and CHMI_IMAGE_URL_TEMPLATE and fetch_via_url(args.output_dir, t):
        return
    if args.screenshot and fetch_via_screenshot(args.output_dir, t):
        return
    if not args.screenshot and (not CHMI_IMAGE_URL_TEMPLATE or not fetch_via_url(args.output_dir, t)):
        print(
            "No direct image URL configured. Either:\n"
            "  1) Set CHMI_IMAGE_URL_TEMPLATE in this script after finding the real URL in browser DevTools (Network),\n"
            "  2) Or run with --screenshot (requires Playwright).",
            file=sys.stderr,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
