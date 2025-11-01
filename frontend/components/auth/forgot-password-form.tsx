"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { getErrorMessage } from "@/lib/errors"
import { requestPasswordReset } from "@/lib/authApi"

/**
 * Forgot password form.
 * - Requests a password reset email for the provided address
 */
const schema = z.object({
  email: z.string().email("Invalid email"),
})

type FormValues = z.infer<typeof schema>

export function ForgotPasswordForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (values: FormValues) => {
    try {
      await requestPasswordReset(values.email)
      toast.success("If an account exists, a reset link has been sent.")
      reset()
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to request password reset"))
    }
  }

  return (
    <div>
      <div className="mx-auto w-full max-w-md space-y-8">
        <div>
          <h1 className="text-2xl text-center font-semibold tracking-tight">
            Forgot your password?
          </h1>
          <p className="mt-2 text-center text-sm">
            Enter the email address associated with your account and we&apos;ll send you a link to
            reset your password.
          </p>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} aria-label="Forgot password form">
          <div>
            <Label htmlFor="email" className="sr-only">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="Email address"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email && (
              <span className="text-destructive text-xs">{errors.email.message}</span>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="auth-submit">
            {isSubmitting ? "Sending..." : "Reset password"}
          </Button>
        </form>
        <div className="flex justify-center">
          <Link
            href="/login"
            className="text-sm font-medium hover:text-gray-900 dark:hover:text-gray-50"
            prefetch={false}
          >
            Back to login
          </Link>
        </div>
      </div>
    </div>
  )
}

export default ForgotPasswordForm