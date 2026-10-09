import mysql from 'mysql2/promise';
import { env } from '../config/env';
import type { Clinic, ClinicInventory, InventoryItem } from '../types/dispatch.types';

/**
 * Catálogo de respaldo con las mismas clínicas que siembra database/init.sql.
 *
 * El core de Python responde con el id y el nombre de la clínica, pero no con
 * sus coordenadas, y el mapa las necesita. Si MySQL no está arriba, el centro
 * de mando sigue dibujando los hospitales en lugar de quedarse en blanco.
 */
const SEED_CLINICS: Clinic[] = [
  {
    id: 1,
    name: 'Hospital General de México Dr. Eduardo Liceaga',
    latitude: 19.4128,
    longitude: -99.1517,
    address: 'Dr. Balmis 148, Doctores, Cuauhtémoc, CDMX',
    capacityLevel: 'Nivel 4',
    status: 'active',
  },
  {
    id: 2,
    name: 'Centro Médico Nacional Siglo XXI',
    latitude: 19.4074,
    longitude: -99.1543,
    address: 'Av. Cuauhtémoc 330, Doctores, Cuauhtémoc, CDMX',
    capacityLevel: 'Nivel 4',
    status: 'active',
  },
  {
    id: 3,
    name: 'Hospital Juárez de México',
    latitude: 19.4827,
    longitude: -99.1362,
    address: 'Av. Instituto Politécnico Nacional 5160, Magdalena de las Salinas, CDMX',
    capacityLevel: 'Nivel 3',
    status: 'active',
  },
];

/**
 * Acceso de solo lectura a la base de datos de la Parte 1.
 *
 * El gateway nunca escribe en MySQL: quien modifica inventario es el stored
 * procedure que invoca el core de Python. Aquí solo leemos para pintar el mapa
 * y los tableros.
 */
class ClinicRepository {
  private pool: mysql.Pool | null = null;
  private warnedAboutDb = false;

  private getPool(): mysql.Pool {
    if (!this.pool) {
      this.pool = mysql.createPool({
        host: env.db.host,
        port: env.db.port,
        user: env.db.user,
        password: env.db.password,
        database: env.db.database,
        // Sin charset explicito los nombres de hospital con acentos llegan
        // rotos al centro de mando.
        charset: 'utf8mb4',
        waitForConnections: true,
        connectionLimit: 10,
      });
    }
    return this.pool;
  }

  private warnOnce(error: unknown): void {
    if (!this.warnedAboutDb) {
      this.warnedAboutDb = true;
      console.warn(
        '[clinics] MySQL no respondió, se usa el catálogo semilla de CDMX:',
        error instanceof Error ? error.message : error
      );
    }
  }

  async findAll(): Promise<Clinic[]> {
    try {
      const [rows] = await this.getPool().query<mysql.RowDataPacket[]>(
        `SELECT id,
                name,
                ST_Y(location) AS latitude,
                ST_X(location) AS longitude,
                address,
                capacity_level,
                status
           FROM clinics
          WHERE deleted_at IS NULL`
      );

      if (rows.length === 0) return SEED_CLINICS;

      return rows.map((row) => ({
        id: Number(row.id),
        name: String(row.name),
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        address: row.address ?? null,
        capacityLevel: row.capacity_level ?? null,
        status: row.status ?? null,
      }));
    } catch (error) {
      this.warnOnce(error);
      return SEED_CLINICS;
    }
  }

  async findById(clinicId: number): Promise<Clinic | null> {
    const clinics = await this.findAll();
    return clinics.find((clinic) => clinic.id === clinicId) ?? null;
  }

  async getInventory(clinicId: number): Promise<ClinicInventory | null> {
    const clinic = await this.findById(clinicId);
    if (!clinic) return null;

    let items: InventoryItem[] = [];
    try {
      const [rows] = await this.getPool().query<mysql.RowDataPacket[]>(
        `SELECT ci.resource_id,
                r.name AS resource_name,
                ci.quantity,
                ci.capacity
           FROM clinic_inventory ci
           JOIN resources r ON r.id = ci.resource_id
          WHERE ci.clinic_id = ?
          ORDER BY ci.resource_id`,
        [clinicId]
      );

      items = rows.map((row) => ({
        resourceId: Number(row.resource_id),
        resourceName: String(row.resource_name),
        quantity: Number(row.quantity),
        capacity: Number(row.capacity),
      }));
    } catch (error) {
      this.warnOnce(error);
    }

    return {
      clinicId: clinic.id,
      clinicName: clinic.name,
      items,
      updatedAt: new Date().toISOString(),
    };
  }

  async getAllInventories(): Promise<ClinicInventory[]> {
    const clinics = await this.findAll();
    const inventories = await Promise.all(
      clinics.map((clinic) => this.getInventory(clinic.id))
    );
    return inventories.filter((inv): inv is ClinicInventory => inv !== null);
  }
}

export const clinicRepository = new ClinicRepository();
