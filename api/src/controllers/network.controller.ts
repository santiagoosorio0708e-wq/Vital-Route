import { Router, type Request, type Response } from 'express';
import { clinicRepository } from '../services/clinic.repository';
import { fleetService } from '../services/fleet.service';

const router = Router();

/**
 * Estado de la red por REST. El centro de mando ya recibe esta foto por
 * WebSocket al conectarse; estos endpoints existen para pruebas con Postman y
 * para clientes que solo necesiten una consulta puntual.
 */

router.get('/clinics', async (_req: Request, res: Response) => {
  res.json(await clinicRepository.findAll());
});

router.get('/inventory', async (_req: Request, res: Response) => {
  res.json(await clinicRepository.getAllInventories());
});

router.get('/inventory/:clinicId', async (req: Request, res: Response) => {
  const clinicId = Number(req.params.clinicId);
  if (!Number.isInteger(clinicId)) {
    return res.status(400).json({ error: 'El id de la clínica debe ser un número entero.' });
  }

  const inventory = await clinicRepository.getInventory(clinicId);
  if (!inventory) {
    return res.status(404).json({ error: `No existe la clínica ${clinicId}.` });
  }
  return res.json(inventory);
});

router.get('/fleet', (_req: Request, res: Response) => {
  res.json(fleetService.list());
});

export default router;
