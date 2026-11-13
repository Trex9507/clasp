import {
  CreateMcpConnectionRequest,
  McpAuthType,
  type McpConnection,
  type UpdateMcpConnectionRequest,
} from "@clasp/shared"
import { zodResolver } from "@hookform/resolvers/zod"
import { TriangleAlert } from "lucide-react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Radio, RadioGroup } from "@/components/ui/radio-group"
import { errorDetail } from "@/lib/api-client"
import { useCreateConnection, useUpdateConnection } from "@/lib/queries"
import { AUTH_OPTIONS } from "@/routes/connections/connection-labels"

const TOKEN_MAX = 8192

/**
 * The add and edit form. Name and URL reuse the shared request schemas; the token is a plain
 * string here because "empty" has a meaning the request cannot express: on edit, an empty token
 * keeps the saved one.
 */
function connectionFormSchema(keepsSavedToken: boolean) {
  return z
    .object({
      name: CreateMcpConnectionRequest.shape.name,
      url: CreateMcpConnectionRequest.shape.url,
      authType: McpAuthType,
      bearerToken: z.string().max(TOKEN_MAX),
    })
    .superRefine((values, ctx) => {
      if (values.authType === "bearer" && values.bearerToken.trim() === "" && !keepsSavedToken) {
        ctx.addIssue({ code: "custom", path: ["bearerToken"], message: "Paste the bearer token" })
      }
    })
}
type ConnectionFormValues = z.infer<ReturnType<typeof connectionFormSchema>>

/** Add a connection (no `connection`) or edit one. The parent owns whether it is open. */
export function ConnectionDialog({
  workspaceId,
  connection,
  isOpen,
  onOpenChange,
}: {
  workspaceId: string
  connection?: McpConnection
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} className="sm:max-w-md">
      <ConnectionForm
        workspaceId={workspaceId}
        connection={connection}
        onDone={() => onOpenChange(false)}
      />
    </Dialog>
  )
}

function ConnectionForm({
  workspaceId,
  connection,
  onDone,
}: {
  workspaceId: string
  connection?: McpConnection
  onDone: () => void
}) {
  const create = useCreateConnection(workspaceId)
  const update = useUpdateConnection(workspaceId)
  const editing = connection !== undefined
  const keepsSavedToken = editing && connection.authType === "bearer" && connection.hasCredential
  const mutation = editing ? update : create

  const form = useForm<ConnectionFormValues>({
    resolver: zodResolver(connectionFormSchema(keepsSavedToken)),
    defaultValues: {
      name: connection?.name ?? "",
      url: connection?.url ?? "",
      authType: connection?.authType ?? "none",
      // Never prefilled: the API does not return the token, only whether one is saved.
      bearerToken: "",
    },
  })
  const { register, control, formState } = form
  const errors = formState.errors
  const authType = useWatch({ control, name: "authType" })

  function onSubmit(values: ConnectionFormValues) {
    const token = values.bearerToken.trim()
    const withToken = values.authType === "bearer" && token !== ""
    if (editing) {
      const body: UpdateMcpConnectionRequest = {
        name: values.name,
        url: values.url,
        authType: values.authType,
        ...(withToken ? { bearerToken: token } : {}),
      }
      update.mutate({ id: connection.id, body }, { onSuccess: onDone })
    } else {
      create.mutate(
        {
          name: values.name,
          url: values.url,
          authType: values.authType,
          ...(withToken ? { bearerToken: token } : {}),
        },
        { onSuccess: onDone },
      )
    }
  }

  return (
    <form noValidate onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}>
      <div className="grid gap-4">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${connection.name}` : "Add connection"}</DialogTitle>
          <DialogDescription>
            Clasp connects to the MCP server and discovers the tools it offers. Your agents can then
            use them as actions.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field data-invalid={errors.name ? true : undefined}>
            <FieldLabel htmlFor="connection-name">Name</FieldLabel>
            <Input
              id="connection-name"
              placeholder="Order system"
              autoComplete="off"
              aria-invalid={errors.name ? true : undefined}
              {...register("name")}
            />
            <FieldError errors={[errors.name]} />
          </Field>
          <Field data-invalid={errors.url ? true : undefined}>
            <FieldLabel htmlFor="connection-url">URL</FieldLabel>
            <Input
              id="connection-url"
              type="url"
              placeholder="https://example.com/mcp"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={errors.url ? true : undefined}
              aria-describedby="connection-url-help"
              {...register("url")}
            />
            <FieldDescription id="connection-url-help">
              The server's Streamable HTTP endpoint. It must be reachable from the internet for
              hosted agents.
            </FieldDescription>
            <FieldError errors={[errors.url]} />
          </Field>
          <Controller
            control={control}
            name="authType"
            render={({ field }) => (
              <Field>
                <RadioGroup
                  value={field.value}
                  onChange={(value) => field.onChange(value)}
                  onBlur={field.onBlur}
                  orientation="horizontal"
                  className="flex flex-col gap-2"
                >
                  <FieldLabel>Authentication</FieldLabel>
                  <div className="flex flex-wrap gap-4">
                    {AUTH_OPTIONS.map((option) => (
                      <Radio key={option.value} value={option.value}>
                        {option.label}
                      </Radio>
                    ))}
                  </div>
                </RadioGroup>
              </Field>
            )}
          />
          {authType === "bearer" ? (
            <Field data-invalid={errors.bearerToken ? true : undefined}>
              <FieldLabel htmlFor="connection-token">Token</FieldLabel>
              <Input
                id="connection-token"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={keepsSavedToken ? "Leave blank to keep the saved token" : undefined}
                aria-invalid={errors.bearerToken ? true : undefined}
                {...register("bearerToken")}
              />
              <FieldDescription>
                Sent as the Authorization header. Stored encrypted and never shown again.
              </FieldDescription>
              <FieldError errors={[errors.bearerToken]} />
            </Field>
          ) : null}
        </FieldGroup>

        {mutation.error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{errorDetail(mutation.error)}</span>
          </div>
        ) : null}

        <DialogFooter>
          <DialogClose>Cancel</DialogClose>
          <Button type="submit" isPending={mutation.isPending}>
            {editing ? "Save and test" : "Add and test"}
          </Button>
        </DialogFooter>
      </div>
    </form>
  )
}
