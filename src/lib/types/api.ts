// API Response Types
export interface User {
  userId: number;
  email: string;
  fullName: string;
  role: 'admin' | 'medic' | 'pacient';
  currentStreak?: number;
  longestStreak?: number;
  totalXp?: number;
  currentBadge?: string;
  mfaEnabled?: boolean;
  isActive?: boolean;
}

export interface Stats {
  total: number;
  taken: number;
  overdue: number;
  snoozed: number;
  upcomingLabel: string;
  weeklyAdherence: number;
  currentStreak?: number;
  longestStreak?: number;
  totalXp?: number;
  currentBadge?: string;
  completedTreatments?: number;
  activeTreatments?: number;
}

export interface Treatment {
  planId: number;
  diagnosis: string;
  description?: string;
  notes?: string;
  startDate: string;
  endDate?: string;
  createdAt?: string;
  patientId?: number;
  patientName?: string;
  doctorId?: number;
  doctorName?: string;
  isActive: boolean;
  medicationCount?: number;
}

export interface Medication {
  doseId: number;
  medicationName: string;
  cantitate: string;
  frecventa: string;
  time: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  planId: number;
  result?: 'pozitiv' | 'negativ' | 'snoozed';
  snoozedUntil?: string;
}

export interface Collaboration {
  id: number;
  doctorId: number;
  patientId: number;
  doctorName?: string;
  medicName?: string; // alias for doctorName
  patientName?: string;
  pacientName?: string; // alias for patientName
  doctorEmail?: string;
  medicEmail?: string; // alias for doctorEmail
  patientEmail?: string;
  pacientEmail?: string; // alias for patientEmail
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  created_at?: string; // alias for createdAt
  user_id?: number;
  name?: string;
  email?: string;
}

export interface LeaderboardEntry {
  userId: number;
  id?: number; // alias for userId for compatibility
  fullName: string;
  name?: string; // alias for fullName
  totalXp: number;
  xp?: number; // alias for totalXp
  currentStreak: number;
  streak?: number; // alias for currentStreak
  badge: string;
  rank: number;
}

export interface AdminOverview {
  users: {
    active: number;
    inactive: number;
    byRole: Array<{ role: string; count: number }>;
  };
  treatments: {
    active: number;
    inactive: number;
    total: number;
  };
  collaborations: Array<{ status: string; count: number }>;
  doses: {
    total: number;
  };
  adherence: {
    last7Days: {
      scheduled: number;
      confirmed: number;
      rate: number;
    };
    last30Days: {
      scheduled: number;
      confirmed: number;
      rate: number;
    };
  };
}

export interface MedicStats {
  totalPatients: number;
  activeTreatments: number;
  pendingInvites: number;
}

export interface Notification {
  notif_id: number;
  user_id: number;
  tip: string;
  titlu: string;
  continut: string;
  read: boolean;
  timestamp_creare: string;
  related_id?: number;
}

export interface Message {
  message_id: number;
  sender_id: number;
  receiver_id: number;
  continut: string;
  timestamp_trimitere: string;
  read: boolean;
  senderName?: string;
  receiverName?: string;
}

export interface ApiError {
  error: string;
  details?: string;
}
