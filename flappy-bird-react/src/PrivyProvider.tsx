"use client";
import { PrivyProvider } from "@privy-io/react-auth";

export default function Providers({ children }: { children: React.ReactNode }) {
  const privyAppId = "cmftjdco700aele0cj2depgc3"; // Your Privy App ID

  // During build time or when no app ID is provided, render children without Privy
  if (!privyAppId) {
    console.warn('Privy App ID is not set. Privy authentication will not be available.');
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethodsAndOrder: {
          // Don't forget to enable Monad Games ID support in:
          // Global Wallet > Integrations > Monad Games ID (click on the slide to enable)
          primary: ["privy:cmd8euall0037le0my79qpz42"], // This is the Cross App ID, DO NOT CHANGE THIS
        },
        appearance: {
          theme: 'dark',
          accentColor: '#7e30e1',
        }
      }}
    >
      {children}
    </PrivyProvider>
  );
}