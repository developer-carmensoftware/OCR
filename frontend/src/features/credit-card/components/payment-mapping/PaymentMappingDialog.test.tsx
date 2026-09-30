import { useState } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { toast as realToast } from 'sonner'
import { LanguageProvider } from '@/i18n/LanguageContext'
import PaymentMappingDialog from './PaymentMappingDialog'
import type { MappingItem, MappingSet } from './types'
import type {
  MasterAccount,
  MasterDepartment,
} from '@/features/credit-card/hooks/mapping/useMappingData'

// The picker is portaled and search-driven; its internals are not what this dialog adds.
// A plain select stands in for it and still exposes the option list it was handed.
vi.mock('@/shared/components/common/CustomSearchSelect', () => ({
  default: ({
    value,
    onChange,
    options,
    'aria-label': label,
  }: {
    value: string | null
    onChange: (v: string) => void
    options: { code: string }[]
    'aria-label'?: string
  }) => (
    <select
      aria-label={label}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      data-options={options.map(o => o.code).join(',')}
    >
      <option value="" />
      {options.map(o => (
        <option key={o.code} value={o.code}>
          {o.code}
        </option>
      ))}
    </select>
  ),
}))

// Each toast gets its own id, the way sonner hands them out, so a test can tell which one
// was dismissed.
vi.mock('sonner', () => {
  let n = 0
  return {
    toast: Object.assign(
      vi.fn(() => `toast-${++n}`),
      { dismiss: vi.fn() }
    ),
  }
})
const toast = vi.mocked(realToast)

/** The Undo of the n-th toast raised (0-based), as a user would press it. */
function pressUndo(n = 0) {
  const opts = toast.mock.calls[n][1] as unknown as { action: { onClick: () => void } }
  act(() => opts.action.onClick())
}

const ACCOUNTS: MasterAccount[] = [
  { code: '1130V', name: 'AR Visa' },
  { code: '1130M', name: 'AR MasterCard' },
]
const DEPARTMENTS: MasterDepartment[] = [
  { code: 'GEN', name: 'General' },
  // Restricts to one account, which is what makes an illegal pair possible.
  { code: 'FIN', name: 'Finance', allowedAccounts: ['1130V'] },
]

const blank = { dept: '', acc: '' }
const item = (code: string, mapping = blank, over: Partial<MappingItem> = {}): MappingItem => ({
  code,
  mapping,
  ...over,
})

type Data = Record<string, { label: string; items: MappingItem[] }>

const spies = {
  apply: vi.fn(),
  suggest: vi.fn(),
  accept: vi.fn(),
  acceptAll: vi.fn(),
  remove: vi.fn(),
}

/** A stateful stand-in for `mappingSets.ts`, so an edit actually changes the rows. */
function Harness({
  initial,
  onDone,
  onCancel,
}: {
  initial: Data
  onDone: () => void
  onCancel: () => void
}) {
  const [data, setData] = useState(initial)
  const [open, setOpen] = useState(true)
  const patchItems = (id: string, codes: string[], patch: { dept?: string; acc?: string }) =>
    setData(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        items: prev[id].items.map(i =>
          codes.includes(i.code) ? { ...i, mapping: { ...i.mapping, ...patch } } : i
        ),
      },
    }))
  const sets: MappingSet[] = Object.entries(data).map(([id, d]) => ({
    id,
    label: d.label,
    items: d.items,
    setField: (code, field, value) => patchItems(id, [code], { [field]: value }),
    applyToMany: (codes, patch) => {
      spies.apply(id, codes, patch)
      patchItems(id, codes, patch)
    },
    add: raw => {
      const code = raw.trim().toUpperCase()
      if (!code) return 'blank'
      if (d.items.some(i => i.code === code)) return 'duplicate'
      setData(prev => ({
        ...prev,
        [id]: { ...prev[id], items: [...prev[id].items, item(code, blank, { removable: true })] },
      }))
      return null
    },
    remove: code => {
      spies.remove(id, code)
      const index = d.items.findIndex(i => i.code === code)
      const removed = d.items[index]
      setData(prev => ({
        ...prev,
        [id]: { ...prev[id], items: prev[id].items.filter(i => i.code !== code) },
      }))
      return () =>
        setData(prev => {
          if (prev[id].items.some(i => i.code === code)) return prev
          const items = [...prev[id].items]
          items.splice(index, 0, removed)
          return { ...prev, [id]: { ...prev[id], items } }
        })
    },
    suggest: () => spies.suggest(id),
    suggesting: false,
    accept: code => spies.accept(id, code),
    reject: vi.fn(),
    acceptAll: () => spies.acceptAll(id),
  }))
  return (
    <PaymentMappingDialog
      open={open}
      sets={sets}
      context="KBANK"
      masterAccounts={ACCOUNTS}
      masterDepartments={DEPARTMENTS}
      loadingOpts={false}
      onCancel={() => {
        onCancel()
        setOpen(false)
      }}
      onDone={() => {
        onDone()
        setOpen(false)
      }}
    />
  )
}

function renderDialog(initial: Data) {
  const onDone = vi.fn()
  const onCancel = vi.fn()
  render(
    <LanguageProvider>
      <Harness initial={initial} onDone={onDone} onCancel={onCancel} />
    </LanguageProvider>
  )
  return { onDone, onCancel }
}

const rowCodes = () =>
  [...document.querySelectorAll('.pm-row[data-pt]')].map(el => el.getAttribute('data-pt'))
const row = (code: string) => document.querySelector(`[data-pt="${code}"]`) as HTMLElement

const SUMMARY: Data = {
  settlement_summary: {
    label: 'Settlement report · Summary',
    items: [
      item('VS', { dept: 'GEN', acc: '1130V' }),
      item('MC'),
      item('JCB', blank, { removable: true }),
    ],
  },
}

/** Every row removable and mapped, so the order stays the order given. */
const REMOVABLE: Data = {
  settlement_summary: {
    label: 'Settlement report · Summary',
    items: ['VS', 'MC', 'JCB'].map(code =>
      item(code, { dept: 'GEN', acc: '1130V' }, { removable: true })
    ),
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  // The invalid-pair path scrolls to the row and asks whether motion is reduced.
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
})

describe('PaymentMappingDialog', () => {
  it('shows one list with no tabs, and says whose list it is and how far along', () => {
    renderDialog(SUMMARY)

    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.getByText('KBANK · Settlement report · Summary')).toBeInTheDocument()
    expect(screen.getByText('1 / 3 mapped')).toBeInTheDocument()
    // One AI button — the old modal had one per list, and nobody knew which did what.
    expect(screen.getAllByRole('button', { name: /AI Suggest/ })).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('2 payment types need an account')
  })

  it('puts the rows that need a person first, and keeps that order while they are edited', () => {
    renderDialog(SUMMARY)
    expect(rowCodes()).toEqual(['MC', 'JCB', 'VS'])

    fireEvent.change(within(row('MC')).getByLabelText('Department Code — MC'), {
      target: { value: 'GEN' },
    })
    fireEvent.change(within(row('MC')).getByLabelText('Account Code — MC'), {
      target: { value: '1130M' },
    })

    // Mapped now, and still where it was — a row does not jump away from the cursor.
    expect(rowCodes()).toEqual(['MC', 'JCB', 'VS'])
    expect(row('MC').dataset.status).toBe('mapped')
  })

  it('keeps a row under "Needs mapping" after it is mapped, until the filter changes', () => {
    renderDialog(SUMMARY)
    fireEvent.click(screen.getByRole('button', { name: /Needs mapping/ }))
    expect(rowCodes()).toEqual(['MC', 'JCB'])

    fireEvent.change(within(row('MC')).getByLabelText('Department Code — MC'), {
      target: { value: 'GEN' },
    })
    fireEvent.change(within(row('MC')).getByLabelText('Account Code — MC'), {
      target: { value: '1130M' },
    })
    expect(rowCodes()).toEqual(['MC', 'JCB'])

    fireEvent.click(screen.getByRole('button', { name: /^All/ }))
    fireEvent.click(screen.getByRole('button', { name: /Needs mapping/ }))
    expect(rowCodes()).toEqual(['JCB'])
  })

  it('narrows the rows by search', () => {
    renderDialog(SUMMARY)
    fireEvent.change(screen.getByLabelText('Search payment types'), { target: { value: 'jc' } })
    expect(rowCodes()).toEqual(['JCB'])
  })

  it('applies one department and account to the selected rows only', () => {
    renderDialog(SUMMARY)
    fireEvent.click(screen.getByLabelText('Select MC'))
    fireEvent.click(screen.getByLabelText('Select JCB'))

    const bulk = screen.getByRole('region', { name: 'Apply to selected payment types' })
    expect(bulk).toHaveTextContent('2 selected')
    fireEvent.change(within(bulk).getByLabelText('Department'), { target: { value: 'FIN' } })
    // The account list follows the department, exactly as a row's does.
    expect(within(bulk).getByLabelText('Account').getAttribute('data-options')).toBe('1130V')
    fireEvent.change(within(bulk).getByLabelText('Account'), { target: { value: '1130V' } })
    fireEvent.click(within(bulk).getByRole('button', { name: 'Apply' }))

    expect(spies.apply).toHaveBeenCalledWith('settlement_summary', ['MC', 'JCB'], {
      dept: 'FIN',
      acc: '1130V',
    })
    expect(screen.queryByRole('region', { name: 'Apply to selected payment types' })).toBeNull()
    expect(row('VS').dataset.status).toBe('mapped')
    expect(row('MC').dataset.status).toBe('mapped')
  })

  it('shows a tab per list when a bank has more than one, and AI Suggest acts on the one open', () => {
    renderDialog({
      ...SUMMARY,
      fee_invoice: { label: 'Fee invoice', items: [item('Visa')] },
    })

    const tabs = screen.getAllByRole('tab')
    expect(tabs.map(t => t.textContent)).toEqual([
      expect.stringContaining('Settlement report · Summary'),
      expect.stringContaining('Fee invoice'),
    ])
    fireEvent.click(tabs[1])
    expect(rowCodes()).toEqual(['Visa'])

    fireEvent.click(screen.getByRole('button', { name: /AI Suggest/ }))
    expect(spies.suggest).toHaveBeenCalledWith('fee_invoice')
    expect(spies.suggest).toHaveBeenCalledTimes(1)
  })

  it('will not finish on an account the department forbids, and puts the reader on that row', () => {
    const { onDone } = renderDialog({
      fee_invoice: { label: 'Fee invoice', items: [item('Visa')] },
      ...{
        settlement_summary: {
          label: 'Settlement report · Summary',
          // FIN allows 1130V only.
          items: [
            item('VS', { dept: 'GEN', acc: '1130V' }),
            item('MC', { dept: 'FIN', acc: '1130M' }),
          ],
        },
      },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(onDone).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent("1 accounts aren't allowed")
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Settlement report')
    expect(rowCodes()).toEqual(['MC'])
    expect(row('MC').dataset.status).toBe('invalid')
  })

  it('finishes when every pair is legal', () => {
    const { onDone } = renderDialog(SUMMARY)
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('cancels on Escape', () => {
    const { onCancel } = renderDialog(SUMMARY)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('offers Remove only on rows that can go', () => {
    renderDialog(SUMMARY)
    expect(within(row('VS')).queryByRole('button', { name: 'Remove VS' })).toBeNull()
    fireEvent.click(within(row('JCB')).getByRole('button', { name: 'Remove JCB' }))
    expect(spies.remove).toHaveBeenCalledWith('settlement_summary', 'JCB')
  })

  it('opens an empty list on its add row, refuses a duplicate in place, and appends a new one', () => {
    renderDialog({ fee_invoice: { label: 'Fee invoice', items: [] } })

    expect(screen.getByRole('status')).toHaveTextContent('No payment types yet')
    const input = screen.getByLabelText('Add payment type')
    fireEvent.change(input, { target: { value: 'amex' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(rowCodes()).toEqual(['AMEX'])

    fireEvent.change(input, { target: { value: 'AMEX' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByRole('alert')).toHaveTextContent('AMEX is already in a list.')
    expect(rowCodes()).toEqual(['AMEX'])
  })

  it('offers accept on an AI suggestion, and Accept all for the open list', () => {
    renderDialog({
      settlement_summary: {
        label: 'Settlement report · Summary',
        items: [item('MC', blank, { suggestion: { dept: 'GEN', acc: '1130M', source: 'ai' } })],
      },
    })

    expect(row('MC').dataset.status).toBe('suggested')
    fireEvent.click(within(row('MC')).getByRole('button', { name: 'Accept — MC' }))
    expect(spies.accept).toHaveBeenCalledWith('settlement_summary', 'MC')

    fireEvent.click(screen.getByRole('button', { name: /Accept All/ }))
    expect(spies.acceptAll).toHaveBeenCalledWith('settlement_summary')
  })

  // ── Remove is kept away from the suggestion's buttons, and can be undone ──────────

  it('keeps Remove out of the suggestion group, as a trash in its own slot', () => {
    renderDialog({
      settlement_summary: {
        label: 'Settlement report · Summary',
        items: [
          item('MC', blank, {
            suggestion: { dept: 'GEN', acc: '1130M', source: 'ai' },
            removable: true,
          }),
        ],
      },
    })

    const group = within(row('MC')).getByRole('group')
    // The suggestion's pair says what it does in words, not an X beside another X.
    expect(within(group).getByRole('button', { name: 'Accept — MC' })).toHaveTextContent('Accept')
    expect(within(group).getByRole('button', { name: 'Dismiss — MC' })).toHaveTextContent('Dismiss')
    const remove = within(row('MC')).getByRole('button', { name: 'Remove MC' })
    expect(group.contains(remove)).toBe(false)
    expect(remove.className).toBe('pm-row-remove')
  })

  it('removes at once, offers Undo, and Undo puts the row back where it was with its mapping', () => {
    renderDialog(REMOVABLE)
    fireEvent.click(within(row('MC')).getByRole('button', { name: 'Remove MC' }))

    expect(rowCodes()).toEqual(['VS', 'JCB'])
    expect(toast).toHaveBeenCalledWith(
      'Removed MC',
      expect.objectContaining({
        action: expect.objectContaining({ label: 'Undo' }),
      })
    )
    // Where every other toast in the app appears — no position of its own.
    expect(toast.mock.calls[0][1]).not.toHaveProperty('position')

    pressUndo()
    expect(rowCodes()).toEqual(['VS', 'MC', 'JCB'])
    expect(row('MC').dataset.status).toBe('mapped')
  })

  it('gives each removal its own Undo, and one does not dismiss the other', () => {
    renderDialog(REMOVABLE)
    fireEvent.click(within(row('VS')).getByRole('button', { name: 'Remove VS' }))
    fireEvent.click(within(row('JCB')).getByRole('button', { name: 'Remove JCB' }))

    expect(toast).toHaveBeenCalledTimes(2)
    expect(toast.dismiss).not.toHaveBeenCalled()

    pressUndo(0)
    expect(rowCodes()).toEqual(['VS', 'MC'])
  })

  it('takes its Undo toasts with it when it closes', () => {
    renderDialog(REMOVABLE)
    fireEvent.click(within(row('VS')).getByRole('button', { name: 'Remove VS' }))
    fireEvent.click(within(row('JCB')).getByRole('button', { name: 'Remove JCB' }))

    const ids = toast.mock.results.map(r => r.value)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(ids).toHaveLength(2)
    ids.forEach(id => expect(toast.dismiss).toHaveBeenCalledWith(id))
  })

  it('puts focus on the next row after a remove, so Escape still reaches the dialog', async () => {
    renderDialog(REMOVABLE)
    fireEvent.click(within(row('VS')).getByRole('button', { name: 'Remove VS' }))
    await act(() => new Promise(r => requestAnimationFrame(() => r(undefined))))

    expect(document.activeElement).toBe(screen.getByLabelText('Select MC'))
  })
})
