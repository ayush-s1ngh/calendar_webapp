"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import api from "@/lib/api"
import { toast } from "sonner"

const schema = z.object({
  email: z.string().email("Invalid email"),
})

type FormValues = z.infer<typeof schema>

export default function ForgotPasswordForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (values: FormValues) => {
    try {
      await api.post("/auth/request-password-reset", { email: values.email })
      toast.success("If an account exists, a reset link has been sent.")
      reset()
    } catch (err: any) {
      const message = err?.response?.data?.message || "Failed to request password reset"
      toast.error(message)
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
            Enter the email address associated with your account and we'll send you a link to reset your password.
          </p>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <Label htmlFor="email" className="sr-only">
              Email address
            </Label>
            <Input id="email" type="email" autoComplete="email" required placeholder="Email address" aria-invalid={!!errors.email} {...register("email")} />
            {errors.email && <span className="text-destructive text-xs">{errors.email.message}</span>}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
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