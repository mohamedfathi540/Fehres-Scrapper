import { useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { MailCheck, AlertCircle, Loader2 } from "lucide-react";
import { verifyEmail } from "../api/auth";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const mutation = useMutation({
    mutationFn: () => verifyEmail(token),
  });

  useEffect(() => {
    if (token) {
      mutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary p-4">
      <div className="w-full max-w-sm text-center space-y-4">
        {mutation.isPending && (
          <>
            <Loader2 className="w-10 h-10 text-primary-400 animate-spin mx-auto" />
            <p className="text-text-secondary">Verifying your email…</p>
          </>
        )}

        {mutation.isSuccess && (
          <>
            <div className="mx-auto w-12 h-12 bg-green-600/20 rounded-xl flex items-center justify-center">
              <MailCheck className="w-6 h-6 text-green-400" />
            </div>
            <h1 className="text-xl font-semibold text-text-primary">Email verified!</h1>
            <p className="text-sm text-text-secondary">
              Your account is now active. You can sign in.
            </p>
            <Link
              to="/login"
              className="inline-block mt-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-500 transition-colors"
            >
              Go to login
            </Link>
          </>
        )}

        {mutation.isError && (
          <>
            <div className="mx-auto w-12 h-12 bg-error/20 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-error" />
            </div>
            <h1 className="text-xl font-semibold text-text-primary">Verification failed</h1>
            <p className="text-sm text-text-secondary">{mutation.error.message}</p>
            <Link
              to="/login"
              className="inline-block mt-2 text-sm text-primary-400 hover:text-primary-300 font-medium"
            >
              Back to login
            </Link>
          </>
        )}

        {!token && !mutation.isPending && (
          <>
            <div className="mx-auto w-12 h-12 bg-error/20 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-error" />
            </div>
            <h1 className="text-xl font-semibold text-text-primary">Missing token</h1>
            <p className="text-sm text-text-secondary">
              No verification token found in the URL.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
