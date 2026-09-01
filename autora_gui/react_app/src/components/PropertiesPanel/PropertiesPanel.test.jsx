/**
 * Tests for the PropertiesPanel — focused on the expanded modal editor used for
 * long IV/DV expression parameters. useWorkflow is mocked so the panel can be
 * driven with a controlled selected node and a dispatch spy.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import PropertiesPanel from './PropertiesPanel'

const dispatch = vi.fn()
let mockState

vi.mock('../../context/WorkflowContext', () => ({
  useWorkflow: () => ({ state: mockState, dispatch })
}))

// A selected experiment-runner node with a single IV parameter.
function makeState(xValue) {
  return {
    selectedNodeId: 'n1',
    previewedComponent: null,
    nodes: [
      {
        id: 'n1',
        type: 'experiment_runner',
        name: 'Equation Experiment',
        parameters: { X: xValue },
        componentData: {
          parameters: {
            equation_experiment: [
              {
                name: 'X',
                datatype: 'IV',
                description: 'Declaration of IV.',
                default: '[IV(name="x", value_range=(-10, 10))]'
              }
            ]
          },
          inputDataType: null,
          outputDataType: null
        }
      }
    ]
  }
}

beforeEach(() => {
  dispatch.mockClear()
  mockState = makeState('[IV(name="x", value_range=(-10, 10))]')
})

describe('PropertiesPanel IV/DV expression editor', () => {
  it('offers an expand button and no modal until it is clicked', () => {
    render(<PropertiesPanel />)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByLabelText('Open a larger editor for X'))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    // The modal is seeded with the parameter's current value.
    expect(within(dialog).getByRole('textbox').value).toBe('[IV(name="x", value_range=(-10, 10))]')
  })

  it('commits the edited value on Update and closes', () => {
    render(<PropertiesPanel />)
    fireEvent.click(screen.getByLabelText('Open a larger editor for X'))
    const textarea = within(screen.getByRole('dialog')).getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '[IV(name="a", value_range=(0, 1))]' } })
    fireEvent.click(screen.getByText('Update'))

    expect(dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_NODE',
      payload: { id: 'n1', parameters: { X: '[IV(name="a", value_range=(0, 1))]' } }
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('discards the draft on Cancel', () => {
    render(<PropertiesPanel />)
    fireEvent.click(screen.getByLabelText('Open a larger editor for X'))
    const textarea = within(screen.getByRole('dialog')).getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'changed' } })
    fireEvent.click(screen.getByText('Cancel'))

    expect(dispatch).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('PropertiesPanel modal accessibility', () => {
  it('moves focus into the textarea on open', () => {
    render(<PropertiesPanel />)
    fireEvent.click(screen.getByLabelText('Open a larger editor for X'))
    const textarea = within(screen.getByRole('dialog')).getByRole('textbox')
    expect(document.activeElement).toBe(textarea)
  })

  it('closes on Escape', () => {
    render(<PropertiesPanel />)
    fireEvent.click(screen.getByLabelText('Open a larger editor for X'))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('traps focus: Tab from the last control wraps to the first', () => {
    render(<PropertiesPanel />)
    fireEvent.click(screen.getByLabelText('Open a larger editor for X'))
    const dialog = screen.getByRole('dialog')
    const closeBtn = within(dialog).getByLabelText('Close editor')
    const updateBtn = within(dialog).getByText('Update')

    updateBtn.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(closeBtn)
  })

  it('traps focus: Shift+Tab from the first control wraps to the last', () => {
    render(<PropertiesPanel />)
    fireEvent.click(screen.getByLabelText('Open a larger editor for X'))
    const dialog = screen.getByRole('dialog')
    const closeBtn = within(dialog).getByLabelText('Close editor')
    const updateBtn = within(dialog).getByText('Update')

    closeBtn.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(updateBtn)
  })

  it('restores focus to the expand button on close', () => {
    render(<PropertiesPanel />)
    const expandBtn = screen.getByLabelText('Open a larger editor for X')
    fireEvent.click(expandBtn)
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Cancel'))
    expect(document.activeElement).toBe(expandBtn)
  })
})
