'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Localize } from '@deriv-com/translations';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppTranslations } from '@/components/custom/i18n-provider';

interface ApiTokenLoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogin: (token: string) => Promise<void>;
}

export function ApiTokenLoginDialog({
  open,
  onOpenChange,
  onLogin,
}: ApiTokenLoginDialogProps) {
  const [token, setToken] = useState('');
  const [isTokenVisible, setIsTokenVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { localize } = useAppTranslations();

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setToken('');
      setIsTokenVisible(false);
      setError(null);
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onLogin(token);
      setToken('');
      setIsTokenVisible(false);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not authorize this API token.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            <Localize i18n_default_text="Log in with API token" />
          </DialogTitle>
          <DialogDescription>
            <Localize i18n_default_text="Enter a Deriv API token with trade permission. Your token is kept only for this browser session." />
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deriv-api-token">
              <Localize i18n_default_text="API token" />
            </Label>
            <Input
              id="deriv-api-token"
              name="deriv-api-token"
              type={isTokenVisible ? 'text' : 'password'}
              autoComplete="new-password"
              spellCheck={false}
              className="pr-10"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              required
              disabled={isSubmitting}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              aria-label={localize(isTokenVisible ? 'Hide API token' : 'Show API token')}
              aria-pressed={isTokenVisible}
              onClick={() => setIsTokenVisible((visible) => !visible)}
              disabled={isSubmitting}
            >
              {isTokenVisible ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={isSubmitting || !token.trim()}>
            {isSubmitting ? (
              <Localize i18n_default_text="Connecting..." />
            ) : (
              <Localize i18n_default_text="Connect with token" />
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
