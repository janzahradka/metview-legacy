# Analýza: stažení satelitních snímků z CHMI (VIS-IR)

## Co je na stránce CHMI

- **URL:** https://www.chmi.cz/namerena-data/geostacionarni-druzice/vis-ir  
- **Parametr času:** `t=YYYYMMDDHHmm` (např. `t=202603051140` = 5. 3. 2026 11:40)
- **Vrstvy:** `l=EUR,druzice-visir-cz,druzice-visir-ce,druzice-visir-eu`
- **Mapa:** Komponenta **map-component.chmi.cz** (OpenLayers), konfigurace z **window.dynamicConfig** (načítá se z backendu Liferay, není veřejné API).
- **Layer ID v kódu:** `druzice.druzice-geo-visir`
- **Data provider:** `https://data-provider.chmi.cz` – používá se pro overlay data (legenda, klik na mapu), ne pro samotné tile URL. Kořen data-provider vrací 404.

## Závěr z analýzy HTML/JS

1. **Přímé URL na jeden obrázek (jako u Aladinu nebo Meteopress)** v kódu **není** – mapa se kreslí z tileů/WMS z konfigurace, která se do stránky dostává z backendu (není v uloženém HTML).
2. **Žádné veřejné WMS/WMTS endpointy** pro družicové vrstvy jsme v materiálech nenašli; konfigurace vrstev je uvnitř portletu a načítá se z `dynamicConfig`.
3. **Čas snímku** je v URL parametru `t` ve formátu **YYYYMMDDHHmm**; aktualizace jsou typicky po 10–15 minutách (EUMETSAT).

## Možné přístupy pro job „každých 10 min stáhnout snímek“

### A) Headless browser (Playwright/Selenium)

- Otevřít stránku  
  `https://www.chmi.cz/namerena-data/geostacionarni-druzice/vis-ir?t=<aktualni_cas>&c=50.0484,15.4342,8&l=EUR,druzice-visir-cz,druzice-visir-ce,druzice-visir-eu`
- Počkat na vykreslení mapy, vyfotit canvas nebo screenshot.
- **Plus:** funguje i bez znalosti tile URL.  
- **Mínus:** závislost na layoutu stránky, pomalejší, nutnost browseru na serveru.

### B) Odchytit skutečné tile/WMS požadavky

- V prohlížeči otevřít DevTools → Network, načíst stránku vis-ir a filtrovat např. „png“, „tile“, „wms“, „GetMap“.
- Pokud se objeví předvídatelné URL (např. s parametrem `t=` nebo časem), lze je použít v jednoduchém skriptu (curl/requests) bez browseru.
- **Doporučení:** tohle jako další krok udělat ručně a případně sem doplnit nalezené URL.

### C) EUMETSAT jako zdroj

- CHMI uvádí zdroj: **EUMETSAT**.  
- EUMETSAT nabízí API a datové služby pro MSG/MTG; snímky VIS/IR lze často získat přímo od nich (po registraci).
- Pro dlouhodobě stabilní a „čisté“ řešení je to nejlepší varianta; vyžaduje však nastudování jejich API a případně registraci.

### D) Ověření opendata.chmi.cz

- https://opendata.chmi.cz/ má sekce meteorology/products, meteorology/weather – je vhodné projít, zda tam není družicový produkt jako soubory nebo API.

## Doporučení

1. **Krátký termín:** Zkusit **(B)** – v prohlížeči zachytit skutečné požadavky na tile/obrázek a zjistit, zda existuje předvídatelné URL (např. s `t=YYYYMMDDHHmm`). Pokud ano, napsat job, který každých 10 min sestaví `t` a stáhne obrázek.
2. **Pokud (B) nevyjde:** použít **(A)** – headless browser a screenshot mapy.
3. **Dlouhodobě:** zvážit **(C)** – EUMETSAT API a případně **(D)** – opendata.chmi.cz.

V repozitáři je připraven skript **`scripts/fetch_chmi_satellite.py`**:
- Formát času `t=YYYYMMDDHHmm` je implementován; job může volat skript každých 10 min.
- Pokud najdete přímé URL na obrázek (Network v prohlížeči), doplňte v souboru konstantu `CHMI_IMAGE_URL_TEMPLATE` (s placeholderem `{t}`).
- Jinak spusťte s `--screenshot` (vyžaduje `pip install playwright` a `playwright install chromium`), což vyfotí stránku v headless Chromiu.

Příklad spuštění každých 10 min (Windows Task Scheduler nebo cron):
```text
python scripts/fetch_chmi_satellite.py --output-dir G:\MetView\satellite_cache
# nebo s screenshotem:
python scripts/fetch_chmi_satellite.py --screenshot --output-dir G:\MetView\satellite_cache
```
