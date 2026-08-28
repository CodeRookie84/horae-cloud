/**
 * KOT domain types — mirror the kot_* tables in
 * supabase/migrations/20260828_kot.sql. Kept independent of Horae's src/types.ts
 * so the module stays self-contained (isolation contract, see README).
 */
import type { KotStatus, KotTeam } from "./status";

export type { KotStatus, KotTeam };

/** A person in the KOT People Directory (separate from Horae staff directory). */
export interface KotParticipant {
  id: string;
  clientId: string;
  name: string;
  phone: string;
  team: KotTeam;
  /** Optional link to a Horae users.id — managers who also use the main app. */
  linkedUserId?: string | null;
  active: boolean;
  /** Outlet (tenant) ids this participant covers. */
  outletIds: string[];
}

/** A shared floor tablet login, scoped to one outlet. */
export interface KotStation {
  id: string;
  clientId: string;
  tenantId: string;   // outlet
  label: string;
  active: boolean;
}

export type KotFulfilment = "pickup" | "delivery";

/** One line on the order — a printed item, or the handwritten extra remark. */
export interface KotOrderItem {
  id: string;
  orderId: string;
  name: string;
  qty: number;
  rate: number;
  amount: number;
  /** The pen-written personalisation captured from the slip. */
  isExtraRemark: boolean;
  remarkText: string;
  /** Optional photo of the customer's cake drawing. */
  drawingPhotoUrl?: string | null;
  sortOrder: number;
}

/** A single status transition (the team-handoff audit trail). */
export interface KotStatusEvent {
  id: string;
  orderId: string;
  tenantId?: string;
  status: KotStatus;
  /** Required for `ready` and `collected`. */
  photoUrl?: string | null;
  note: string;
  actorStationId?: string | null;
  actorParticipantId?: string | null;
  actorName: string;
  createdAt: string;
}

/** A cake order, one per scanned KOT slip. */
export interface KotOrder {
  id: string;
  clientId: string;
  tenantId: string;   // outlet
  invoiceNo: string;
  orderDate: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  /** Delivery date + time (ISO). */
  deliveryAt: string | null;
  fulfilment: KotFulfilment;
  billTotal: number;
  advancePaid: number;
  balanceDue: number;
  /** The scanned slip — source of truth over any extraction. */
  kotPhotoUrl?: string | null;
  status: KotStatus;
  /** Raw vision-model extraction JSON, retained for audit. */
  extracted?: unknown;
  createdByStation?: string | null;
  createdByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  items: KotOrderItem[];
  assigneeIds: string[];
}

/** The station session minted by kot-station-auth and kept in localStorage. */
export interface KotStationSession {
  stationId: string;
  tenantId: string;
  clientId: string;
  outletLabel: string;
  token: string;
  issuedAt: number;
}
