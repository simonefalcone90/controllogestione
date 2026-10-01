import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Elacus SRL - Controllo di Gestione & Finanza",
  description: "Gestionale economico e finanziario mensile per Elacus SRL",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className="antialiased min-h-screen flex text-slate-800 bg-slate-50">
        {children}
      </body>
    </html>
  );
}
