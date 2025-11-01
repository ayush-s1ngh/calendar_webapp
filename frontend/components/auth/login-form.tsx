"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { authStore } from "@/store/auth"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"
import { getErrorMessage } from "@/lib/errors"
import { MIN_PASSWORD_LEN } from "@/lib/constants"
import { login as apiLogin, startGoogleOAuth } from "@/lib/authApi"

/**
 * Login form for email/username + password.
 * - Validates inputs via zod
 * - On success, stores tokens and user, then redirects to /calendar
 * - Supports Google OAuth redirect
 */
const schema = z.object({
  username: z.string().min(1, "Email or Username is required"),
  password: z.string().min(MIN_PASSWORD_LEN, `Password must be at least ${MIN_PASSWORD_LEN} characters`),
})

type FormValues = z.infer<typeof schema>

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })
  const setTokens = authStore((s) => s.setTokens)
  const setUser = authStore((s) => s.setUser)
  const router = useRouter()

  const onSubmit = async (values: FormValues) => {
    try {
      const { tokens, user } = await apiLogin(values.username, values.password)
      if (!tokens?.access_token) {
        throw new Error("No access token received")
      }
      setTokens(tokens)
      setUser(user as any)
      toast.success("Login successful")
      router.replace("/calendar")
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Invalid credentials"))
      reset({ username: "", password: "" })
    }
  }

  const handleGoogleLogin = async () => {
    try {
      const url = await startGoogleOAuth()
      if (url) {
        window.location.href = url
      } else {
        toast.error("Failed to start Google OAuth")
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to start Google OAuth"))
    }
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      {...props}
      onSubmit={handleSubmit(onSubmit)}
      aria-label="Login form"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome Back!</h1>
        <p className="text-muted-foreground text-sm text-balance">
          Enter your credentials to login to your account
        </p>
      </div>
      <div className="grid gap-6">
        <div className="grid gap-3">
          <Label htmlFor="username">Email or Username</Label>
          <Input
            id="username"
            autoComplete="username"
            aria-invalid={!!errors.username}
            {...register("username")}
          />
          {errors.username && (
            <span className="text-destructive text-xs">{errors.username.message}</span>
          )}
        </div>
        <div className="grid gap-3">
          <div className="flex items-center">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="ml-auto text-sm underline-offset-4 hover:underline"
            >
              Forgot your password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          {errors.password && (
            <span className="text-destructive text-xs">{errors.password.message}</span>
          )}
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting}
          data-testid="auth-submit"
        >
          {isSubmitting ? "Logging in..." : "Login"}
        </Button>
        <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
          <span className="bg-background text-muted-foreground relative z-10 px-2 uppercase">
            Or Continue With
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogleLogin}
          data-testid="google-oauth-button"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden>
            <path
              d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
              fill="currentColor"
            />
          </svg>
          Login with Google
        </Button>
      </div>
      <div className="text-center text-sm">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="underline underline-offset-4">
          Sign up
        </Link>
      </div>
    </form>
  )
}