import { Component, type ReactNode } from 'react'
import { meldFout } from '@/lib/foutmelder'
import { Button } from '@/components/ui/Button'
import { IconAlertTriangle, IconRefresh, IconHome } from '@tabler/icons-react'

interface Props {
  children: ReactNode
  /** Waar in de app dit vangnet hangt; komt mee in de melding. */
  plek?: string
}

interface State {
  fout: Error | null
}

/**
 * Het vangnet onder de schermen.
 *
 * Zonder dit levert één fout in één component een leeg wit scherm op.
 * Op een laptop is dat vervelend; op een werktelefoon in een
 * kruipruimte is het het einde van de werkdag, want er is geen weg
 * terug en niemand die het ziet.
 *
 * Twee dingen gebeuren hier daarom tegelijk: de gebruiker krijgt een
 * uitweg, en kantoor krijgt de melding. Dat tweede is het punt — een
 * foutscherm dat alleen sorry zegt lost niets op.
 *
 * Bewust een klassecomponent: React kent geen hook-variant van
 * componentDidCatch. Dit is de enige klasse in het project.
 */
export class Foutvanger extends Component<Props, State> {
  state: State = { fout: null }

  static getDerivedStateFromError(fout: Error): State {
    return { fout }
  }

  componentDidCatch(fout: Error) {
    // De plek staat vóór de boodschap in plaats van in `cause`: dan is
    // hij zichtbaar in de lijst zonder dat je een regel hoeft open te
    // klappen, en de stacktrace blijft die van de echte fout.
    if (this.props.plek) fout.message = `[${this.props.plek}] ${fout.message}`
    void meldFout(fout, 'render')
  }

  render() {
    if (!this.state.fout) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-surface-2 dark:bg-surface-dark">
        <div className="w-full max-w-md bg-white dark:bg-surface-dark-2 rounded-lg shadow-lg px-6 py-10 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-brand-red-light dark:bg-brand-red/10 flex items-center justify-center text-brand-red dark:text-red-400">
            <IconAlertTriangle className="w-6 h-6" />
          </div>

          <h1 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">
            Dit scherm liep vast
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-white/50">
            Kantoor heeft er automatisch bericht van gekregen — je hoeft niets
            door te geven. Je werk tot nu toe staat opgeslagen; afvinken en
            foto's gaan meteen naar de server.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 mt-6">
            <Button className="flex-1" onClick={() => window.location.reload()}>
              <IconRefresh className="w-4 h-4" /> Opnieuw laden
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => { window.location.href = '/' }}>
              <IconHome className="w-4 h-4" /> Naar het begin
            </Button>
          </div>

          {/* De technische tekst staat er wel, maar ingeklapt. Wie belt
              met kantoor kan hem voorlezen; wie dat niet doet heeft er
              geen last van. */}
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-xs text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/60">
              Technische details
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded-sm bg-surface-2 dark:bg-white/5 p-3 text-[11px] leading-relaxed text-gray-500 dark:text-white/50 whitespace-pre-wrap break-words">
              {this.state.fout.message}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}
