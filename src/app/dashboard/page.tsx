
"use client";

import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { collection, query, where, serverTimestamp, doc } from "firebase/firestore";
import { useAuth, useFirestore, useUser, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Monitor, 
  LayoutDashboard, 
  Plus, 
  Search, 
  Users, 
  Calendar, 
  Share2, 
  ArrowRight, 
  Zap,
  Loader2,
  Trash2,
  X
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

interface Board {
  id: string;
  name: string;
  ownerId: string;
  createdAt: any;
  participantCount?: number;
}

export default function Dashboard() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/login");
    }
  }, [user, isUserLoading, router]);

  const boardsQuery = useMemoFirebase(() => {
    if (!user || !db) return null;
    return query(collection(db, "boards"), where("ownerId", "==", user.uid));
  }, [db, user]);

  const { data: boards, isLoading: boardsLoading } = useCollection<Board>(boardsQuery);

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newBoardTitle.trim()) return;
    
    setCreating(true);
    const newBoard = {
      name: newBoardTitle,
      ownerId: user.uid,
      createdAt: serverTimestamp(),
      members: { [user.uid]: 'owner' },
      strokes: []
    };
    
    addDocumentNonBlocking(collection(db, "boards"), newBoard)
      .then((docRef) => {
        if (docRef) {
          setIsDialogOpen(false);
          setNewBoardTitle("");
          router.push(`/canvas/${docRef.id}`);
        }
      })
      .finally(() => setCreating(false));
  };

  const handleDeleteBoard = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm("Are you sure you want to delete this board?")) return;
    
    deleteDocumentNonBlocking(doc(db, "boards", id));
    toast({
      title: "Board deleted",
      description: "Your board has been removed successfully.",
    });
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  if (isUserLoading || (boardsLoading && !boards)) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#09090b]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Top Navbar */}
      <header className="h-16 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary">
              <Monitor className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">CollabBoard</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-primary">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 pr-4 border-r border-white/5">
            <div className="text-right">
              <div className="text-sm font-bold text-white leading-none">
                {user?.displayName || user?.email?.split('@')[0] || "User"}
              </div>
              <div className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 mt-1">
                Teacher
              </div>
            </div>
            <Avatar className="h-8 w-8 ring-2 ring-primary/20">
              <AvatarFallback className="bg-primary text-white text-xs font-bold uppercase">
                {(user?.displayName || user?.email || "U")[0]}
              </AvatarFallback>
            </Avatar>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-zinc-500 hover:text-destructive">
            <Zap className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Welcome back, {user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || "there"}!
            </h1>
            <p className="text-zinc-500 text-sm">Your workspaces and active boards.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Invite code or link"
                className="bg-[#18181b] border border-white/5 rounded-lg pl-10 pr-4 py-2 text-sm w-[240px] focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              />
            </div>
            <Button size="sm" className="bg-[#27272a] hover:bg-[#3f3f46] text-white border border-white/5 px-4">
              Join
            </Button>
            <Button 
              size="sm" 
              onClick={() => setIsDialogOpen(true)}
              className="bg-primary hover:bg-primary/90 text-white gap-2 px-4 shadow-[0_0_15px_rgba(124,58,237,0.3)]"
            >
              <Plus className="h-4 w-4" />
              New Board
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="grid grid-cols-2 gap-0.5">
                <div className="w-1.5 h-1.5 bg-zinc-600 rounded-sm"></div>
                <div className="w-1.5 h-1.5 bg-zinc-600 rounded-sm"></div>
                <div className="w-1.5 h-1.5 bg-zinc-600 rounded-sm"></div>
                <div className="w-1.5 h-1.5 bg-zinc-600 rounded-sm"></div>
              </div>
              <h2 className="font-bold tracking-wide uppercase text-xs text-zinc-500">Your Boards</h2>
            </div>

            {!boards || boards.length === 0 ? (
              <div className="text-center py-20 bg-[#18181b]/30 rounded-2xl border border-dashed border-white/5">
                <p className="text-zinc-500 mb-6">No boards found in your workspace.</p>
                <Button onClick={() => setIsDialogOpen(true)} variant="outline" className="border-primary/20 text-primary hover:bg-primary/5">
                  Create First Board
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {boards.map((board) => (
                  <Card key={board.id} className="bg-[#18181b] border-white/5 overflow-hidden group hover:border-primary/20 transition-all duration-300">
                    <CardHeader className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <CardTitle className="text-xl font-bold">{board.name}</CardTitle>
                        <Badge className="bg-primary/10 text-primary border-none text-[10px] px-2 py-0.5 font-bold tracking-widest uppercase">
                          MEMBER
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-zinc-400">
                          <Users className="h-4 w-4" />
                          <span className="text-sm">{board.participantCount || 1} participants</span>
                        </div>
                        <div className="flex items-center gap-3 text-zinc-400">
                          <Calendar className="h-4 w-4" />
                          <span className="text-sm">
                            {board.createdAt?.toDate()?.toLocaleDateString() || new Date().toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <div className="px-6 py-4 border-t border-white/5 bg-[#1c1c1f]/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-zinc-500 hover:text-white hover:bg-white/5"
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-zinc-500 hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => handleDeleteBoard(board.id, e)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Link href={`/canvas/${board.id}`}>
                        <Button size="sm" className="bg-primary hover:bg-primary/90 text-white rounded-lg gap-2 px-4 text-xs font-bold uppercase tracking-wider">
                          Open
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-4">
            <div className="flex items-center gap-3 mb-6">
              <Zap className="h-4 w-4 text-primary" />
              <h2 className="font-bold tracking-wide uppercase text-xs text-zinc-500">Global Activity</h2>
            </div>

            <Card className="bg-[#18181b] border-white/5">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  Activity Feed
                  <span className="text-[10px] font-normal text-zinc-500">Real-time</span>
                </CardTitle>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-xs text-zinc-400">Online</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5">
                  <Avatar className="h-8 w-8 ring-1 ring-primary/30">
                    <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-bold uppercase">
                      {(user?.displayName || user?.email || "U")[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-xs font-bold text-white">You</div>
                    <div className="text-[10px] text-zinc-500">Dashboard</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Create New Board Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-[#1c1c1f] border-white/5 text-white max-w-[400px] p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-6 pb-2">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold">Create New Board</DialogTitle>
              <button onClick={() => setIsDialogOpen(false)} className="text-zinc-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
          </DialogHeader>
          <form onSubmit={handleCreateBoard}>
            <div className="px-6 py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  BOARD TITLE
                </Label>
                <Input
                  id="title"
                  placeholder="e.g. Q3 Planning"
                  value={newBoardTitle}
                  onChange={(e) => setNewBoardTitle(e.target.value)}
                  className="bg-[#27272a]/50 border-white/5 text-white placeholder:text-zinc-600 focus-visible:ring-primary h-12 rounded-xl"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter className="p-6 bg-[#18181b]/50 border-t border-white/5 flex gap-3">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setIsDialogOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={creating || !newBoardTitle.trim()}
                className="bg-primary hover:bg-primary/90 text-white rounded-xl h-11 px-6 shadow-[0_0_15px_rgba(124,58,237,0.3)]"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Board
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
