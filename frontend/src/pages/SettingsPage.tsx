import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useSettingsStore } from "../stores/settingsStore";
import { useAuthStore } from "../stores/authStore";
import { deleteAccount } from "../api/auth";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export function SettingsPage() {
  const {
    clearHistory,
  } = useSettingsStore();

  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      logout();
      navigate('/login', { replace: true });
    },
    onError: (error: any) => {
      alert(error.message || "Failed to delete account");
    }
  });

  const handleDeleteAccount = () => {
    if (window.confirm("Are you sure you want to permanently delete your account? This action cannot be undone.")) {
      deleteMutation.mutate();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-text-primary tracking-tight">
          Settings
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          Configure your Fehres application
        </p>
      </div>

      {/* Data Management */}
      <Card title="Data Management">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-text-primary font-medium">
              Clear Chat History
            </h4>
            <p className="text-sm text-text-muted">
              Remove all chat messages from local storage
            </p>
          </div>
          <Button variant="danger" onPress={() => clearHistory()}>
            Clear History
          </Button>
        </div>
      </Card>

      {/* About */}
      <Card title="About">
        <div className="text-center py-4">
          <h1 className="text-2xl font-bold text-text-primary mb-2">Fehres</h1>
          <p className="text-text-secondary">RAG System</p>
          <p className="text-sm text-text-muted mt-4">
            A modern frontend for the Fehres RAG API built with React and React
            Aria
          </p>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card title="Danger Zone">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-error font-medium">Delete Account</h4>
            <p className="text-sm text-text-muted">
              Permanently delete your account and all associated data.
            </p>
          </div>
          <Button
            variant="danger"
            onPress={handleDeleteAccount}
            isLoading={deleteMutation.isPending}
          >
            Delete Account
          </Button>
        </div>
      </Card>
    </div>
  );
}
