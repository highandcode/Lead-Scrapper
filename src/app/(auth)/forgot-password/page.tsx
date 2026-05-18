"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Zap, Mail, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { forgotPassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await forgotPassword(formData);
      if (result?.error) {
        setError(result.error);
      } else if (result?.success) {
        setSuccess(result.success);
      }
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4">
          <Zap className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Reset password</h1>
        <p className="text-sm text-muted-foreground mt-1">
          We&apos;ll email you a secure reset link
        </p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-white/10 bg-card/80 backdrop-blur-sm p-8 shadow-2xl">
        {success ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4 py-4 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Link sent!</p>
              <p className="text-sm text-muted-foreground mt-1">{success}</p>
            </div>
            <Link href="/login">
              <Button variant="outline" size="sm" className="mt-2 gap-2">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
              </Button>
            </Link>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Email address
              </label>
              <Input
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                autoComplete="email"
                disabled={isPending}
                className="bg-secondary/50 border-white/10 focus:border-primary/50 h-11"
              />
            </div>

            <Button
              type="submit"
              variant="gradient"
              className="w-full h-11"
              disabled={isPending}
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  Sending…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Mail className="w-4 h-4" /> Send reset link
                </span>
              )}
            </Button>
          </form>
        )}
      </div>

      {/* Footer */}
      {!success && (
        <p className="text-center text-sm text-muted-foreground mt-6">
          Remembered it?{" "}
          <Link
            href="/login"
            className="text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Back to login
          </Link>
        </p>
      )}

      <p className="text-center text-xs text-muted-foreground/50 mt-8">
        clinicgrowthwithankit.com
      </p>
    </motion.div>
  );
}
