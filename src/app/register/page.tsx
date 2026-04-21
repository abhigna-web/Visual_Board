"use client";

import { useState, useEffect } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useAuth, useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, Loader2, ArrowRight, Shield, Book, GraduationCap } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Role = "admin" | "teacher" | "student";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push("/dashboard");
    }
  }, [user, isUserLoading, router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
      router.push("/dashboard");
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "An error occurred during sign up.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { id: "admin" as Role, label: "Admin", icon: Shield },
    { id: "teacher" as Role, label: "Teacher", icon: Book },
    { id: "student" as Role, label: "Student", icon: GraduationCap },
  ];

  if (isUserLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#09090b]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] relative overflow-hidden p-4">
      {/* Background Decorative Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />

      <Card className="w-full max-w-[440px] shadow-2xl border-white/5 bg-[#18181b]/50 backdrop-blur-xl z-10 py-4">
        <CardHeader className="space-y-4 flex flex-col items-center pb-2">
          <div className="p-3 rounded-xl bg-primary shadow-[0_0_20px_rgba(124,58,237,0.5)]">
            <Monitor className="h-6 w-6 text-white" />
          </div>
          <div className="text-center space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight text-white">Create an Account</CardTitle>
            <CardDescription className="text-zinc-400 text-sm">
              Join CollabBoard to start collaborating
            </CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleRegister}>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                I AM A
              </Label>
              <div className="grid grid-cols-3 gap-3">
                {roles.map((r) => {
                  const Icon = r.icon;
                  const isActive = role === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRole(r.id)}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-xl border transition-all space-y-2 group",
                        isActive 
                          ? "bg-primary/10 border-primary text-primary shadow-[0_0_15px_rgba(124,58,237,0.2)]" 
                          : "bg-[#27272a]/30 border-white/5 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                      )}
                    >
                      <Icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-zinc-500 group-hover:text-zinc-300")} />
                      <span className="text-[10px] font-bold tracking-wide uppercase">{r.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                Full Name
              </Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-[#27272a]/50 border-white/5 text-white placeholder:text-zinc-600 focus-visible:ring-primary h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="krishna@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-[#27272a]/50 border-white/5 text-white placeholder:text-zinc-600 focus-visible:ring-primary h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-[#27272a]/50 border-white/5 text-white placeholder:text-zinc-600 focus-visible:ring-primary h-11"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-6 pt-2">
            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary/90 text-white py-6 rounded-lg font-semibold transition-all shadow-lg shadow-primary/20" 
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  Create Account <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
            <p className="text-xs text-center text-zinc-500">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:text-primary/80 font-medium transition-colors">
                Sign In
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
