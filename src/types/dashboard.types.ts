export interface DashboardStats {
  totalCompanies: number;
  totalPlayers: number;
  totalRevenue: number;
  totalAdminFees: number;
  totalTicketsSold: number;
  activeRaffles: number;
  finishedRaffles: number;
  upcomingRaffles: number;
  totalSalesCount: number;
  newPlayersToday: number;
  newPlayersThisMonth: number;
}

export interface RevenueByDay {
  date: string;
  revenue: number;
  fees: number;
  count: number;
}

export interface PlayerRegistrationByDay {
  date: string;
  count: number;
}

export interface SalesByCompany {
  companyId: string;
  companyName: string;
  totalRevenue: number;
  salesCount: number;
}

export interface StatusDistribution {
  status: string;
  count: number;
}

export interface RecentSale {
  id: string;
  amount: number;
  adminFee: number;
  status: string;
  createdAt: string;
  companyName: string;
  raffleName: string;
  playerName: string;
}

export interface UpcomingRaffle {
  id: string;
  name: string;
  companyName: string;
  ticketPrice: number;
  scheduledAt: string | null;
  status: string;
}

export interface DashboardData {
  stats: DashboardStats;
  revenueByDay: RevenueByDay[];
  playerRegistrationsByDay: PlayerRegistrationByDay[];
  salesByCompany: SalesByCompany[];
  paymentStatusDistribution: StatusDistribution[];
  raffleStatusDistribution: StatusDistribution[];
  recentSales: RecentSale[];
  upcomingRafflesList: UpcomingRaffle[];
}
