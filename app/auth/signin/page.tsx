"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowRight,
  AlertCircle,
  Loader2,
  Lock,
  User,
  ArrowLeft,
} from "lucide-react";

export default function SignInPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Username atau password salah");
        setIsLoading(false);
      } else if (result?.ok) {
        // Full page reload agar middleware membaca session cookie baru.
        // router.push() hanya client-side navigation -> middleware belum lihat cookie.
        window.location.href = "/kasir";
      }
    } catch (err) {
      setError("Terjadi kesalahan. Silakan coba lagi.");
      setIsLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-background">
      {/* Decorative grid background */}
      <div className="pointer-events-none absolute inset-0 bg-grid-slate opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />

      <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Back link */}
          <Link href="/" className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Kembali ke beranda
          </Link>

          {/* Logo & title */}
          <div className="mb-8">
            <div className="mb-5">
              <Image src="/icon-192.png" alt="KandangKu" width={48} height={48} className="rounded-2xl shadow-sm" priority />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Masuk ke akun Anda
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Akses sistem POS &amp; inventaris KandangKu
            </p>
          </div>

          {/* Form */}
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-foreground">
                Username
              </Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  className="pl-10"
                  placeholder="masukkan username Anda"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-foreground">
                Password
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="pl-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={isLoading}
              className="w-full gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Memproses...
                </>
              ) : (
                <>
                  Masuk <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Demo credentials */}
          {/* <div className="mt-8 rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Demo Credentials
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
              <p className="text-foreground">testadmin</p>
              <p className="text-muted-foreground">testadmin</p>
              <p className="text-foreground">testkasir</p>
              <p className="text-muted-foreground">testkasir</p>
            </div>
          </div> */}
        </div>
      </div>
    </main>
  );
}
