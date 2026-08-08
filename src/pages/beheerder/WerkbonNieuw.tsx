import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { genereerBonnummer } from '@/lib/utils'
import { toast } from '@/store/toastStore'
import type { Persoon } from '@/types'
import { IconPlus, IconTrash, IconArrowLeft, IconWand } from '@tabler/icons-react'

interface TaakInput { titel: string; omschrijving: string }

export default function WerkbonNieuw() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [bonnummer] = useState(genereerBonnummer())
  const [projectnaam, setProjectnaam] = useState('')
  const [adres, setAdres] = useState('')
  const [opdrachtgever, setOpdrachtgever] = useState('')
  const [datum, setDatum] = useState(new Date().toISOString().split('T')[0])
  const [medewerkers, setMedewerkers] = useState<string[]>([])
  const [taken, setTaken] = useState<TaakInput[]>([{ titel: '', omschrijving: '' }])
  const [grippTekst, setGrippTekst] = useState('')
  const [alleProfielen, setAlleProfielen] = useState<Persoon[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'handmatig' | 'gripp'>('handmatig')

  useEffect(() => {
    // Personen en niet profiles: toewijzen moet kunnen aan iemand die
    // nog geen account heeft. Dat is bij ons de normale toestand.
    supabase.from('personen').select('*').eq('actief', true).order('naam')
      .then(({ data }) => setAlleProfielen((data as Persoon[]) || []))
  }, [])

  const parseerGripp = () => {
    const gevonden: TaakInput[] = []
    grippTekst.split('\n').forEach((r) => {
      const s = r.trim(); if (!s) return
      const match = s.match(/^(?:\d+[.)\s]|[-\u2022*\u2192]\s*)(.+)/)
      if (match) gevonden.push({ titel: match[1].trim(), omschrijving: '' })
    })
    if (gevonden.length) {
      setTaken(gevonden)
      setActiveTab('handmatig')
      toast.goed(`${gevonden.length} ${gevonden.length === 1 ? 'punt' : 'punten'} overgenomen`)
    } else {
      toast.fout('Geen checkpunten herkend. Gebruik genummerde punten of streepjes.')
    }
  }

  const handleSave = async () => {
    if (!adres || !projectnaam || !datum) { toast.fout('Vul adres, projectnaam en datum in.'); return }
    const geldig = taken.filter((t) => t.titel.trim())
    if (!geldig.length) { toast.fout('Voeg minimaal één taak toe.'); return }
    setLoading(true)

    const { data: wb, error: wbErr } = await supabase
      .from('werkbonnen').insert({ bonnummer, projectnaam, adres, opdrachtgever, datum, aangemaakt_door: profile?.id })
      .select().single()

    if (wbErr || !wb) {
      toast.fout('De werkbon kon niet worden aangemaakt. Controleer je verbinding en probeer het opnieuw.')
      setLoading(false)
      return
    }

    // De bon staat er al; taken en toewijzing mogen niet stil mislukken,
    // anders krijgt de monteur een lege werkbon te zien.
    const { error: taakErr } = await supabase.from('taken').insert(
      geldig.map((t, i) => ({ werkbon_id: wb.id, titel: t.titel, omschrijving: t.omschrijving, volgorde: i }))
    )
    if (taakErr) toast.fout('De werkbon is aangemaakt, maar de taken zijn niet opgeslagen. Vul ze aan op de werkbon.')

    if (medewerkers.length) {
      const { error: koppelErr } = await supabase.from('werkbon_medewerkers').insert(
        medewerkers.map((id) => ({ werkbon_id: wb.id, persoon_id: id, handmatig: true }))
      )
      if (koppelErr) toast.fout('De werkbon is aangemaakt, maar de monteurs zijn niet gekoppeld.')
    }

    if (!taakErr) toast.goed('Werkbon aangemaakt')
    navigate(`/werkbonnen/${wb.id}`)
  }

  return (
    <PageWrapper title="Nieuwe werkbon" actions={
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => navigate('/werkbonnen')}><IconArrowLeft className="w-4 h-4" /> Terug</Button>
        <Button variant="primary" loading={loading} onClick={handleSave}>Opslaan</Button>
      </div>
    }>
      <div className="max-w-4xl space-y-5">
        <Card accent="yellow">
          <SectionHeading title="Werkbon informatie" />
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Bonnummer" value={bonnummer} readOnly className="bg-surface-2 dark:bg-white/5 text-gray-400 dark:text-white/40" />
              <Input label="Datum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
            </div>
            <Input label="Projectnaam" placeholder="Bijv. Renovatie badkamer" value={projectnaam} onChange={(e) => setProjectnaam(e.target.value)} required />
            <Input label="Adres" placeholder="Straat, huisnr, woonplaats" value={adres} onChange={(e) => setAdres(e.target.value)} required />
            <Input label="Opdrachtgever (optioneel)" placeholder="Naam klant" value={opdrachtgever} onChange={(e) => setOpdrachtgever(e.target.value)} />
          </div>
        </Card>

        <Card>
          <SectionHeading title="Medewerkers koppelen" />
          <div className="flex flex-wrap gap-2">
            {alleProfielen.map((p) => (
              <button key={p.id}
                onClick={() => setMedewerkers((prev) => prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id])}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${medewerkers.includes(p.id) ? 'bg-brand-yellow text-gray-900 border-brand-yellow-dark' : 'bg-white dark:bg-surface-dark-2 text-gray-600 dark:text-white/60 border-gray-200 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/30'}`}>
                {p.naam}
              </button>
            ))}
            {alleProfielen.length === 0 && <p className="text-sm text-gray-400 dark:text-white/40">Geen medewerkers gevonden.</p>}
          </div>
        </Card>

        <Card>
          <SectionHeading
            title="Taken"
            actions={
              <div className="flex gap-1 bg-surface-2 dark:bg-white/5 p-1 rounded-sm">
                {(['handmatig','gripp'] as const).map((t) => (
                  <button key={t} onClick={() => setActiveTab(t)}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-all ${activeTab === t ? 'bg-white dark:bg-surface-dark-2 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-white/50'}`}>
                    {t === 'handmatig' ? 'Handmatig' : 'Gripp import'}
                  </button>
                ))}
              </div>
            }
          />

          {activeTab === 'gripp' ? (
            <div className="space-y-3">
              <Textarea label="Plak tekst uit Gripp" rows={8}
                placeholder={"1. CV-ketel controleren\n2. Radiatoren ontluchten\n- Lekkage inspectie"}
                value={grippTekst} onChange={(e) => setGrippTekst(e.target.value)} />
              <Button variant="primary" onClick={parseerGripp}><IconWand className="w-4 h-4" /> Herkennen</Button>
            </div>
          ) : (
            <div className="space-y-2">
              {taken.map((taak, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1.5">
                    <input type="text" placeholder={`Taak ${i + 1}…`} value={taak.titel}
                      onChange={(e) => setTaken((prev) => prev.map((t, j) => j === i ? { ...t, titel: e.target.value } : t))}
                      className="w-full px-3 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-white/10 rounded-sm outline-none focus:border-brand-yellow" />
                    <input type="text" placeholder="Toelichting (optioneel)" value={taak.omschrijving}
                      onChange={(e) => setTaken((prev) => prev.map((t, j) => j === i ? { ...t, omschrijving: e.target.value } : t))}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-white/10 rounded-sm outline-none focus:border-brand-yellow text-gray-500 dark:text-white/50" />
                  </div>
                  <button onClick={() => setTaken((prev) => prev.filter((_, j) => j !== i))}
                    className="p-2 text-gray-300 dark:text-white/30 hover:text-brand-red transition-colors mt-0.5">
                    <IconTrash className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setTaken((prev) => [...prev, { titel: '', omschrijving: '' }])}>
                <IconPlus className="w-4 h-4" /> Taak toevoegen
              </Button>
            </div>
          )}
        </Card>

        <Button variant="primary" size="lg" fullWidth loading={loading} onClick={handleSave}>Werkbon opslaan</Button>
      </div>
    </PageWrapper>
  )
}
