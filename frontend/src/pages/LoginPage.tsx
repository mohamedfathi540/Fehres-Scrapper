import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { LogIn } from "lucide-react";
import { loginUser, resendVerification } from "../api/auth";
import { useAuthStore } from "../stores/authStore";
import { Button } from "../components/ui/Button";

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      setAuth(data.access_token, email);
      navigate("/", { replace: true });
    },
  });

  const resendMutation = useMutation({
    mutationFn: resendVerification,
  });

  const isNotVerified = mutation.isError && mutation.error.message === "Email not verified";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ email, password });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center">
            <LogIn className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-text-primary">Welcome back</h1>
          <p className="text-sm text-text-secondary">Sign in to your Fehres account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-text-secondary">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-md text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary-600 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-text-secondary">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-md text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary-600 transition-colors"
            />
          </div>

          {mutation.isError && (
            <div className="space-y-2">
              <p className="text-sm text-error">{mutation.error.message}</p>
              {isNotVerified && (
                <button
                  type="button"
                  onClick={() => resendMutation.mutate(email)}
                  disabled={resendMutation.isPending}
                  className="text-sm text-primary-400 hover:text-primary-300 font-medium disabled:opacity-50"
                >
                  {resendMutation.isPending ? "Sending…" : "Resend verification email"}
                </button>
              )}
              {resendMutation.isSuccess && (
                <p className="text-sm text-green-400">{resendMutation.data.message}</p>
              )}
              {resendMutation.isError && (
                <p className="text-sm text-error">{resendMutation.error.message}</p>
              )}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={mutation.isPending}
            className="w-full"
          >
            Sign in
          </Button>
        </form>

        <p className="text-center text-sm text-text-secondary">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="text-primary-400 hover:text-primary-300 font-medium">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
