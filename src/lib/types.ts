export type Sector = {
  id: string;
  name: string;
  /** Letra(s) que van delante del número, ej: "A" -> A-001 */
  prefix: string;
  color: string;
};

export type Config = {
  businessName: string;
  sectors: Sector[];
  /** Cantidad de puestos/mostradores que atienden */
  desks: number;
  voice: boolean;
};

export type Ticket = {
  code: string;
  sectorId: string;
  createdAt: number;
};

export type Call = {
  code: string;
  sectorId: string;
  desk: number;
  at: number;
};

export type PublicState = {
  config: Config;
  /** Fecha (YYYY-MM-DD) del día de la numeración actual */
  day: string;
  queue: Ticket[];
  /** Turno que está atendiendo cada puesto */
  current: Record<string, Call | undefined>;
  /** Últimos llamados, el más reciente primero */
  calls: Call[];
  /** Sube cada vez que hay que anunciar algo en la pantalla (llamado o repetir) */
  announceSeq: number;
  stats: { served: number; noShow: number; issued: number };
};
