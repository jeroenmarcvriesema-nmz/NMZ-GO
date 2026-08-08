"""Proefdraai van de werkopdracht-parser tegen echte opdrachten.

Zelfde logica als straks in de Edge Function. Geen taalmodel: puur
ankers en opsommingstekens, zodat de uitkomst voorspelbaar is en er
niets verzonnen kan worden.
"""
import re
import sys
import pypdf

START = re.compile(r'Uit te voeren werkzaamheden.*?:', re.IGNORECASE)
EIND = re.compile(r'(Datum oplevering|Naam en handtekening)', re.IGNORECASE)

# Het opsommingsteken komt als losse 'o' uit de tekstlaag, direct
# gevolgd door een hoofdletter.
PUNT = re.compile(r'^o(?=[A-Z])')

# Staan bewust nooit op een werkbon: administratief, niet te fotograferen.
UITGESLOTEN = ['parkeerkosten', 'brandstoftoeslag', 'klein materiaal']


def lees(pad: str) -> str:
    r = pypdf.PdfReader(pad)
    return '\n'.join((p.extract_text() or '') for p in r.pages)


def kop(tekst: str, veld: str) -> str | None:
    m = re.search(rf'^{veld}\s*:?\s*(.+)$', tekst, re.IGNORECASE | re.MULTILINE)
    return m.group(1).strip() if m else None


def ontleed(tekst: str):
    s = START.search(tekst)
    if not s:
        return {'fout': 'Kop "Uit te voeren werkzaamheden" niet gevonden'}

    rest = tekst[s.end():]
    e = EIND.search(rest)
    blok = rest[:e.start()] if e else rest

    # Regels samenvoegen: een regel die niet met het opsommingsteken
    # begint, hoort bij het punt erboven (afgebroken zin).
    punten, huidig = [], None
    for regel in blok.splitlines():
        regel = regel.strip()
        if not regel:
            continue
        if PUNT.match(regel):
            if huidig:
                punten.append(huidig)
            huidig = PUNT.sub('', regel).strip()
        elif huidig:
            huidig += ' ' + regel
    if huidig:
        punten.append(huidig)

    punten = [re.sub(r'\s+', ' ', p).strip() for p in punten]
    behouden = [p for p in punten
                if not any(u in p.lower() for u in UITGESLOTEN)]
    weggelaten = [p for p in punten if p not in behouden]

    return {
        'opdrachtnummer': kop(tekst, 'Opdrachtnummer'),
        'adres': kop(tekst, 'Inzake'),
        'inspecteur': kop(tekst, 'Inspecteur'),
        'telefoon': kop(tekst, 'Telefoonnummer'),
        'naslag': tekst[:s.start()].strip(),
        'punten': behouden,
        'weggelaten': weggelaten,
    }


for pad in sys.argv[1:]:
    r = ontleed(lees(pad))
    print('=' * 70)
    if 'fout' in r:
        print('MISLUKT:', r['fout'])
        continue
    print(f"Opdracht {r['opdrachtnummer']} — {r['adres']}")
    print(f"Inspecteur {r['inspecteur']} ({r['telefoon']})")
    print(f"\nAF TE VINKEN PUNTEN ({len(r['punten'])}):")
    for i, p in enumerate(r['punten'], 1):
        print(f'  {i:2}. {p[:95]}{"…" if len(p) > 95 else ""}')
    print(f"\nWEGGELATEN ({len(r['weggelaten'])}):")
    for p in r['weggelaten']:
        print(f'   - {p[:70]}')
    print(f"\nNaslagtekst: {len(r['naslag'])} tekens")
