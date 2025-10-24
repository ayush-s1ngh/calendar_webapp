"use client"

import { Button } from "@/components/ui/button"
import api from "@/lib/api"
import { toast } from "sonner"

export default function VerifyEmailDialog() {
  const resend = async () => {
    try {
      await api.post("/auth/resend-verification")
      toast.success("Verification email sent successfully")
    } catch (err: any) {
      const message = err?.response?.data?.message || "Failed to resend verification email"
      toast.error(message)
    }
  }

  return (
      <div className="mx-auto w-full max-w-md space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Verify Your Email</h1>
        <p className="mt-2 text-center text-sm ">
            A verification link has been sent to your email address. Please check your inbox and click the link to verify your account.
        </p>
        <Button className="w-full" onClick={resend}>
            Resend Verification Email
        </Button>
      </div>
      </div>
  )
}