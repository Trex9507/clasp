import { LANGUAGES } from "@clasp/shared"
import { zodResolver } from "@hookform/resolvers/zod"
import { TriangleAlert } from "lucide-react"
import type * as React from "react"
import { Controller, useForm, useWatch, type Control } from "react-hook-form"
import type { Key } from "react-aria-components"

import { Button, LinkButton } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { errorDetail } from "@/lib/api-client"
import {
  AgentFormSchema,
  SYSTEM_PROMPT_MAX,
  type AgentFormValues,
} from "@/routes/agents/agent-form-schema"
import { EFFORT_OPTIONS, VISIBILITY_OPTIONS, useModelCatalog } from "@/routes/agents/agent-labels"

export function AgentForm({
  defaultValues,
  submitLabel,
  isPending,
  error,
  onSubmit,
  cancelHref,
  readOnly = false,
  requireDirty = false,
}: {
  defaultValues: AgentFormValues
  submitLabel: string
  isPending: boolean
  /** The last failed submit, rendered under the form with the API's `detail`. */
  error?: unknown
  onSubmit: (values: AgentFormValues) => void
  cancelHref?: string
  readOnly?: boolean
  /** Keeps the submit button disabled until something changed (editing, not creating). */
  requireDirty?: boolean
}) {
  const form = useForm<AgentFormValues>({
    resolver: zodResolver(AgentFormSchema),
    defaultValues,
  })
  const { register, control, formState } = form
  const errors = formState.errors

  return (
    <form noValidate onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}>
      {/* A disabled fieldset disables every native control inside it in one place, which is
          what keeps a read-only archived agent from being half editable. */}
      <fieldset disabled={readOnly} className="grid min-w-0 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>How the agent appears in this workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-5 sm:grid-cols-[6rem_1fr]">
                <Field data-invalid={errors.icon ? true : undefined}>
                  <FieldLabel htmlFor="agent-icon">Icon</FieldLabel>
                  <Input
                    id="agent-icon"
                    placeholder="🤖"
                    autoComplete="off"
                    className="text-center"
                    aria-invalid={errors.icon ? true : undefined}
                    {...register("icon")}
                  />
                  <FieldError errors={[errors.icon]} />
                </Field>
                <Field data-invalid={errors.name ? true : undefined}>
                  <FieldLabel htmlFor="agent-name">Name</FieldLabel>
                  <Input
                    id="agent-name"
                    placeholder="Support assistant"
                    autoComplete="off"
                    aria-invalid={errors.name ? true : undefined}
                    {...register("name")}
                  />
                  <FieldError errors={[errors.name]} />
                </Field>
              </div>
              <Field data-invalid={errors.description ? true : undefined}>
                <FieldLabel htmlFor="agent-description">Description</FieldLabel>
                <Input
                  id="agent-description"
                  placeholder="Answers customer questions about orders"
                  autoComplete="off"
                  aria-invalid={errors.description ? true : undefined}
                  {...register("description")}
                />
                <FieldError errors={[errors.description]} />
              </Field>
              <Controller
                control={control}
                name="visibility"
                render={({ field }) => (
                  <ChoiceSelect
                    label="Visibility"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    isDisabled={readOnly}
                    options={VISIBILITY_OPTIONS.map((option) => ({
                      id: option.value,
                      label: option.label,
                      description: option.description,
                    }))}
                  />
                )}
              />
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
            <CardDescription>What the agent does and how it answers.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={errors.config?.systemPrompt ? true : undefined}>
                <FieldLabel htmlFor="agent-system-prompt">System prompt</FieldLabel>
                <Textarea
                  id="agent-system-prompt"
                  placeholder="You are a helpful assistant for..."
                  spellCheck={false}
                  className="max-h-[min(70vh,40rem)] min-h-64 font-mono text-sm md:text-sm"
                  aria-invalid={errors.config?.systemPrompt ? true : undefined}
                  aria-describedby="agent-system-prompt-count"
                  {...register("config.systemPrompt")}
                />
                <PromptCounter control={control} />
                <FieldError errors={[errors.config?.systemPrompt]} />
              </Field>
              <Controller
                control={control}
                name="config.language"
                render={({ field }) => (
                  <ChoiceSelect
                    label="Response language"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    isDisabled={readOnly}
                    options={LANGUAGES.map((language) => ({
                      id: language.code,
                      label: language.label,
                    }))}
                  />
                )}
              />
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Model</CardTitle>
            <CardDescription>The brain behind the agent.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <ModelSelect control={control} isDisabled={readOnly} />
              <Controller
                control={control}
                name="config.effort"
                render={({ field }) => (
                  <ChoiceSelect
                    label="Effort"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    isDisabled={readOnly}
                    options={EFFORT_OPTIONS.map((option) => ({
                      id: option.value,
                      label: option.label,
                      description: option.description,
                    }))}
                  />
                )}
              />
            </FieldGroup>
          </CardContent>
        </Card>
      </fieldset>

      {error ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{errorDetail(error)}</span>
        </div>
      ) : null}

      {readOnly ? null : (
        <div className="mt-4 flex justify-end gap-2">
          {cancelHref ? (
            <LinkButton href={cancelHref} variant="outline">
              Cancel
            </LinkButton>
          ) : null}
          <Button
            type="submit"
            isPending={isPending}
            isDisabled={requireDirty && !formState.isDirty}
          >
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  )
}

function PromptCounter({ control }: { control: Control<AgentFormValues> }) {
  // Watched in its own component so typing re-renders the counter, not the whole form.
  const prompt = useWatch({ control, name: "config.systemPrompt" })
  const length = prompt.length
  return (
    <FieldDescription
      id="agent-system-prompt-count"
      className={length > SYSTEM_PROMPT_MAX ? "text-destructive" : undefined}
    >
      {length.toLocaleString()} / {SYSTEM_PROMPT_MAX.toLocaleString()} characters
    </FieldDescription>
  )
}

function ModelSelect({
  control,
  isDisabled,
}: {
  control: Control<AgentFormValues>
  isDisabled: boolean
}) {
  const catalog = useModelCatalog()
  return (
    <Controller
      control={control}
      name="config.model"
      render={({ field, fieldState }) => (
        <ChoiceSelect
          label="Model"
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          isDisabled={isDisabled}
          error={fieldState.error?.message}
          options={catalog.map((model) => ({
            id: model.id,
            label: model.label,
            description: model.description,
          }))}
        />
      )}
    />
  )
}

type Choice = { id: string; label: string; description?: string }

/**
 * A labelled select whose options may carry a one-line explanation. The trigger shows only the
 * label; the selected option's explanation sits under it, so the choice explains itself without
 * opening the list.
 */
function ChoiceSelect({
  label,
  value,
  onChange,
  onBlur,
  options,
  isDisabled,
  error,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  options: Choice[]
  isDisabled?: boolean
  error?: string
}) {
  const selected = options.find((option) => option.id === value)
  return (
    <Field data-invalid={error ? true : undefined}>
      <Select
        className="flex w-full flex-col gap-2"
        value={value}
        onChange={(key: Key | null) => {
          if (key !== null) onChange(String(key))
        }}
        onBlur={onBlur}
        isDisabled={isDisabled}
        isInvalid={error !== undefined}
      >
        <FieldLabel>{label}</FieldLabel>
        <SelectTrigger>
          <SelectValue>
            {({ selectedText, defaultChildren, isPlaceholder }) =>
              isPlaceholder ? defaultChildren : selectedText
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} id={option.id} textValue={option.label}>
              <OptionText option={option} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected?.description ? <FieldDescription>{selected.description}</FieldDescription> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  )
}

function OptionText({ option }: { option: Choice }): React.ReactNode {
  if (!option.description) return option.label
  return (
    <span className="flex flex-col py-0.5 whitespace-normal">
      <span>{option.label}</span>
      <span className="text-xs text-muted-foreground">{option.description}</span>
    </span>
  )
}
