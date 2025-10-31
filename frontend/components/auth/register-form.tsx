"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import api from "@/lib/api"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"

const schema = z.object({
  email: z.string().email("Invalid email"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Confirm your password"),
}).refine((vals) => vals.password === vals.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

type FormValues = z.infer<typeof schema>

type ErrorLike = { response?: { data?: { message?: string } } }
function getMessage(err: unknown, fallback: string) {
  return (err as ErrorLike)?.response?.data?.message ?? fallback
}

export function RegisterForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })
  const router = useRouter()

  const onSubmit = async (values: FormValues) => {
    try {
      await api.post("/auth/register", {
        email: values.email,
        username: values.username,
        password: values.password,
      })
      toast.success("Registered successfully. Please verify your email.")
      router.replace("/login")
    } catch (err: unknown) {
      toast.error(getMessage(err, "Registration failed"))
      reset({ password: "", confirmPassword: "" })
    }
  }

  return (
    <form className={cn("flex flex-col gap-6", className)} {...props} onSubmit={handleSubmit(onSubmit)}>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Create an account
        </h1>
        <p className="text-muted-foreground text-sm text-balance">
          Enter details below to create an account
        </p>
      </div>
      <div className="grid gap-6">
        <div className="grid gap-3">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="m@example.com" aria-invalid={!!errors.email} {...register("email")} />
          {errors.email && <span className="text-destructive text-xs">{errors.email.message}</span>}
        </div>
        <div className="grid gap-3">
          <Label>Username</Label>
          <Input id="username" type="text" aria-invalid={!!errors.username} {...register("username")} />
          {errors.username && <span className="text-destructive text-xs">{errors.username.message}</span>}
        </div>
        <div className="grid gap-3">
          <div className="flex items-center">
            <Label htmlFor="password">Password</Label>
          </div>
          <Input id="password" type="password" aria-invalid={!!errors.password} {...register("password")} />
          {errors.password && <span className="text-destructive text-xs">{errors.password.message}</span>}
        </div>
        <div className="grid gap-3">
          <div className="flex items-center">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
          </div>
          <Input id="confirmPassword" type="password" aria-invalid={!!errors.confirmPassword} {...register("confirmPassword")} />
          {errors.confirmPassword && <span className="text-destructive text-xs">{errors.confirmPassword.message}</span>}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Registering..." : "Register"}
        </Button>
      </div>
      <div className="text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="underline underline-offset-4">
          Login
        </Link>
      </div>
    </form>
  )
}