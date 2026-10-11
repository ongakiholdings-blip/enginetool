'use client';

import { useEffect, useRef, useState } from 'react';
import { Localize } from '@deriv-com/translations';
import { prefetchAuthReferral } from '@/hooks/use-auth';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { Button } from '@/components/ui/button';
import { ApiTokenLoginDialog } from '@/components/custom/api-token-login-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

interface LoginPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogin: () => Promise<void>;
  onApiTokenLogin?: (token: string) => Promise<void>;
  onSignUp: () => Promise<void>;
}

function LoginPromptActions({
  onClose,
  onLogin,
  onApiTokenLogin,
  onSignUp,
  onRequestApiToken,
}: Pick<LoginPromptDialogProps, 'onLogin' | 'onSignUp'> & {
  onClose: () => void;
  onApiTokenLogin?: (token: string) => Promise<void>;
  onRequestApiToken: () => void;
}) {
  // One handoff per mount: Radix/vaul keep the closing CTAs clickable through
  // animate-out, and a second activation would rebuild the PKCE verifier/state
  // the first OAuth URL was minted with. The ref resets when the prompt
  // reopens (the content unmounts on close), so a failed handoff is retryable
  // by reopening — no module state, no listeners.
  const startedRef = useRef(false);
  const start = (action: () => Promise<void>) => {
    onClose();
    if (startedRef.current) return;
    startedRef.current = true;
    action();
  };

  return (
    <>
      <Button className="w-full" onClick={() => start(onSignUp)}>
        <Localize i18n_default_text="Create free account" />
      </Button>
      <Button variant="outline" className="w-full" onClick={() => start(onLogin)}>
        <Localize i18n_default_text="Log in" />
      </Button>
      {onApiTokenLogin && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            onClose();
            onRequestApiToken();
          }}
        >
          <Localize i18n_default_text="Log in with API token" />
        </Button>
      )}
    </>
  );
}

/**
 * Prompt shown when a logged-out user activates Buy (Trader's auth-prompt
 * parity): a centered dialog on desktop, a bottom sheet on mobile. Freely
 * dismissible; both actions hand off to the existing OAuth flows the header
 * buttons use.
 */
export function LoginPromptDialog({
  open,
  onOpenChange,
  onLogin,
  onApiTokenLogin,
  onSignUp,
}: LoginPromptDialogProps) {
  const isMobile = useIsMobile();
  const [apiTokenDialogOpen, setApiTokenDialogOpen] = useState(false);
  const close = () => onOpenChange(false);

  // Resolve affiliate attribution while the user reads the prompt: the Scaleo
  // lookup is what made login()/signUp() await a network round-trip inside
  // the CTA click, and prefetching it here restores Trader's synchronous
  // click-path shape (its getAuthConfig has no network step at all).
  useEffect(() => {
    if (open) prefetchAuthReferral();
  }, [open]);

  if (isMobile) {
    return (
      <>
        {/* No background scaling: the sheet overlays a live chart canvas, which
            should not shrink behind the overlay. */}
        <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>
                <Localize i18n_default_text="Start trading with us" />
              </DrawerTitle>
              <DrawerDescription>
                <Localize i18n_default_text="Log in or create a free account to place a trade." />
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <LoginPromptActions
                onClose={close}
                onLogin={onLogin}
                onApiTokenLogin={onApiTokenLogin}
                onRequestApiToken={() => setApiTokenDialogOpen(true)}
                onSignUp={onSignUp}
              />
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
        {onApiTokenLogin && (
          <ApiTokenLoginDialog
            open={apiTokenDialogOpen}
            onOpenChange={setApiTokenDialogOpen}
            onLogin={onApiTokenLogin}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              <Localize i18n_default_text="Start trading with us" />
            </DialogTitle>
            <DialogDescription>
              <Localize i18n_default_text="Log in or create a free account to place a trade." />
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <LoginPromptActions
              onClose={close}
              onLogin={onLogin}
              onApiTokenLogin={onApiTokenLogin}
              onRequestApiToken={() => setApiTokenDialogOpen(true)}
              onSignUp={onSignUp}
            />
          </div>
        </DialogContent>
      </Dialog>
      {onApiTokenLogin && (
        <ApiTokenLoginDialog
          open={apiTokenDialogOpen}
          onOpenChange={setApiTokenDialogOpen}
          onLogin={onApiTokenLogin}
        />
      )}
    </>
  );
}
