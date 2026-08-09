// ============================================================
// NMZ GO — gegevens meenemen naar buiten
// ============================================================
// Kantoor werkt met Excel voor de administratie en de facturatie. Wat
// hier gebeurt is bewust klein: een CSV maken die daar zonder gedoe in
// opent. Geen bibliotheek, geen server, geen wachttijd.
//
// Puntkomma als scheidingsteken en een BOM ervoor: dat is wat Excel in
// een Nederlandse Windows-installatie verwacht. Met een komma komt
// alles in één kolom te staan en zonder BOM worden accenten onleesbaar
// — beide keren belt er iemand.
// ============================================================

/** Eén veld veilig maken. Aanhalingstekens verdubbelen, rest omsluiten. */
function veld(waarde: unknown): string {
  if (waarde === null || waarde === undefined) return ''
  const tekst = String(waarde)
  if (/[";\n\r]/.test(tekst)) return `"${tekst.replace(/"/g, '""')}"`
  return tekst
}

export function naarCsv(koppen: string[], rijen: unknown[][]): string {
  const regels = [koppen.map(veld).join(';')]
  for (const rij of rijen) regels.push(rij.map(veld).join(';'))
  return '﻿' + regels.join('\r\n')
}

/**
 * Zet een bestand klaar om te downloaden.
 *
 * Via een blob en niet via een server: het gaat om gegevens die de
 * browser al heeft, en er is geen reden om die eerst ergens heen te
 * sturen om ze daarna terug te krijgen.
 */
export function download(bestandsnaam: string, inhoud: string, type = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([inhoud], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = bestandsnaam
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // Opruimen, anders blijft de blob in het geheugen staan zolang het
  // tabblad open is — en kantoor sluit dat tabblad nooit.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Een bestandsnaam met de datum erin, zodat twee exports niet botsen. */
export function bestandsnaamMetDatum(basis: string, extensie = 'csv'): string {
  const d = new Date()
  const stempel = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
  return `${basis}-${stempel}.${extensie}`
}
