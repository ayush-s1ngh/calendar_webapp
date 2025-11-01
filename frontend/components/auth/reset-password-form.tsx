"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { MIN_PASSWORD_LEN } from "@/lib/constants"
import { getErrorMessage } from "@/lib/errors"
import { resetPassword as apiResetPassword } from "@/lib/authApi"

/**
 * Reset password form.
 * - Accepts a token and new password
 * - On success, redirects to /login
 */
const schema = z
  .object({
    password: z
      .string()
      .min(MIN_PASSWORD_LEN, `Password must be at least ${MIN_PASSWORD_LEN} characters`),
    confirm: z.string().min(MIN_PASSWORD_LEN, "Confirm your password"),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  })

type FormValues = z.infer<typeof schema>

export function ResetPasswordForm({ token }: { token: string }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })
  const router = useRouter()

  const onSubmit = async (values: FormValues) => {
    try {
      await apiResetPassword(token, values.password)
      toast.success("Password reset successfully")
      router.replace("/login")
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to reset password"))
      reset({ password: "", confirm: "" })
    }
  }

  return (
    <div className="mx-auto w/full max-w-md space-y-8">
      <div>
        <h1 className="text-2xl text-center font-semibold tracking-tight">
          Reset your password
        </h1>
        <p className="mt-2 text-center text-sm">
          Enter the new password you would like to use for your account.
        </p>
      </div>
      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} aria-label="Reset password form">
        <div>
          <Label htmlFor="new-password" className="sr-only">
            New password
          </Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            placeholder="New password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          {errors.password && (
            <span className="text-destructive text-xs">{errors.password.message}</span>
          )}
        </div>
        <div>
          <Label htmlFor="confirm-password" className="sr-only">
            Confirm new password
          </Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            placeholder="Confirm new password"
            aria-invalid={!!errors.confirm}
            {...register("confirm")}
          />
          {errors.confirm && (
            <span className="text-destructive text-xs">{errors.confirm.message}</span>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="auth-submit">
          {isSubmitting ? "Submitting..." : "Submit"}
        </Button>
      </form>
    </div>
  )
}

export default ResetPasswordForm