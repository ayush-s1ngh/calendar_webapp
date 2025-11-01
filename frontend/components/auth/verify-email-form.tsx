"use client"

import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { resendVerification } from "@/lib/authApi"
import { getErrorMessage } from "@/lib/errors"

/**
 * Simple email verification info + "resend email" action.
 */
export default function VerifyEmailDialog() {
  const resend = async () => {
    try {
      await resendVerification()
      toast.success("Verification email sent successfully")
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to resend verification email"))
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Verify Your Email</h1>
        <p className="mt-2 text-center text-sm">
          A verification link has been sent to your email address. Please check your
          inbox and click the link to verify your account.
        </p>
        <Button className="w-full" onClick={resend} data-testid="resend-verification">
          Resend Verification Email
        </Button>
      </div>
    </div>
  )
}

// Optional named export for consistency if preferred later
export const VerifyEmailForm = VerifyEmailDialog