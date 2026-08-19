// Universal Edge & Node-compatible Database Store
// Provides seamless operation on both local Node.js environments and Cloudflare Workers Edge isolates.

class MemoryStore {
  users: any[] = [];
  researchRuns: any[] = [];
  candidateSetups: any[] = [];
  trades: any[] = [];
  marketQuotes: any[] = [];
  alertNotifications: any[] = [];

  constructor() {
    // Initialize default senior trader user
    this.users.push({
      id: "user-default-trader",
      email: "trader@broker.com",
      name: "Senior Desk Trader",
      accountSize: 15000.0,
      riskPerTrade: 1.0,
      maxSleeveRiskPct: 3.0,
      maxOpenPositions: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  user = {
    findFirst: async (args?: any) => {
      if (args?.where?.email) {
        return this.users.find(u => u.email.toLowerCase() === args.where.email.toLowerCase()) || null;
      }
      return this.users[0] || null;
    },
    findUnique: async (args: any) => {
      if (args?.where?.id) return this.users.find(u => u.id === args.where.id) || null;
      if (args?.where?.email) return this.users.find(u => u.email.toLowerCase() === args.where.email.toLowerCase()) || null;
      return null;
    },
    create: async (args: any) => {
      const newUser = {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.users.push(newUser);
      return newUser;
    },
    update: async (args: any) => {
      const idx = this.users.findIndex(u => (args.where?.id ? u.id === args.where.id : u.email === args.where.email));
      if (idx !== -1) {
        this.users[idx] = { ...this.users[idx], ...args.data, updatedAt: new Date() };
        return this.users[idx];
      }
      return null;
    },
  };

  trade = {
    findMany: async (args?: any) => {
      let results = [...this.trades];
      if (args?.where?.userId) results = results.filter(t => t.userId === args.where.userId);
      if (args?.where?.status?.in) results = results.filter(t => args.where.status.in.includes(t.status));
      if (args?.where?.status && typeof args.where.status === "string") results = results.filter(t => t.status === args.where.status);
      return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    findUnique: async (args: any) => {
      return this.trades.find(t => t.id === args.where.id) || null;
    },
    findFirst: async (args?: any) => {
      const res = await this.trade.findMany(args);
      return res[0] || null;
    },
    create: async (args: any) => {
      const newTrade = {
        id: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.trades.unshift(newTrade);
      return newTrade;
    },
    update: async (args: any) => {
      const idx = this.trades.findIndex(t => t.id === args.where.id);
      if (idx !== -1) {
        this.trades[idx] = { ...this.trades[idx], ...args.data, updatedAt: new Date() };
        return this.trades[idx];
      }
      return null;
    },
    delete: async (args: any) => {
      this.trades = this.trades.filter(t => t.id !== args.where.id);
      return { success: true };
    },
  };

  researchRun = {
    findFirst: async (args?: any) => {
      return this.researchRuns[0] || null;
    },
    findMany: async (args?: any) => {
      return [...this.researchRuns];
    },
    create: async (args: any) => {
      const newRun = {
        id: `run-${Date.now()}`,
        ...args.data,
        createdAt: new Date(),
      };
      this.researchRuns.unshift(newRun);
      return newRun;
    },
  };

  candidateSetup = {
    findMany: async (args?: any) => {
      return [...this.candidateSetups];
    },
    create: async (args: any) => {
      const newCandidate = {
        id: `candidate-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        ...args.data,
        createdAt: new Date(),
      };
      this.candidateSetups.unshift(newCandidate);
      return newCandidate;
    },
    update: async (args: any) => {
      const idx = this.candidateSetups.findIndex(c => c.id === args.where.id);
      if (idx !== -1) {
        this.candidateSetups[idx] = { ...this.candidateSetups[idx], ...args.data };
        return this.candidateSetups[idx];
      }
      return null;
    },
  };

  alertNotification = {
    findMany: async (args?: any) => {
      let res = [...this.alertNotifications];
      if (args?.where?.userId) res = res.filter(a => a.userId === args.where.userId);
      return res.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, args?.take || 30);
    },
    findFirst: async (args?: any) => {
      let res = [...this.alertNotifications];
      if (args?.where?.ticker) res = res.filter(a => a.ticker === args.where.ticker);
      if (args?.where?.type) res = res.filter(a => a.type === args.where.type);
      return res[0] || null;
    },
    create: async (args: any) => {
      const newNotification = {
        id: `notif-${Date.now()}`,
        isRead: false,
        ...args.data,
        createdAt: new Date(),
      };
      this.alertNotifications.unshift(newNotification);
      return newNotification;
    },
    update: async (args: any) => {
      const idx = this.alertNotifications.findIndex(a => a.id === args.where.id);
      if (idx !== -1) {
        this.alertNotifications[idx] = { ...this.alertNotifications[idx], ...args.data };
        return this.alertNotifications[idx];
      }
      return null;
    },
    updateMany: async (args: any) => {
      this.alertNotifications.forEach((a, idx) => {
        if (args?.where?.userId && a.userId === args.where.userId) {
          this.alertNotifications[idx] = { ...a, ...args.data };
        }
      });
      return { count: this.alertNotifications.length };
    },
  };
}

const globalForStore = globalThis as unknown as {
  edgePrismaStore: MemoryStore | undefined;
};

export const prisma: any = globalForStore.edgePrismaStore ?? new MemoryStore();

if (process.env.NODE_ENV !== "production") {
  globalForStore.edgePrismaStore = prisma;
}
