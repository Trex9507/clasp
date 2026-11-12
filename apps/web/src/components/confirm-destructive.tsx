import * as React from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

/**
 * One confirmation for anything irreversible.
 *
 * `confirmPhrase` turns the dialog from a speed bump into an actual check:
 * a dialog whose only defence is a second click is dismissed by muscle
 * memory, and the ones that matter here - deleting an agent, removing a
 * connection - are exactly the ones somebody reaches on autopilot. Typing
 * the name requires reading it.
 *
 * **Never render this inside a React Aria table cell.** RAC collection
 * components build their children through a collection pass, which
 * re-creates the component instances in a cell - so a dialog living in a
 * row loses its `typed` state on every keystroke, leaving the confirm
 * button permanently disabled. It looks like a broken input and is
 * actually a lifecycle problem. Found exactly that way. Hoist the dialog
 * to the page and let the row's button set which record is pending, which
 * is also why the controlled mode below exists.
 */
export function ConfirmDestructive({
  trigger,
  isOpen,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmPhrase,
  isPending,
  onConfirm,
}: {
  /** Omit when driving the dialog from a parent's state. */
  trigger?: React.ReactNode
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel: string
  /** When given, the action stays disabled until it is typed exactly. */
  confirmPhrase?: string
  isPending?: boolean
  onConfirm: () => void
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const [typed, setTyped] = React.useState("")

  const controlled = isOpen !== undefined
  const open = controlled ? isOpen : uncontrolledOpen

  // Cleared on open from the event, not an effect - a confirmation dialog
  // that renders the previously typed phrase for a frame is a dialog whose
  // whole point can be defeated by a fast second click.
  function handleOpenChange(next: boolean) {
    if (next) setTyped("")
    if (controlled) onOpenChange?.(next)
    else setUncontrolledOpen(next)
  }

  const ready = confirmPhrase === undefined || typed.trim() === confirmPhrase

  return (
    <AlertDialogTrigger isOpen={open} onOpenChange={handleOpenChange}>
      {trigger}
      <AlertDialog>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {confirmPhrase !== undefined ? (
          <Field>
            <FieldLabel htmlFor="confirm-phrase">
              Type <span className="font-medium text-foreground">{confirmPhrase}</span> to confirm
            </FieldLabel>
            <Input
              id="confirm-phrase"
              autoFocus
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
            />
          </Field>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            isDisabled={!ready}
            isPending={isPending}
            onPress={() => {
              onConfirm()
              handleOpenChange(false)
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialog>
    </AlertDialogTrigger>
  )
}
